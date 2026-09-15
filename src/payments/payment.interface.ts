export interface CheckoutSessionOptions {
  userId: string;
  userEmail: string;
  planTier: "PRO" | "ENTERPRISE";
  creditsToPurchase?: number;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
}

export interface WebhookEventPayload {
  eventId: string;
  eventType: string;
  userId?: string;
  data: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly providerName: "lemonsqueezy" | "whop";
  createCheckoutSession(
    options: CheckoutSessionOptions,
  ): Promise<CheckoutSessionResult>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  parseWebhookEvent(payload: unknown): WebhookEventPayload;
}
