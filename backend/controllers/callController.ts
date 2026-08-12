// ----------------------------------------
// @file   callController.ts
// @desc   REST sync for live call state — closes the gap where a client
//         missed the live 'call:incoming'/'call:started' socket event
//         (page reload mid-call, or a call starting in a conversation that
//         isn't currently open).
// ----------------------------------------

import type { Response } from 'express';
import mongoose from 'mongoose';
import Conversation from '../models/conversationModel.js';
import type { AuthenticatedRequest } from '../types/express/index.js';
import { getSnapshot } from '../Utils/callSession.js';

/**
 * @desc    Returns the live call session for a conversation, if any
 * @route   GET /api/conversations/:id/call
 * @access  Private
 */
export const getActiveCall = async (
  req: AuthenticatedRequest<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const userId = String(req.user);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ status: 'fail', error: 'Invalid conversation id' });
      return;
    }

    const conversation = await Conversation.findById(id).select('participants');
    const requesterIsParticipant = Boolean(
      conversation?.participants.some((participantId) => String(participantId) === userId)
    );

    if (!conversation || !requesterIsParticipant) {
      res.status(404).json({ status: 'fail', error: 'Conversation not found' });
      return;
    }

    const snapshot = getSnapshot(id);

    res.status(200).json({
      status: 'success',
      data: { active: Boolean(snapshot), call: snapshot || undefined },
    });
  } catch (error: unknown) {
    console.log('Error in getActiveCall:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};
