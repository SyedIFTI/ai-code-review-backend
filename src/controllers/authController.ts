import { Request, Response } from "express";
import { supabase } from "../utils/supabase";
import jwt from 'jsonwebtoken';
import { db } from "../utils/supabase-db-connection";
import { refresh_token, users } from "../db/schema";
import { eq } from "drizzle-orm"; // Required for checking if user exists
import { sendErrorResponse, sendSuccessResponse } from "../utils/response";
import crypto from 'crypto';
import { stripe } from "../utils/stripe";
const hashToken = async (token: string) => {
    return crypto.createHash('sha256').update(token).digest('hex');
}
export const SetToken = async (req: Request, res: Response) => {
    try {
        console.log('Request hits on the set-token point')
        const { accessToken, refreshToken } = req.body;

        if (!accessToken || !refreshToken) {
            return sendErrorResponse(res, null, 'Access token and refresh token are required', 400)
        }

        const { data: userAuth, error: authError } = await supabase.auth.getUser(accessToken);

        if (authError || !userAuth?.user) {
            return sendErrorResponse(res, null, 'Invalid or expired access token', 401)
        }

        const user = userAuth.user;
        const providerId = user.user_metadata?.provider_id || user.id;//gitbhub id
console.log("providerId",providerId)
        let drizzleUserId;

        const existingUser = await db.select().from(users).where(eq(users.githubId, providerId)).limit(1);
        console.log(existingUser)

        if (existingUser.length > 0) {
            drizzleUserId = existingUser[0].id;
        }
        else {
            const [newUser] = await db.insert(users).values({
                githubId: providerId,
                username: user.user_metadata?.name || user.email?.split('@')[0] || 'Unknown User',
                email: user.email,
                avatarUrl: user.user_metadata?.avatar_url,
            }).returning(); // Tell Drizzle to return the newly generated UUID

            drizzleUserId = newUser.id;
            const StripeCustomer =  await stripe.customers.create({
                email: newUser.email as string,
                name: newUser.username as string,
                metadata:{
                    drizzleUserId: newUser.id
                }
            })
            await db.update(users).set({
                stripeCustomerId:StripeCustomer.id
            }).where(eq(users.id,drizzleUserId))
            console.log("New user securely stored in Drizzle DB");
        }

        const customAccessToken = jwt.sign({ userId: drizzleUserId, accessToken }, process.env.JWT_SECRET!, { expiresIn: '15m' });
        const customRefreshToken = jwt.sign({ userId: drizzleUserId, refreshToken }, process.env.JWT_SECRET!, { expiresIn: '7d' });

        const hashedRefreshToken = await hashToken(customRefreshToken)

        // Delete any existing tokens for this user to ensure only 1 active session at a time
        await db.delete(refresh_token).where(eq(refresh_token.userId, drizzleUserId));

        await db.insert(refresh_token).values({
            userId: drizzleUserId, // This exactly matches the PostgreSQL users.id FK!
            token_hash: hashedRefreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });


        res.cookie('accessToken', customAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',  // ← true on production
            sameSite: process.env.NODE_ENV === 'production' 
            ? 'none'   // ← MUST be 'none' for cross-origin (Vercel → Render)
            : 'lax',   // ← lax is fine for local

            maxAge: 15 * 60 * 1000
        });

        res.cookie('refreshToken', customRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',  // ← true on production
            sameSite: process.env.NODE_ENV === 'production' 
            ? 'none'   // ← MUST be 'none' for cross-origin (Vercel → Render)
            : 'lax',   // ← lax is fine for local
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
 console.log("Token generated")
        // Ensure ONLY ONE response is sent down
        return sendSuccessResponse(res, existingUser, 'Login Successfully!', 200)
    } catch (error: any) {
        console.error('Error setting token:', error);
        return sendErrorResponse(res, error, error.message, 500)
    }
}//login/register
export const RefreshToken = async (req: Request, res: Response) => {
    const cookieRefreshToken = req.cookies.refreshToken
    
    if (!cookieRefreshToken) return sendErrorResponse(res, null, 'Refresh token not found', 401)


    const newHashedRefreshToken = await hashToken(cookieRefreshToken)
    console.log("newHashedRefreshToken", newHashedRefreshToken)
    const [savedToken] = await db.select().from(refresh_token).where(eq(refresh_token.token_hash, newHashedRefreshToken))
    console.log("savedToken", savedToken)
    if (!savedToken || savedToken.isRevoked) {
        const decode = jwt.decode(cookieRefreshToken) as { userId: string }
        if (decode?.userId) {
            console.log("")
            await db.delete(refresh_token).where(eq(refresh_token.userId, decode.userId))
        }
        res.clearCookie('accessToken')
        res.clearCookie('refreshToken')
        return sendErrorResponse(res, null, "Security breach detected. Please login again.", 403)
    }
    try {
        const decoded = jwt.verify(cookieRefreshToken, process.env.JWT_SECRET!) as { userId: string }
        await db.delete(refresh_token).where(eq(refresh_token.id, savedToken.id))
        const newAccessToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET!, { expiresIn: '15m' })
        const newRefreshToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET!, { expiresIn: '7d' })
        const hashNewRefreshToken = await hashToken(newRefreshToken)
        await db.insert(refresh_token).values({
            userId: decoded.userId,
            token_hash: hashNewRefreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
      const isProduction = process.env.NODE_ENV === 'production';

res.cookie('accessToken', newAccessToken, {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 15 * 60 * 1000
});

res.cookie('refreshToken', newRefreshToken, {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000
});
        return sendSuccessResponse(res, null, 'Token refreshed successfully', 200)

    } catch (error: any) {
        console.error('Error refreshing token:', error);
        return sendErrorResponse(res, error as Record<string, string>, error.message, 500)
    }
}
export const GetUser = async (req: Request, res: Response) => {
    const user = (req as any).userData
    return sendSuccessResponse(res, user, 'User fetched successfully', 200)
}
export const RemoveToken = async (req: Request, res: Response) => {
    const user = (req as any).userData
    if (!user) {
        return sendErrorResponse(res, null, 'User not found', 400)
    }
    await db.update(refresh_token).set({ isRevoked: true }).where(eq(refresh_token.userId, user.id))
    //  await db.delete(refresh_token).where(eq(refresh_token.userId,user.id)).returning()
    console.log("Refresh token update successfully")
    
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const
    };

    res.clearCookie('accessToken', cookieOptions)
    res.clearCookie('refreshToken', cookieOptions)
    return sendSuccessResponse(res, null, 'Logout Successfully!', 200)
}
