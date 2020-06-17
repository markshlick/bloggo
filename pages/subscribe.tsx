import { FormEvent, useState } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button, Box, Flex, Input, Heading, useThemeUI } from 'theme-ui';
import { stripeSubscriptionPriceId } from 'config/site';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function handleSubscriptionResponse(stripe, { paymentMethodId, priceId, subscription }) {
  const { payment_intent: paymentIntent } = subscription.latest_invoice;

  if (paymentIntent.status === 'requires_action') {
    return stripe
      .confirmCardPayment(paymentIntent.client_secret, {
        payment_method: paymentMethodId,
      })
      .then((result) => {
        if (result.error) {
          // start code flow to handle updating the payment details
          // Display error message in your UI.
          // The card was declined (i.e. insufficient funds, card has expired, etc)
          throw result;
        } else {
          if (result.paymentIntent.status === 'succeeded') {
            // There's a risk of the customer closing the window before callback
            // execution. To handle this case, set up a webhook endpoint and
            // listen to invoice.payment_succeeded. This webhook endpoint
            // returns an Invoice.
            return {
              paymentIntent,
              priceId,
              subscription,
              paymentMethodId,
            };
          }
        }
      });
  } else {
    // No customer action needed
    return { subscription, priceId, paymentMethodId };
  }
}

async function subscribe(
  stripe,
  {
    paymentMethodId,
    priceId,
  }: {
    paymentMethodId: string;
    priceId: string;
  }
) {
  const result = await (
    await fetch('/api/subscribe', {
      method: 'post',
      headers: {
        'Content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'markshlick@gmail.com',
        paymentMethodId,
        priceId,
      }),
    })
  ).json();

  if (result.error) {
    throw result;
  }

  return handleSubscriptionResponse(stripe, { paymentMethodId, priceId, subscription: result });
}

const CheckoutForm = () => {
  const [isFormDisabled, setIsFormDisabled] = useState(false);
  const { theme } = useThemeUI();
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

    setIsFormDisabled(true);
    try {
      const result = await subscribe(stripe, {
        paymentMethodId: paymentMethod!.id,
        priceId: stripeSubscriptionPriceId,
      });
    } catch (error) {
    } finally {
      setIsFormDisabled(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Box my="3">
        <Heading>Subscribe for $1.50/mo</Heading>
      </Box>
      <Box my="3">
        <Input type="email" name="email" id="email" placeholder="you@email.co" />
      </Box>
      <Box
        my="3"
        py="2"
        px="2"
        sx={{
          borderColor: 'text',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderRadius: '5px',
        }}
      >
        <CardElement
          options={{
            style: {
              base: {
                fontSize: theme!.fontSizes![2] + 'px',
                lineHeight: '28px',
                fontFamily: (theme!.fonts as Record<string, string>).body,
              },
            },
          }}
        />
      </Box>
      <Flex sx={{ justifyContent: 'flex-end' }}>
        <Box>
          <Button type="submit" disabled={!stripe || isFormDisabled}>
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
