import Joi from 'joi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

dayjs.extend(relativeTime);


/**
 * Utility: compute human-friendly time (e.g., "2m", "1h", "Yesterday")
 * We keep it short like your UI: "2m", "50m", "1h", "2d"
 */
function timeAgoShort(date) {
  if (!date) return null;
  const d = dayjs(date);
  const now = dayjs();
  const diffMinutes = Math.abs(now.diff(d, 'minute'));
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.abs(now.diff(d, 'hour'));
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.abs(now.diff(d, 'day'));
  return `${diffDays}d`;
}

/**
 * Build UI-friendly "action buttons" for a notification.
 * You can extend rules here to match your UI behaviour.
 * Each action should provide an `actionType` so the client knows what to do.
 */
function buildActionsForNotification(notification) {
  // notification.type: 'review', 'payment', 'cashback', 'promo', etc.
  // notification.meta: JSON object (shopId, paymentId, link etc.)
  const actions = [];

  // If notification invites a review for a shop
  if (notification.type === 'review' && notification.meta && notification.meta.shopId) {
    actions.push({
      actionType: 'review',
      label: 'Review',
      // payload for client to call /api/notifications/:id/action or navigate to review screen
      payload: { shopId: notification.meta.shopId, notificationId: notification.id },
    });
  }

  // If it's a payment that can be canceled (depends on business rules)
  if (notification.type === 'payment' && notification.meta && notification.meta.paymentId) {
    // If payment is pending or failed, allow cancel/resolve
    if (notification.meta.status && ['pending', 'processing', 'failed'].includes(notification.meta.status)) {
      actions.push({
        actionType: 'cancel_payment',
        label: 'Cancel',
        payload: { paymentId: notification.meta.paymentId, notificationId: notification.id },
      });
    }
  }

  // generic actions: view details
  actions.push({
    actionType: 'view',
    label: 'View',
    payload: { notificationId: notification.id, link: notification.meta?.link || null },
  });

  return actions;
}

/**
 * GET /api/notifications
 * Query params:
 *  - userId (required)
 *  - page (optional, default 1)
 *  - limit (optional, default 20)
 *  - unreadOnly (optional, bool)
 *  - types (optional, comma-separated list of notification types to filter)
 */
export async function listNotifications(req, res) {
  try {
    const schema = Joi.object({
      userId: Joi.string().required(),
      page: Joi.number().integer().min(1).optional().default(1),
      limit: Joi.number().integer().min(1).max(200).optional().default(20),
      unreadOnly: Joi.boolean().optional().default(false),
      types: Joi.string().optional(), // comma separated
    });

    const { error, value } = schema.validate(req.query);
    if (error) return res.status(400).json({ error: error.message });

    const { userId, page, limit, unreadOnly, types } = value;
    const skip = (page - 1) * limit;

    const where = { userId, isDeleted: false };
    if (unreadOnly) where.isRead = false;
    if (types) {
      const typeArr = types.split(',').map(t => t.trim()).filter(Boolean);
      if (typeArr.length) where.type = { in: typeArr };
    }

    // Page count - use count separately for pagination meta (fast)
    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          body: true,
          type: true,
          amount: true,
          meta: true,        // JSON field (shopId/paymentId/link etc.)
          isRead: true,
          isActionable: true,
          createdAt: true,
        },
      }),
    ]);

    // Map notifications to UI shape
    const mapped = notifications.map((n) => {
      const meta = n.meta || {};
      const actions = buildActionsForNotification({ ...n, meta });

      return {
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        amount: typeof n.amount === 'number' ? Number(n.amount.toFixed(2)) : null,
        meta,
        isRead: n.isRead,
        isActionable: n.isActionable ?? actions.length > 0,
        actions,                  // client will render Review / Cancel / View etc.
        timeAgo: timeAgoShort(n.createdAt),
        createdAt: n.createdAt,
      };
    });

    return res.json({
      total,
      page,
      limit,
      returned: mapped.length,
      notifications: mapped,
    });
  } catch (err) {
    console.error('listNotifications error', err);
    return res.status(500).json({ error: 'Failed to list notifications', message: err.message });
  }
}

/**
 * POST /api/notifications/:id/read
 * Mark a notification as read
 */
export async function markNotificationRead(req, res) {
  try {
    const schema = Joi.object({
      id: Joi.string().required(),
    }).unknown(true);

    const { error, value } = schema.validate({ id: req.params.id });
    if (error) return res.status(400).json({ error: error.message });

    const id = value.id;

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
      select: { id: true, isRead: true },
    });

    return res.json({ success: true, notification: updated });
  } catch (err) {
    console.error('markNotificationRead error', err);
    if (err.code === 'P2025') return res.status(404).json({ error: 'Notification not found' });
    return res.status(500).json({ error: 'Failed to mark read', message: err.message });
  }
}

/**
 * POST /api/notifications/:id/action
 * Generic endpoint to perform actions like `review` or `cancel_payment` from notification actions.
 * Body: { actionType: 'review'|'cancel_payment'|'view', payload: {...} }
 */
export async function performNotificationAction(req, res) {
  try {
    const schema = Joi.object({
      id: Joi.string().required(),
      actionType: Joi.string().required(),
      payload: Joi.object().optional().default({}),
    });

    const { error, value } = schema.validate({ id: req.params.id, ...req.body });
    if (error) return res.status(400).json({ error: error.message });

    const { id, actionType, payload } = value;

    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, type: true, meta: true, isRead: true },
    });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    // Example action handlers. Expand to match business logic.
    if (actionType === 'review') {
      // Create a placeholder review record or return an object for client to open Review UI.
      // We'll return a "reviewToken" that the client can use to navigate.
      if (!notification.meta?.shopId) return res.status(400).json({ error: 'No shop linked to review' });

      // Option: create a ReviewDraft row (if you have one) or simply mark notification as read and return shopId
      // Here we'll mark notification read and return the shopId for client to open review screen
      await prisma.notification.update({ where: { id }, data: { isRead: true } });

      return res.json({ success: true, action: 'review', shopId: notification.meta.shopId });
    }

    if (actionType === 'cancel_payment') {
      // business flow: cancel a pending payment via Payment table integration
      const paymentId = notification.meta?.paymentId || payload?.paymentId;
      if (!paymentId) return res.status(400).json({ error: 'No paymentId provided' });

      // Attempt to set payment status to 'cancelled' if currently cancellable
      const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { id: true, status: true } });
      if (!payment) return res.status(404).json({ error: 'Payment not found' });

      if (!['pending', 'processing', 'failed'].includes(payment.status)) {
        return res.status(400).json({ error: 'Payment cannot be cancelled in its current state' });
      }

      await prisma.payment.update({ where: { id: paymentId }, data: { status: 'cancelled' } });

      // mark notification read and optionally note cancellation
      await prisma.notification.update({ where: { id }, data: { isRead: true } });

      return res.json({ success: true, action: 'cancel_payment', paymentId });
    }

    // fallback for view or unknown actions
    if (actionType === 'view') {
      // mark read
      await prisma.notification.update({ where: { id }, data: { isRead: true } });
      return res.json({ success: true, action: 'view', meta: notification.meta });
    }

    return res.status(400).json({ error: `Unknown actionType: ${actionType}` });
  } catch (err) {
    console.error('performNotificationAction error', err);
    return res.status(500).json({ error: 'Failed to perform action', message: err.message });
  }
}

/**
 * DELETE /api/notifications/:id
 * Soft-delete a notification (isDeleted = true)
 */
export async function deleteNotification(req, res) {
  try {
    const schema = Joi.object({ id: Joi.string().required() });
    const { error, value } = schema.validate({ id: req.params.id });
    if (error) return res.status(400).json({ error: error.message });

    const id = value.id;
    const deleted = await prisma.notification.update({
      where: { id },
      data: { isDeleted: true },
      select: { id: true, isDeleted: true },
    });

    return res.json({ success: true, notification: deleted });
  } catch (err) {
    console.error('deleteNotification error', err);
    if (err.code === 'P2025') return res.status(404).json({ error: 'Notification not found' });
    return res.status(500).json({ error: 'Failed to delete notification', message: err.message });
  }
}

/**
 * POST /api/notifications/mark-read-bulk
 * Body: { userId: string, ids?: string[] }  - if ids omitted, mark all unread for user as read
 */
export async function markReadBulk(req, res) {
  try {
    const schema = Joi.object({
      userId: Joi.string().required(),
      ids: Joi.array().items(Joi.string()).optional(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const { userId, ids } = value;
    const where = { userId, isDeleted: false, isRead: false };
    if (Array.isArray(ids) && ids.length) where.id = { in: ids };

    const result = await prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });

    return res.json({ success: true, updated: result.count });
  } catch (err) {
    console.error('markReadBulk error', err);
    return res.status(500).json({ error: 'Failed to mark read bulk', message: err.message });
  }
}