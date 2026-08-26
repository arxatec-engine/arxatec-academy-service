import cookieParser from 'cookie-parser';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import passport from 'passport';

import { FilesRoutePrefix, HealthEndpoints } from '@/constants/endpoints';
import { SystemMessages } from '@/constants/messages/system';
import { ServerPolicy } from '@/constants/server';
import { corsHandler } from '@/middlewares/cors_handler';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { httpLogger } from '@/middlewares/http_logger';
import { localFiles } from '@/middlewares/local_files';
import { requestId } from '@/middlewares/request_id';
import { routes } from '@/routes/index';

const ping = (_req: Request, res: Response): void => {
  res.send(SystemMessages.ping);
};

export const createApp = (): Express => {
  const app = express();

  app.set('trust proxy', ServerPolicy.trust_proxy_hops);
  app.use(helmet());
  app.use(requestId);
  app.use(cookieParser());
  app.use(httpLogger);
  app.use(corsHandler);
  app.use(express.json({ limit: ServerPolicy.json_body_limit }));
  app.use(express.urlencoded({ extended: true, limit: ServerPolicy.url_encoded_body_limit }));
  app.use(passport.initialize());
  app.get(HealthEndpoints.ping, ping);
  app.use(FilesRoutePrefix, localFiles);
  app.use(routes);

  registerErrorHandler(app);

  return app;
};
