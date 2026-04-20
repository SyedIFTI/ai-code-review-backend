import express, { Request, Response } from 'express'
import { sendErrorResponse, sendSuccessResponse } from '../utils/response'
import Groq from "groq-sdk";
import { getCodeReviewCompletion } from '../services/aiGenServices';
import { db } from '../utils/supabase-db-connection';
import { reviewItems, reviews, users } from '../db/schema';
import { desc, eq } from 'drizzle-orm';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router()
export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post('/review-code', authMiddleware, async (req: Request, res: Response) => {
    let reviewId: string | undefined;
    try {
        const user = (req as any).userData
        const userId = user?.id

        let fullResponse: string = "";//TO SOTRE RESPONSE IN DATABSE 
        let { language, code, id } = req.body
        if (!language || !code) {
            return sendErrorResponse(res, null, 'Language and code are required', 400)
        }

        if (user.role === 'free' && user.dailyReviewCount >= 5 && user.lastReviewDate === new Date().toISOString().split('T')[0]) {
            return sendErrorResponse(res, null, 'Free users are limited to 5 code reviews per day', 400)
        }


        const [review] = await db.insert(reviews).values({
            id: id,
            userId,
            codeSnippet: code,
            language,
            status: 'pending'
        }).returning()
        reviewId = id as string
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        setTimeout(async () => {
            const aiResponse = await getCodeReviewCompletion(language, code)

            // console.log(aiResponse)

            for await (const chunck of aiResponse) {
                const choice = chunck.choices[0]
                const text = choice?.delta?.content
                if (text) {
                    process.stdout.write(text)
                    fullResponse += text
                    res.write(text)
                }
            }

            res.end()

            // 1. Strip markdown formatting if AI wrapped the response
            let cleanedResponse = fullResponse.trim();
            if (cleanedResponse.startsWith("```")) {
                cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*/i, "");
                cleanedResponse = cleanedResponse.replace(/\s*```$/, "");
            }

            // 2. Parse JSON AFTER the stream is completely finished
            const parsedResponse = JSON.parse(cleanedResponse)

            // console.log("parsed Respone", parsedResponse)
            // 3. We use db.transaction with an ASYNC function and await its inner queries.
            await db.transaction(async (tsx) => {
                // Also we should update by specific reviewId, not just any review from that user
                await tsx.update(reviews)
                    .set({ status: 'completed', totalIssues: 1 })
                    .where(eq(reviews.id, reviewId as string))


                const reviewItemData: typeof reviewItems.$inferInsert = {
                    reviewId: reviewId as string,
                    category: parsedResponse.category,
                    severity: parsedResponse.severity,
                    message: parsedResponse.description,
                    lineNumber: parsedResponse.location,
                    suggestion: parsedResponse.recommendation,
                    codeSnippet: parsedResponse.NewCodeVersion?.code


                }
                await tsx.insert(reviewItems).values(reviewItemData)

                if (user.role === 'free' || user.role === 'pro') {
                    await db.update(users).set
                        ({ dailyReviewCount: user.dailyReviewCount + 1, lastReviewDate: new Date().toISOString().split('T')[0] })
                        .where(eq(users.id, user.id))
                }
            })
        }, 10000)
    } catch (error) {
        if (reviewId) {
            await db.update(reviews).set({ status: 'failed' }).where(eq(reviews.id, reviewId))
        }
        console.log(error)
        if (!res.headersSent) {
            return sendErrorResponse(res, error as Record<string, string>, 'Failed to review code', 500)
        } else {
            // Response already initiated, cannot send JSON error
            res.end()
        }
    }
})
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = (req as any).userData
        const userId = user?.id
        const review = await db.select().from(reviews).where(eq(reviews.userId, userId)).orderBy(desc(reviews.createdAt))
        return sendSuccessResponse(res, review, 'Review history fetched successfully')
    } catch (error) {
        console.log(error)
        return sendErrorResponse(res, error as Record<string, string>, 'Failed to fetch review history', 500)
    }
})
router.get('/history/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = (req as any).userData
        const userId = user?.id
        const { id } = req.params
        const reviewData = await db.select().from(reviews).leftJoin(reviewItems, eq(reviews.id, reviewItems.reviewId)).where(eq(reviews.id, id as string))
        // console.log(reviewData)
        const formatedData = {
            reviews: reviewData[0].reviews,
            items: reviewData.filter(r => r.review_items !== null).map(r => r.review_items)
        }
        // console.log(formatedData)
        return sendSuccessResponse(res, formatedData, 'Review history fetched successfully')
    } catch (error) {
        console.log(error)
        return sendErrorResponse(res, error as Record<string, string>, 'Failed to fetch review history', 500)
    }
})

export default router
