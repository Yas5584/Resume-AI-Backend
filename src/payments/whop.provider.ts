import {
  PaymentProvider,
  CheckoutSessionOptions,
  CheckoutSessionResult,
  WebhookEventPayload,
} from "./payment.interface.js";

export class WhopPaymentProvider implements PaymentProvider {
  readonly providerName = "whop" as const;

  async createCheckoutSession(
    _options: CheckoutSessionOptions,
  ): Promise<CheckoutSessionResult> {
    throw new Error("Whop integration planned for future phase.");
  }

  verifyWebhookSignature(_rawBody: string, _signature: string): boolean {
    return false;
  }

  parseWebhookEvent(_payload: unknown): WebhookEventPayload {
    throw new Error("Whop webhook parsing planned for future phase.");
  }
}
