import { NextFunction, Request, Response } from "express";
import jwt from 'jsonwebtoken'
import { db } from "../utils/supabase-db-connection";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { sendErrorResponse } from "../utils/response";
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // console.log(req.cookies)
    const token = req.cookies.accessToken || req.headers.authorization?.split(' ')[1]
    if (!token) {
      return sendErrorResponse(res, null, 'Unauthorized,token is missing', 401)
    }
    
    // verify token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET!)
    const { userId } = decodedToken as { userId: string }
    // console.log(userId)

    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user[0]) {
      return sendErrorResponse(res, null, 'Unauthorized Access:User is not found', 401)
    }
    if (user[0].role === 'free' && new Date().toISOString().split('T')[0] !== user[0].lastReviewDate) {
      await db.update(users).set({
        dailyReviewCount: 0,
        lastReviewDate: new Date().toISOString().split('T')[0]
      }).where(eq(users.id, userId))
    }//must check its flow when the frontend is developed 
    (req as any).userData = user[0]
    next()
  } catch (error: any) {
    return sendErrorResponse(res, error, error.message, 401)
  }
}