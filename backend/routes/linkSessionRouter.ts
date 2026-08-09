// ----------------------------------------
// @file   linkSessionRouter.ts
// @desc   Defines secure device-linking routes for E2EE key transfer workflow
// ----------------------------------------

import express from 'express';
import {
  completeLinkSession,
  createLinkSession,
  getLinkSession,
  getLinkSessionStatus,
  respondToLinkSession,
} from '../controllers/linkSessionController.js';
import { linkSessionCreateLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// ----------------------------------------
// @desc    Creates a short-lived pending link session from a new device
// @route   POST /api/link-session/create
// @access  Private
// ----------------------------------------
router.post('/create', linkSessionCreateLimiter, createLinkSession);

// ----------------------------------------
// @desc    Approves or rejects a pending link session
// @route   POST /api/link-session/respond
// @access  Private
// ----------------------------------------
router.post('/respond', respondToLinkSession);

// ----------------------------------------
// @desc    Relays encrypted secret payload after approval completion
// @route   POST /api/link-session/complete
// @access  Private
// ----------------------------------------
router.post('/complete', completeLinkSession);

// ----------------------------------------
// @desc    Returns current status of a link session for polling UI
// @route   GET /api/link-session/status/:sessionId
// @access  Private
// ----------------------------------------
router.get('/status/:sessionId', getLinkSessionStatus);

// ----------------------------------------
// @desc    Returns link session details including temporary public key
// @route   GET /api/link-session/:sessionId
// @access  Private
// ----------------------------------------
router.get('/:sessionId', getLinkSession);

export default router;
