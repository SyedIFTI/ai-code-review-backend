import { stripe } from '../utils/stripe';

export const createCheckoutSession = async (priceId: string, customerId?: string, clientReferenceId?: string) => {
    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription', // or 'payment' if one-time
            payment_method_types: ['card'],
            customer: customerId,
            client_reference_id: clientReferenceId, // typically your DB user id
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/cancel`,
        });

        return session;
    } catch (error) {
        throw error;
    }
};

export const handleWebhookEvent = async (event: any) => {
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            // Handle successful checkout (e.g. grant pro access)
            console.log('Checkout completed for user:', session.client_reference_id);
            break;
        case 'invoice.payment_succeeded':
            const invoice = event.data.object;
            // Handle recurring subscription payment 
            console.log('Invoice payment succeeded:', invoice.id);
            break;
        case 'customer.subscription.deleted':
            const subscription = event.data.object;
            // Handle subscription cancellation
            console.log('Subscription deleted:', subscription.id);
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }
};
