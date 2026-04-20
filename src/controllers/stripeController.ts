import { Request, Response } from 'express';
import { sendErrorResponse, sendSuccessResponse } from '../utils/response';
import * as stripeService from '../services/stripeService';
import { stripe } from '../utils/stripe';
import { eq } from 'drizzle-orm';
import { db } from '../utils/supabase-db-connection';
import { users } from '../db/schema';

export const createCheckoutSession = async (req: Request, res: Response) => {
    try {
        const user = (req as any).userData;
        const { priceId } = req.body;

        if (!priceId) {
            return sendErrorResponse(res, null, 'Price ID is required', 400);
        }

        let customerId = user.stripeCustomerId;

        if (!customerId) {
            const StripeCustomer = await stripe.customers.create({
                email: user.email as string,
                metadata: {
                    drizzleUserId: user.id
                }
            })
            await db.update(users).set({
                stripeCustomerId: StripeCustomer.id
            }).where(eq(users.id, user.id));

            customerId = StripeCustomer.id;
        }

        const session = await stripe.checkout.sessions.create({
            customer: customerId, // Ensure this was created at signup
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId, // Dynamically use the price based on what button was clicked
                    quantity: 1,
                }
            ],
            mode: 'subscription',
            success_url: `http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `http://localhost:5173/cancel`,
        })
        sendSuccessResponse(res, { url: session.url }, 'Checkout session created successfully', 200);
    } catch (error) {
        sendErrorResponse(res, error as Record<string, string>, 'Failed to create checkout session', 500);
    }
}

export const createCustomerPortalSession = async (req: Request, res: Response) => {
    try {
        const user = (req as any).userData;
        const customerId = user.stripeCustomerId;

        if (!customerId) {
            return sendErrorResponse(res, null, 'No active Stripe customer found', 400);
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription`,
        });

        sendSuccessResponse(res, { url: session.url }, 'Customer portal created', 200);
    } catch (error) {
        sendErrorResponse(res, error as Record<string, string>, 'Failed to create customer portal session', 500);
    }
};

export const cancelSubscription = async (req: Request, res: Response) => {
    try {
        const user = (req as any).userData;
        const customerId = user.stripeCustomerId;

        if (!customerId) {
            return sendErrorResponse(res, null, 'No active Stripe customer found', 400);
        }

        // Fetch active subscriptions
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'active'
        });

        if (subscriptions.data.length === 0) {
            return sendErrorResponse(res, null, 'No active subscription found to cancel', 400);
        }

        // Cancel the actual active subscription at period end
        const canceledStatus = await stripe.subscriptions.update(subscriptions.data[0].id, {
            cancel_at_period_end: true
        });

        sendSuccessResponse(res, { status: canceledStatus.status }, 'Subscription successfully canceled', 200);
    } catch (error) {
        sendErrorResponse(res, error as Record<string, string>, 'Failed to cancel subscription', 500);
    }
};