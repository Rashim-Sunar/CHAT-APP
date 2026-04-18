// Orchestrates outbound chat sends for the selected conversation, including
// text messages, media uploads, optimistic queue updates, and post-send sync.
// Depends on the selected conversation, auth context, shared conversation store,
// Cloudinary upload helpers, and the message API.
import { useState } from "react";
import toast from "react-hot-toast";
import useConversation from "../zustand/useConversation";
import { useAuthContext } from "../context/Auth-Context";
import { getConversationKey } from "../Utils/conversationKey";
import { uploadFilesToCloudinary } from "../Utils/uploadService";
import { getErrorMessage } from "../Utils/getErrorMessage";
import type { ApiErrorResponse, Message, SendMessagePayload } from "../types";
import { apiFetch } from "../Utils/apiFetch";
import {
  decryptMessageIfNeeded,
  encryptTextMessage,
  getPublicKeyByUserId,
  requireUserKeyPair,
} from "../Utils/crypto";
import { saveConversationPreview } from "../Utils/conversationPreviewCache";
import { getMessagePreviewText } from "../Utils/messageDisplay";

/**
 * Coordinates all outbound messaging behavior for the currently selected conversation.
 *
 * Responsibilities:
 * - send text messages
 * - upload media files and convert them into message payloads
 * - persist server-confirmed messages into local chat state
 * - keep conversation preview and details panel data in sync
 * - expose loading state to disable send controls while work is in flight
 */
const useSendMessage = () => {
  const [loading, setLoading] = useState(false);
  const { authUser } = useAuthContext();
  const {
    selectedConversation,
    appendMessageToConversation,
    upsertConversationFromMessage,
    bumpDetailsRefreshVersion,
    addUploadJobs,
    updateUploadJob,
    removeUploadJob,
  } = useConversation();

  const currentUserId = authUser?.data?.user?._id;

  /**
   * Applies a server-confirmed message to local stores.
   *
   * Why this is centralized:
   * - both text and media sends eventually produce the same message shape from the backend
   * - a single path prevents drift between message list, sidebar preview, and details panel
   */
  const persistMessage = (outgoingMessage: Message) => {
    const conversationKey = getConversationKey(
      outgoingMessage?.senderId,
      outgoingMessage?.receiverId
    );

    if (conversationKey && outgoingMessage) {
      appendMessageToConversation(conversationKey, outgoingMessage);

      if (currentUserId) {
        upsertConversationFromMessage(outgoingMessage, currentUserId);
        // Persist a local preview so sender-side sidebar survives reloads with
        // readable text even though the server stores encrypted message bodies.
        saveConversationPreview(currentUserId, String(outgoingMessage.receiverId), {
          lastMessage: getMessagePreviewText(outgoingMessage),
          lastMessageAt: outgoingMessage.createdAt,
          lastMessageSenderId: String(outgoingMessage.senderId),
        });

        // The details panel (media/links/documents) reads from a refetched summary endpoint.
        // Receiver-side updates are triggered by socket events, but sender-side local sends do
        // not pass through that socket path, so we explicitly trigger a refresh here.
        const activeConversationKey = getConversationKey(selectedConversation?._id, currentUserId);
        if (activeConversationKey === conversationKey) {
          bumpDetailsRefreshVersion();
        }
      }
    }
  };

  /**
   * Sends a normalized message payload to the backend.
   *
   * Note: we persist only after backend success so local state reflects canonical server data
   * (message id, timestamps, and processed media metadata).
   */
  const sendPayload = async (payload: SendMessagePayload): Promise<void> => {
    const data = await apiFetch<ApiErrorResponse & { newMessage?: Message }>(
      `/messages/send/${selectedConversation?._id}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    if (data.error) throw new Error(data.error);

    const outgoingMessage = data?.newMessage;
    if (outgoingMessage) {
      const normalizedMessage = currentUserId
        ? await decryptMessageIfNeeded(outgoingMessage, currentUserId)
        : outgoingMessage;
      persistMessage(normalizedMessage);
    }
  };

  /**
   * Sends a plain text message using the shared payload pipeline.
   * Any error is surfaced as a toast; callers do not need to catch.
    *
    * @param {string} message The text content to send.
    * @returns {Promise<void>} Resolves after the message has been accepted or an error has been shown.
   */
  const sendMessage = async (message: string): Promise<void> => {
    if (!selectedConversation?._id || !currentUserId) return;

    setLoading(true);
    try {
      const { publicKey: senderPublicKey } = await requireUserKeyPair(currentUserId);
      const receiverPublicKey = await getPublicKeyByUserId(String(selectedConversation._id));

      const encryptedPayload = await encryptTextMessage(
        message,
        receiverPublicKey,
        senderPublicKey
      );

      await sendPayload({
        messageType: "text",
        ...encryptedPayload,
      });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Upload flow for media/documents:
   * 1) create queue jobs so UI can show progress per file
   * 2) upload files to Cloudinary and capture metadata
   * 3) send each successful upload as a chat message payload
   * 4) mark job success/failure and show aggregate failure feedback
   * 5) clear completed/failed jobs shortly after the UI reflects final status
  *
  * @param {FileList | File[] | null | undefined} fileList Files selected by the user.
  * @returns {Promise<void>} Resolves after all upload and send attempts have settled.
   */
  const sendFiles = async (fileList: FileList | File[] | null | undefined): Promise<void> => {
    if (!selectedConversation?._id || !fileList?.length) return;

    const files = Array.from(fileList);
    const jobs = files.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}_${file.name}`,
      fileName: file.name,
      progress: 0,
      status: "uploading" as const,
      error: null,
    }));

    addUploadJobs(jobs);
    setLoading(true);

    try {
      const uploadResults = await uploadFilesToCloudinary({
        files,
        onProgress: (index, progress) => {
          // Upload progress arrives by file index from the uploader utility.
          const job = jobs[index];
          if (!job) return;
          updateUploadJob(job.id, { progress });
        },
      });

      const sendResults = await Promise.allSettled(
        uploadResults.map(async (result, index) => {
          const job = jobs[index];
          if (!job) return;

          if (result.status === "rejected") {
            // Upload failed before message creation; mark job and continue processing others.
            updateUploadJob(job.id, {
              status: "failed",
              error: result.reason?.message || "Upload failed",
            });
            return;
          }

          const mediaMessagePayload = result.value;
          // Message creation can still fail after upload (API/network/auth errors).
          await sendPayload(mediaMessagePayload);
          updateUploadJob(job.id, { status: "completed", progress: 100 });
        })
      );

      const uploadFailures = uploadResults.filter((result) => result.status === "rejected").length;
      const sendFailures = sendResults.filter((result) => result.status === "rejected").length;
      const failures = uploadFailures + sendFailures;
      if (failures > 0) {
        toast.error(`${failures} file(s) failed. Others were sent successfully.`);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
      setTimeout(() => {
        // Keep actively uploading rows visible; remove terminal states to avoid stale queue noise.
        jobs.forEach((job) => {
          const queueJob = useConversation.getState().uploadQueue.find(
            (item) => item.id === job.id
          );

          if (queueJob?.status !== "uploading") {
            removeUploadJob(job.id);
          }
        });
      }, 800);
    }
  };

  return { loading, sendMessage, sendFiles };
};

export default useSendMessage;