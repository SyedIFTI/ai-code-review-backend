import express from 'express';
import { createCheckoutSession, createCustomerPortalSession, cancelSubscription } from '../controllers/stripeController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

// Route to generate a new checkout session. Protected by auth logic.
router.post('/create-checkout', authMiddleware, createCheckoutSession);
router.post('/create-portal', authMiddleware, createCustomerPortalSession);
router.post('/cancel-subscription', authMiddleware, cancelSubscription);

export default router;
