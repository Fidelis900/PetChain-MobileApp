/**
 * Payment service — backend.
 * FUTURE FEATURE: Actual provider integration (Stripe, Apple IAP, Google Play)
 * is stubbed. The architecture is in place to wire up a real provider.
 */

import { randomUUID } from 'crypto';

import type {
  CreatePaymentInput,
  Payment,
  Subscription,
  SubscriptionPlan,
} from '../models/Payment';
import { SUBSCRIPTION_PLANS } from '../models/Payment';

// In-memory stores (replace with DB repositories when going live)
const payments = new Map<string, Payment>();
const subscriptions = new Map<string, Subscription>();

function now(): string {
  return new Date().toISOString();
}

function periodEnd(plan: SubscriptionPlan): string {
  const d = new Date();
  if (plan === 'premium_annual') {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
}

/**
 * Returns all available subscription plans.
 */
function getPlans() {
  return Object.values(SUBSCRIPTION_PLANS);
}

/**
 * Returns the active subscription for a user, or null if none.
 */
function getSubscription(userId: string): Subscription | null {
  for (const sub of subscriptions.values()) {
    if (sub.userId === userId && sub.status === 'active') return sub;
  }
  return null;
}

/**
 * Stub: initiates a payment intent.
 * In production, call Stripe / Apple IAP / Google Play here.
 */
function initiatePayment(input: CreatePaymentInput): Payment {
  const t = now();
  const payment: Payment = {
    id: randomUUID(),
    userId: input.userId,
    amount: SUBSCRIPTION_PLANS[input.plan].priceMonthly,
    currency: 'USD',
    status: 'pending',
    provider: input.provider,
    providerTransactionId: input.providerTransactionId,
    plan: input.plan,
    createdAt: t,
    updatedAt: t,
  };
  payments.set(payment.id, payment);
  return payment;
}

/**
 * Stub: confirms a payment and activates the subscription.
 * In production, verify the provider webhook / receipt here.
 */
function confirmPayment(paymentId: string): { payment: Payment; subscription: Subscription } {
  const payment = payments.get(paymentId);
  if (!payment) throw new Error('Payment not found');
  if (payment.status !== 'pending') throw new Error('Payment already processed');

  const t = now();
  payment.status = 'completed';
  payment.updatedAt = t;
  payments.set(paymentId, payment);

  // Cancel any existing active subscription for this user
  for (const sub of subscriptions.values()) {
    if (sub.userId === payment.userId && sub.status === 'active') {
      sub.status = 'cancelled';
      sub.updatedAt = t;
      subscriptions.set(sub.id, sub);
    }
  }

  const subscription: Subscription = {
    id: randomUUID(),
    userId: payment.userId,
    plan: payment.plan,
    status: 'active',
    currentPeriodStart: t,
    currentPeriodEnd: periodEnd(payment.plan),
    cancelAtPeriodEnd: false,
    provider: payment.provider,
    createdAt: t,
    updatedAt: t,
  };
  subscriptions.set(subscription.id, subscription);

  return { payment, subscription };
}

/**
 * Cancels a user's active subscription at period end.
 */
function cancelSubscription(userId: string): Subscription {
  const sub = getSubscription(userId);
  if (!sub) throw new Error('No active subscription found');

  const t = now();
  sub.cancelAtPeriodEnd = true;
  sub.updatedAt = t;
  subscriptions.set(sub.id, sub);
  return sub;
}

/**
 * Returns payment history for a user.
 */
function getPaymentHistory(userId: string): Payment[] {
  return [...payments.values()]
    .filter((p) => p.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export default {
  getPlans,
  getSubscription,
  initiatePayment,
  confirmPayment,
  cancelSubscription,
  getPaymentHistory,
};
