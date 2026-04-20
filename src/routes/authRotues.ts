import express, { Request, Response } from 'express'
import { GetUser, RefreshToken, RemoveToken, SetToken } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/set-token',SetToken)
router.post('/set-refreshToken',RefreshToken)
router.get('/user',authMiddleware,GetUser)
router.post('/logout',authMiddleware,RemoveToken)

export default router