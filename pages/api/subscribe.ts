import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2020-03-02' });

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { email, paymentMethodId, priceId } = req.body;

  try {
    const customer = await stripe.customers.create({
      email,
    });

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });

    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      expand: ['latest_invoice.payment_intent'],
    });

    res.send(subscription);
  } catch (error) {
    res.statusCode = 402;
    return res.send({ error: { message: error.message } });
  }
};
