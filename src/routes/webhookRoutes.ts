import express from 'express';
import { stripe } from '../utils/stripe';
import { db } from '../utils/supabase-db-connection';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']!;
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session: any = event.data.object;

    if (session.subscription) {
      // Stripe sessions don't include expiry dates or line items by default.
      // We must retrieve the actual subscription object to extract those!
      const subscription: any = await stripe.subscriptions.retrieve(session.subscription as string);

      const expiryUnix = subscription?.current_period_end;
      const safeExpiryDate = expiryUnix ? new Date(expiryUnix * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // fallback to 30 days if undefined

      const priceId = subscription?.items?.data?.[0]?.price?.id || null;

      await db.update(users)
        .set({
          subscriptionStatus: 'active',
          stripePriceId: priceId,
          subscriptionExpiryDate: safeExpiryDate,
          role: 'pro'
        })
        .where(eq(users.stripeCustomerId, session.customer as string));
    }
  }

  // Handle cancellation/expired subscription
  if (event.type === 'customer.subscription.deleted') {
    const subscription: any = event.data.object;
    await db.update(users)
      .set({ subscriptionStatus: 'canceled', role: 'free', subscriptionExpiryDate: null, stripePriceId: null })
      .where(eq(users.stripeCustomerId, subscription.customer));
  }

  res.json({ received: true });
});

export default router;