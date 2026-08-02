// ----------------------------------------
// @file   migrateToUnifiedConversationSchema.ts
// @desc   One-time data migration for group chat support:
//           1. Sets Conversation.type = 'direct' on every existing conversation
//              (the field is new; all pre-existing conversations are 1:1).
//           2. Backfills Message.conversationId by iterating conversations
//              (not messages) — O(conversations) forward writes instead of
//              O(messages) reverse lookups, since conversations are far
//              fewer than messages.
//           3. Reshapes the legacy single-string encryptedAESKey envelope
//              ('{"receiver":"...","sender":"..."}') into the new
//              encryptedAESKeys array format used by both direct and group
//              messages. Pure ciphertext-envelope reshaping — no decryption
//              happens anywhere in this script.
//
//         Idempotent: safe to re-run. Each phase filters to only the
//         documents it hasn't already migrated, and a completion marker is
//         written to a `migrations` collection so a full re-run fast-exits.
//
//         Invocation: `npm run migrate:group-chat` from backend/. Run this
//         manually as a one-off deploy step BEFORE deploying backend code
//         that assumes the new schema shape (the new send/read path keeps a
//         conversationId fallback for one release — see messageController.ts
//         getMessageConversation — but do not skip running this).
// ----------------------------------------

import dotenv from 'dotenv';
import mongoose, { Types, type AnyBulkWriteOperation } from 'mongoose';
import Conversation from '../models/conversationModel.js';
import Message, { type IMessage } from '../models/messageModel.js';

dotenv.config();

const MIGRATION_NAME = 'unify-conversation-schema-v1';
const MESSAGE_ID_CHUNK_SIZE = 5000;
const AES_KEY_RESHAPE_BATCH_SIZE = 500;

interface LegacyEncryptedAesKeyEnvelope {
  receiver?: unknown;
  sender?: unknown;
}

const tryParseLegacyEnvelope = (value: string): LegacyEncryptedAesKeyEnvelope | null => {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return parsed as LegacyEncryptedAesKeyEnvelope;
    }
    return null;
  } catch {
    return null;
  }
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const alreadyMigrated = async (): Promise<boolean> => {
  const record = await mongoose.connection.collection('migrations').findOne({ name: MIGRATION_NAME });
  return Boolean(record);
};

const markMigrated = async (): Promise<void> => {
  await mongoose.connection.collection('migrations').insertOne({
    name: MIGRATION_NAME,
    completedAt: new Date(),
  });
};

const phaseSetConversationType = async (): Promise<void> => {
  const result = await Conversation.updateMany(
    { type: { $exists: false } },
    { $set: { type: 'direct' } }
  );
  console.log(
    `[migrate] Phase 1/3 — Conversation.type backfilled on ${result.modifiedCount} document(s).`
  );
};

const phaseBackfillConversationId = async (): Promise<void> => {
  let conversationsProcessed = 0;
  let messagesUpdated = 0;

  const cursor = Conversation.find({}, '_id messages').cursor();

  for await (const conversation of cursor) {
    const messageIds = (conversation.messages || []) as Types.ObjectId[];
    if (messageIds.length === 0) {
      conversationsProcessed += 1;
      continue;
    }

    for (const batch of chunk(messageIds, MESSAGE_ID_CHUNK_SIZE)) {
      const result = await Message.updateMany(
        { _id: { $in: batch }, conversationId: { $exists: false } },
        { $set: { conversationId: conversation._id } }
      );
      messagesUpdated += result.modifiedCount;
    }

    conversationsProcessed += 1;
  }

  console.log(
    `[migrate] Phase 2/3 — Message.conversationId backfilled on ${messagesUpdated} message(s) across ${conversationsProcessed} conversation(s).`
  );
};

const phaseReshapeEncryptedAesKeys = async (): Promise<void> => {
  const cursor = Message.find(
    { encryptedAESKey: { $exists: true, $ne: null }, encryptedAESKeys: { $exists: false } },
    'senderId receiverId encryptedAESKey'
  ).cursor({ batchSize: AES_KEY_RESHAPE_BATCH_SIZE });

  let reshaped = 0;
  let flaggedForReview = 0;
  let ops: AnyBulkWriteOperation<IMessage>[] = [];

  const flushOps = async () => {
    if (ops.length === 0) return;
    await Message.bulkWrite(ops);
    ops = [];
  };

  for await (const doc of cursor) {
    const rawEnvelope = (doc as unknown as { encryptedAESKey?: string }).encryptedAESKey;
    const parsed = typeof rawEnvelope === 'string' ? tryParseLegacyEnvelope(rawEnvelope) : null;

    if (parsed?.receiver && parsed?.sender && doc.receiverId) {
      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              encryptedAESKeys: [
                { userId: doc.receiverId, wrappedKey: String(parsed.receiver) },
                { userId: doc.senderId, wrappedKey: String(parsed.sender) },
              ],
            },
          },
        },
      });
      reshaped += 1;
    } else {
      // Doesn't match the expected {receiver, sender} dual-wrap shape (e.g.
      // a pre-dual-wrap legacy single-key format). Flag for manual review
      // rather than guessing ownership semantics.
      console.log(`[migrate] Flagging message ${String(doc._id)} for manual review (unexpected encryptedAESKey shape).`);
      flaggedForReview += 1;
    }

    if (ops.length >= AES_KEY_RESHAPE_BATCH_SIZE) {
      await flushOps();
    }
  }

  await flushOps();

  console.log(
    `[migrate] Phase 3/3 — encryptedAESKeys reshaped on ${reshaped} message(s); ${flaggedForReview} flagged for manual review.`
  );
};

const run = async (): Promise<void> => {
  if (!process.env.MONGO_DB_URI) {
    throw new Error('MONGO_DB_URI is not set');
  }

  await mongoose.connect(process.env.MONGO_DB_URI);
  console.log('[migrate] Connected to MongoDB.');

  if (await alreadyMigrated()) {
    console.log(`[migrate] "${MIGRATION_NAME}" already completed — nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  await phaseSetConversationType();
  await phaseBackfillConversationId();
  await phaseReshapeEncryptedAesKeys();
  await markMigrated();

  console.log('[migrate] Done.');
  await mongoose.disconnect();
};

run().catch(async (error: unknown) => {
  console.error('[migrate] Failed:', error instanceof Error ? error.message : String(error));
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
