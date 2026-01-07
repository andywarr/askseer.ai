import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/**
 * Get the Stripe client instance.
 * Creates a singleton instance on first call.
 * Returns null if STRIPE_SECRET_KEY is not configured.
 */
export function getStripeClient(): Stripe | null {
  const stripeApiKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeApiKey) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(stripeApiKey);
  }

  return stripeClient;
}
