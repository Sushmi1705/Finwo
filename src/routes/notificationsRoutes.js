import express from 'express';
import {
  listNotifications,
  markNotificationRead,
  performNotificationAction,
  deleteNotification,
  markReadBulk,
} from '../controllers/notificationsController.js';

const router = express.Router();

// list
router.get('/', listNotifications);

// mark single read
router.post('/:id/read', markNotificationRead);

// perform action (review / cancel / view)
router.post('/:id/action', performNotificationAction);

// delete (soft)
router.delete('/:id', deleteNotification);

// bulk mark read
router.post('/mark-read-bulk', markReadBulk);

export default router;