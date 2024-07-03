import express from 'express'
import {signUpUser, loginUser, logOutUser} from "../controllers/authController.js"

const router = express.Router();

router.post('/login', loginUser); 
router.post('/signup', signUpUser);
router.post('/logout', logOutUser);

export default router;