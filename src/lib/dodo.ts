import DodoPayments from "dodopayments";

export const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY,
  environment: "test_mode",
});

export async function createCheckoutSession(
  contractorId: string,
  amountUsd: number,
  ownerEmail: string,
  ownerId: string
) {
  const amountInCents = Math.round(amountUsd * 100);

  const session = await dodo.checkoutSessions.create({
    product_cart: [
      {
        product_id: process.env.DODO_PAYOUT_PRODUCT_ID!,
        quantity: 1,
        amount: amountInCents,
      },
    ],
    metadata: {
      contractor_id: contractorId,
      amount_usd: String(amountUsd),
      owner_id: ownerId,
    },
    customer: {
      email: ownerEmail,
      name: ownerEmail.split("@")[0],
    },
    return_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?payout=success`,
  });

  return session;
}

export async function createBulkCheckoutSession(
  bulkPayoutId: string,
  totalAmountUsd: number,
  ownerEmail: string,
  ownerId: string
) {
  const amountInCents = Math.round(totalAmountUsd * 100);

  const session = await dodo.checkoutSessions.create({
    product_cart: [
      {
        product_id: process.env.DODO_PAYOUT_PRODUCT_ID!,
        quantity: 1,
        amount: amountInCents,
      },
    ],
    metadata: {
      bulk_payout_id: bulkPayoutId,
      amount_usd: String(totalAmountUsd),
      owner_id: ownerId,
      is_bulk: "true",
    },
    customer: {
      email: ownerEmail,
      name: ownerEmail.split("@")[0],
    },
    return_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?payout=bulk`,
  });

  return session;
}
