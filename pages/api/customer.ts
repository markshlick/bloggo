import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2020-03-02' });

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const customer = await stripe.customers.create({
    email: req.body.email,
  });

  res.send({ customer });
};
