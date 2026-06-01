import express from 'express';

import { ok, sendError } from '../../server/response';
import {
  getMetrics,
  predictChurn,
  recordEvent,
  updateEngagement,
  type SubscriptionEvent,
} from '../services/subscriptionAnalyticsService';

const router = express.Router();

/**
 * POST /api/subscriptions/events
 * Record a subscription lifecycle event (trial_start, conversion, renewal, cancellation).
 */
router.post('/events', (req, res) => {
  const body = req.body as Partial<SubscriptionEvent>;

  if (!body.userId?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'userId is required');
  }
  if (!body.type) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'type is required');
  }
  if (!['trial_start', 'conversion', 'renewal', 'cancellation'].includes(body.type)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid event type');
  }
  if (!body.plan || !['monthly', 'annual'].includes(body.plan)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'plan must be monthly or annual');
  }
  if (typeof body.amount !== 'number' || body.amount < 0) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'amount must be a non-negative number');
  }

  const event: SubscriptionEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    userId: body.userId.trim(),
    type: body.type,
    plan: body.plan,
    amount: body.amount,
    timestamp: body.timestamp ?? Date.now(),
    metadata: body.metadata,
  };

  recordEvent(event);
  return res.status(201).json(ok(event, 'Event recorded'));
});

/**
 * GET /api/subscriptions/metrics
 * Returns MRR, ARR, churn rate, LTV, and at-risk subscribers.
 * Optional query param: windowDays (default 30)
 */
router.get('/metrics', (req, res) => {
  const windowDays = Number(req.query.windowDays) || 30;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return res.json(ok(getMetrics(windowMs)));
});

/**
 * GET /api/subscriptions/churn-predictions
 * Returns churn risk predictions for all active subscribers.
 */
router.get('/churn-predictions', (_req, res) => {
  return res.json(ok(predictChurn()));
});

/**
 * PUT /api/subscriptions/engagement/:userId
 * Update engagement signals for a subscriber.
 */
router.put('/engagement/:userId', (req, res) => {
  const { userId } = req.params;
  const { loginCount, featureUsageCount, supportTickets, lastActivityAt } = req.body as {
    loginCount?: number;
    featureUsageCount?: number;
    supportTickets?: number;
    lastActivityAt?: number;
  };

  updateEngagement(userId, {
    ...(loginCount !== undefined ? { loginCount } : {}),
    ...(featureUsageCount !== undefined ? { featureUsageCount } : {}),
    ...(supportTickets !== undefined ? { supportTickets } : {}),
    ...(lastActivityAt !== undefined ? { lastActivityAt } : {}),
  });

  return res.json(ok(null, 'Engagement updated'));
});

export default router;
