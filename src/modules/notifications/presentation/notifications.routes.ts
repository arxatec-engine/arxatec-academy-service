import { Router } from 'express';

import { AdminNotificationEndpoints, NotificationEndpoints } from '@/constants/endpoints';
import { NotificationMessages } from '@/constants/messages/notifications';
import { NotificationRateLimits } from '@/constants/notifications';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { optionalAuthenticate } from '@/middlewares/optional_authenticate';
import { createRateLimiter, emailKey, userKey } from '@/middlewares/rate_limit';
import { requireAdmin } from '@/middlewares/require_admin';
import {
  createSignupController, createTopicController, deleteSubscriberController,
  exportSignupsController, listSignupsController, listTopicsController, notifySignupsController,
} from '@/modules/notifications/presentation/notifications.controller';

export const notificationsRouter: Router = Router();
const publicIpLimit = createRateLimiter({ definition: NotificationRateLimits.public_by_ip,
  description: NotificationMessages.rate_limited });
const publicEmailLimit = createRateLimiter({ definition: NotificationRateLimits.public_by_email,
  description: NotificationMessages.rate_limited, keyBy: (req) => req.user?.email ?? emailKey(req) });
notificationsRouter.post(NotificationEndpoints.signups,
  optionalAuthenticate, publicIpLimit, publicEmailLimit, createSignupController);
notificationsRouter.post(NotificationEndpoints.topics,
  optionalAuthenticate, publicIpLimit, publicEmailLimit, createTopicController);

export const adminNotificationsRouter: Router = Router();
adminNotificationsRouter.use(authenticateTokenJwt, requireAdmin);
adminNotificationsRouter.get(AdminNotificationEndpoints.signups, listSignupsController);
adminNotificationsRouter.get(AdminNotificationEndpoints.export, createRateLimiter({
  definition: NotificationRateLimits.export, description: NotificationMessages.export_limited,
  keyBy: userKey,
}), exportSignupsController);
adminNotificationsRouter.post(AdminNotificationEndpoints.notify, notifySignupsController);
adminNotificationsRouter.get(AdminNotificationEndpoints.topics, listTopicsController);
adminNotificationsRouter.delete(AdminNotificationEndpoints.subscribers, deleteSubscriberController);
