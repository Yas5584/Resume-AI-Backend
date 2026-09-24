import { prisma, SubscriptionTier, Prisma } from "@resumeai/database";
import {
  NormalizedWhopWebhookEvent,
  WhopWebhookHeaders,
  whopPaymentProvider,
} from "../payments/whop.provider.js";

export interface ProcessWhopWebhookResult {
  eventId: string;
  eventType: string;
  duplicate: boolean;
  status: "PROCESSED" | "IGNORED";
  userId?: string | null;
  subscriptionTier?: SubscriptionTier;
  subscriptionStatus?: string;
}

const PRO_CREDITS_GRANT = 100;

const GRANT_PRO_EVENTS = new Set([
  "membership.went_valid",
  "membership.activated",
  "app_membership.went_valid",
  "payment.succeeded",
  "payment.completed",
]);

const REVOKE_PRO_EVENTS = new Set([
  "membership.went_invalid",
  "membership.deactivated",
  "app_membership.went_invalid",
  "payment.canceled",
  "refund.created",
  "dispute.created",
]);

const PAYMENT_FAILED_EVENTS = new Set(["payment.failed"]);

const PERIOD_UPDATE_EVENTS = new Set([
  "membership.cancel_at_period_end_changed",
  "membership.updated",
]);

export class WhopWebhookService {
  /**
   * Resolves a ResumeAI internal user from a normalized Whop webhook event.
   * Priority order:
   * 1. Explicit internal `userId` passed via checkout metadata / custom_fields
   * 2. Existing User with matching `whopUserId`
   * 3. Existing WhopSubscription record with matching `whopMembershipId` or `whopUserId` that has a `userId`
   * 4. Existing User with matching normalized `email`
   */
  async resolveUserForEvent(event: NormalizedWhopWebhookEvent) {
    // 1. By internal userId
    if (event.userId) {
      const byId = await prisma.user.findUnique({
        where: { id: event.userId },
      });
      if (byId) return byId;
    }

    // 2. By whopUserId on User
    if (event.whopUserId) {
      const byWhopUser = await prisma.user.findUnique({
        where: { whopUserId: event.whopUserId },
      });
      if (byWhopUser) return byWhopUser;
    }

    // 3. By existing WhopSubscription mapping
    if (event.whopMembershipId) {
      const existingSub = await prisma.whopSubscription.findUnique({
        where: { whopMembershipId: event.whopMembershipId },
        include: { user: true },
      });
      if (existingSub?.user) return existingSub.user;
    }

    if (event.whopUserId) {
      const existingSubByWhopUser = await prisma.whopSubscription.findFirst({
        where: {
          whopUserId: event.whopUserId,
          userId: { not: null },
        },
        include: { user: true },
      });
      if (existingSubByWhopUser?.user) return existingSubByWhopUser.user;
    }

    // 4. By email fallback
    if (event.email) {
      const byEmail = await prisma.user.findUnique({
        where: { email: event.email.toLowerCase().trim() },
      });
      if (byEmail) return byEmail;
    }

    return null;
  }

  /**
   * Processes a verified Whop webhook payload idempotently.
   */
  async processWebhook(
    rawPayload: unknown,
    headers?: WhopWebhookHeaders,
  ): Promise<ProcessWhopWebhookResult> {
    const normalized = whopPaymentProvider.parseWebhookEvent(
      rawPayload,
      headers,
    );

    // 1. Idempotency check: inspect if this eventId has already been processed
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId: normalized.eventId },
    });

    if (
      existingEvent &&
      (existingEvent.status === "PROCESSED" ||
        existingEvent.status === "IGNORED")
    ) {
      return {
        eventId: normalized.eventId,
        eventType: normalized.eventType,
        duplicate: true,
        status: existingEvent.status as "PROCESSED" | "IGNORED",
        userId: existingEvent.userId,
      };
    }

    // 2. Create or update WebhookEvent record in PROCESSING state
    let webhookRecordId: string;
    try {
      const record = existingEvent
        ? await prisma.webhookEvent.update({
            where: { id: existingEvent.id },
            data: {
              status: "PROCESSING",
              errorMessage: null,
            },
          })
        : await prisma.webhookEvent.create({
            data: {
              provider: "whop",
              eventId: normalized.eventId,
              eventType: normalized.eventType,
              status: "PROCESSING",
              whopUserId: normalized.whopUserId ?? null,
              whopMembershipId: normalized.whopMembershipId ?? null,
              payload: (rawPayload ?? {}) as Prisma.InputJsonValue,
            },
          });
      webhookRecordId = record.id;
    } catch (err: any) {
      // Handle concurrent duplicate delivery hitting unique constraint P2002
      if (err?.code === "P2002") {
        return {
          eventId: normalized.eventId,
          eventType: normalized.eventType,
          duplicate: true,
          status: "PROCESSED",
        };
      }
      throw err;
    }

    try {
      const user = await this.resolveUserForEvent(normalized);
      const userId = user?.id ?? null;

      let finalStatus: "PROCESSED" | "IGNORED" = "PROCESSED";
      let updatedTier: SubscriptionTier | undefined = user?.subscriptionTier;
      let updatedSubStatus: string | undefined = user?.subscriptionStatus;

      const membershipKey =
        normalized.whopMembershipId ||
        (normalized.whopUserId
          ? `whop_user_${normalized.whopUserId}`
          : `whop_evt_${normalized.eventId}`);

      if (GRANT_PRO_EVENTS.has(normalized.eventType)) {
        updatedTier = SubscriptionTier.PRO;
        updatedSubStatus = "active";

        // Upsert WhopSubscription state
        await prisma.whopSubscription.upsert({
          where: { whopMembershipId: membershipKey },
          create: {
            userId,
            whopUserId: normalized.whopUserId ?? null,
            whopMembershipId: membershipKey,
            whopProductId: normalized.whopProductId ?? null,
            whopPlanId: normalized.whopPlanId ?? null,
            email: normalized.email ?? user?.email ?? null,
            status: "active",
            tier: SubscriptionTier.PRO,
            cancelAtPeriodEnd: normalized.cancelAtPeriodEnd ?? false,
            currentPeriodStart: normalized.currentPeriodStart ?? new Date(),
            currentPeriodEnd: normalized.currentPeriodEnd ?? null,
            rawMetadata: normalized.data as Prisma.InputJsonValue,
          },
          update: {
            ...(userId ? { userId } : {}),
            ...(normalized.whopUserId
              ? { whopUserId: normalized.whopUserId }
              : {}),
            ...(normalized.whopProductId
              ? { whopProductId: normalized.whopProductId }
              : {}),
            ...(normalized.whopPlanId
              ? { whopPlanId: normalized.whopPlanId }
              : {}),
            ...(normalized.email ? { email: normalized.email } : {}),
            status: "active",
            tier: SubscriptionTier.PRO,
            ...(normalized.cancelAtPeriodEnd !== undefined
              ? { cancelAtPeriodEnd: normalized.cancelAtPeriodEnd }
              : { cancelAtPeriodEnd: false }),
            ...(normalized.currentPeriodStart
              ? { currentPeriodStart: normalized.currentPeriodStart }
              : {}),
            ...(normalized.currentPeriodEnd
              ? { currentPeriodEnd: normalized.currentPeriodEnd }
              : {}),
            rawMetadata: normalized.data as Prisma.InputJsonValue,
          },
        });

        if (user) {
          const isNewProUpgrade = user.subscriptionTier !== SubscriptionTier.PRO;
          const isPaymentSucceeded =
            normalized.eventType === "payment.succeeded" ||
            normalized.eventType === "payment.completed";

          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionTier: SubscriptionTier.PRO,
              subscriptionStatus: "active",
              ...(normalized.currentPeriodEnd
                ? { subscriptionExpiresAt: normalized.currentPeriodEnd }
                : {}),
              ...(normalized.whopUserId && !user.whopUserId
                ? { whopUserId: normalized.whopUserId }
                : {}),
              ...(normalized.whopMembershipId
                ? { whopMembershipId: normalized.whopMembershipId }
                : {}),
              ...(isNewProUpgrade || isPaymentSucceeded
                ? { creditsBalance: { increment: PRO_CREDITS_GRANT } }
                : {}),
            },
          });
        }
      } else if (REVOKE_PRO_EVENTS.has(normalized.eventType)) {
        updatedTier = SubscriptionTier.FREE;
        updatedSubStatus = "canceled";

        await prisma.whopSubscription.upsert({
          where: { whopMembershipId: membershipKey },
          create: {
            userId,
            whopUserId: normalized.whopUserId ?? null,
            whopMembershipId: membershipKey,
            whopProductId: normalized.whopProductId ?? null,
            whopPlanId: normalized.whopPlanId ?? null,
            email: normalized.email ?? user?.email ?? null,
            status: "canceled",
            tier: SubscriptionTier.FREE,
            cancelAtPeriodEnd: false,
            currentPeriodEnd: normalized.currentPeriodEnd ?? new Date(),
            rawMetadata: normalized.data as Prisma.InputJsonValue,
          },
          update: {
            ...(userId ? { userId } : {}),
            status: "canceled",
            tier: SubscriptionTier.FREE,
            ...(normalized.currentPeriodEnd
              ? { currentPeriodEnd: normalized.currentPeriodEnd }
              : {}),
            rawMetadata: normalized.data as Prisma.InputJsonValue,
          },
        });

        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionTier: SubscriptionTier.FREE,
              subscriptionStatus: "canceled",
              ...(normalized.currentPeriodEnd
                ? { subscriptionExpiresAt: normalized.currentPeriodEnd }
                : {}),
              ...(normalized.whopUserId && !user.whopUserId
                ? { whopUserId: normalized.whopUserId }
                : {}),
            },
          });
        }
      } else if (PAYMENT_FAILED_EVENTS.has(normalized.eventType)) {
        updatedSubStatus = "past_due";

        if (normalized.whopMembershipId) {
          await prisma.whopSubscription.updateMany({
            where: { whopMembershipId: normalized.whopMembershipId },
            data: {
              status: "past_due",
              rawMetadata: normalized.data as Prisma.InputJsonValue,
            },
          });
        }

        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: "past_due",
              ...(normalized.whopUserId && !user.whopUserId
                ? { whopUserId: normalized.whopUserId }
                : {}),
            },
          });
        }
      } else if (PERIOD_UPDATE_EVENTS.has(normalized.eventType)) {
        if (normalized.whopMembershipId) {
          await prisma.whopSubscription.updateMany({
            where: { whopMembershipId: normalized.whopMembershipId },
            data: {
              ...(normalized.cancelAtPeriodEnd !== undefined
                ? { cancelAtPeriodEnd: normalized.cancelAtPeriodEnd }
                : {}),
              ...(normalized.currentPeriodEnd
                ? { currentPeriodEnd: normalized.currentPeriodEnd }
                : {}),
              rawMetadata: normalized.data as Prisma.InputJsonValue,
            },
          });
        }

        if (user && normalized.currentPeriodEnd) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionExpiresAt: normalized.currentPeriodEnd,
            },
          });
        }
      } else {
        // Unrecognized / non-lifecycle Whop event: record as IGNORED
        finalStatus = "IGNORED";
      }

      await prisma.webhookEvent.update({
        where: { id: webhookRecordId },
        data: {
          status: finalStatus,
          userId,
          processedAt: new Date(),
        },
      });

      return {
        eventId: normalized.eventId,
        eventType: normalized.eventType,
        duplicate: false,
        status: finalStatus,
        userId,
        subscriptionTier: updatedTier,
        subscriptionStatus: updatedSubStatus,
      };
    } catch (err: any) {
      await prisma.webhookEvent
        .update({
          where: { id: webhookRecordId },
          data: {
            status: "FAILED",
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        })
        .catch(() => {});
      throw err;
    }
  }

  /**
   * Reconciles any unlinked WhopSubscription records matching the user's email
   * (e.g., when a user completes Whop checkout before registering their ResumeAI account).
   */
  async reconcileUserEntitlements(userId: string, email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const unlinkedActiveSubs = await prisma.whopSubscription.findMany({
      where: {
        email: normalizedEmail,
        userId: null,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (unlinkedActiveSubs.length === 0) return;

    const latestSub = unlinkedActiveSubs[0];
    await prisma.whopSubscription.updateMany({
      where: { email: normalizedEmail, userId: null },
      data: { userId },
    });

    if (latestSub.status === "active" && latestSub.tier === SubscriptionTier.PRO) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionTier: SubscriptionTier.PRO,
          subscriptionStatus: "active",
          ...(latestSub.whopUserId ? { whopUserId: latestSub.whopUserId } : {}),
          whopMembershipId: latestSub.whopMembershipId,
          ...(latestSub.currentPeriodEnd
            ? { subscriptionExpiresAt: latestSub.currentPeriodEnd }
            : {}),
          creditsBalance: { increment: PRO_CREDITS_GRANT },
        },
      });
    }
  }

  /**
   * Backend-enforced entitlement check for Pro features.
   */
  async hasProEntitlement(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!user) return false;

    if (
      user.subscriptionTier === SubscriptionTier.PRO ||
      user.subscriptionTier === SubscriptionTier.ENTERPRISE
    ) {
      if (
        user.subscriptionExpiresAt &&
        user.subscriptionExpiresAt.getTime() < Date.now() &&
        user.subscriptionStatus === "canceled"
      ) {
        return false;
      }
      return true;
    }

    return false;
  }
}

export const whopWebhookService = new WhopWebhookService();
