import { FormEvent } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button, Box, Flex } from 'theme-ui';

const stripePromise = loadStripe(process.env.STRIPE_PUBLISHABLE_KEY!);

const priceId = 'price_HN5nSr1Tz57uBO';

async function signup(): Promise<{ customer: { id: string } }> {
  return await (
    await fetch('/api/customer', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'markshlick@gmail.com',
      }),
    })
  ).json();
}

function subscribe({
  customerId,
  paymentMethodId,
  priceId,
}: {
  customerId: string;
  paymentMethodId: string;
  priceId: string;
}) {
  return (
    fetch('/api/subscribe', {
      method: 'post',
      headers: {
        'Content-type': 'application/json',
      },
      body: JSON.stringify({
        customerId,
        paymentMethodId,
        priceId,
      }),
    })
      .then((response) => {
        return response.json();
      })
      // If the card is declined, display an error to the user.
      .then((result) => {
        if (result.error) {
          // The card had an error when trying to attach it to a customer
          throw result;
        }
        return result;
      })
      // Normalize the result to contain the object returned
      // by Stripe. Add the addional details we need.
      .then((result) => {
        return {
          // Use the Stripe 'object' property on the
          // returned result to understand what object is returned.
          subscription: result,
          paymentMethodId: paymentMethodId,
          priceId: priceId,
        };
      })
    // Some payment methods require a customer to do additional
    // authentication with their financial institution.
    // Eg: 2FA for cards.
    // .then(handleCustomerActionRequired)
    // If attaching this card to a Customer object succeeds,
    // but attempts to charge the customer fail. You will
    // get a requires_payment_method error.
    // .then(handlePaymentMethodRequired)
  );
}

const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // Block native form submission.
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    // Get a reference to a mounted CardElement. Elements knows how
    // to find your CardElement because there can only ever be one of
    // each type of element.
    const cardElement = elements.getElement(CardElement);

    // Use your card Element with other Stripe.js APIs
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement!,
    });

    if (error) {
      console.log('[error]', error);
      return;
    }

    const { customer } = await signup();

    await subscribe({ customerId: customer.id, paymentMethodId: paymentMethod!.id, priceId });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Box my="3">
        <CardElement />
      </Box>
      <Flex sx={{ justifyContent: 'flex-end' }}>
        <Box>
          <Button type="submit" disabled={!stripe}>
            Subscribe
          </Button>
        </Box>
      </Flex>
    </form>
  );
};

const Subscribe = () => {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  );
};

export default Subscribe;
