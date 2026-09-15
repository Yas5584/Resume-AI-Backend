import {
  PaymentProvider,
  CheckoutSessionOptions,
  CheckoutSessionResult,
  WebhookEventPayload,
} from "./payment.interface.js";

export class LemonSqueezyPaymentProvider implements PaymentProvider {
  readonly providerName = "lemonsqueezy" as const;

  async createCheckoutSession(
    _options: CheckoutSessionOptions,
  ): Promise<CheckoutSessionResult> {
    throw new Error("Lemon Squeezy integration planned for future phase.");
  }

  verifyWebhookSignature(_rawBody: string, _signature: string): boolean {
    return false;
  }

  parseWebhookEvent(_payload: unknown): WebhookEventPayload {
    throw new Error("Lemon Squeezy webhook parsing planned for future phase.");
  }
}
