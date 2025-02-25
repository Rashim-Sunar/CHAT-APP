import express from 'express'
import protectRoute from '../middlewares/protectRoute.js'

import {sendMessage, getMessage} from '../controllers/messageController.js'

const router = express.Router();

router.get('/:id', protectRoute, getMessage)
router.post("/send/:id",protectRoute, sendMessage);

export default router;