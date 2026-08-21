// ----------------------------------------
// @file   storiesRouter.ts
// @desc   Defines story/status routes
// ----------------------------------------

import express from 'express';
import {
  createStory,
  createStoryUploadSignature,
  deleteStory,
  getStories,
  getStory,
  viewStory,
} from '../controllers/storyController.js';

const router = express.Router();

router.post('/upload-signature', createStoryUploadSignature);
router.get('/', getStories);
router.post('/', createStory);
router.get('/:storyId', getStory);
router.post('/:storyId/view', viewStory);
router.delete('/:storyId', deleteStory);

export default router;
