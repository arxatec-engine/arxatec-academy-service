import type { Server } from 'node:http';

import { createApp } from '@/app/create_app';
import { closeMailTransporter } from '@/config/email';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { disconnectPrisma } from '@/config/prisma_client';
import { SystemMessages } from '@/constants/messages/system';
import { CloseableNames, ProcessEvents, ServerPolicy, ShutdownSignals } from '@/constants/server';

interface Closeable {
  name: string;
  close: () => void | Promise<void>;
}

const closeables: Closeable[] = [];

let shuttingDown = false;

const registerCloseable = (closeable: Closeable): void => {
  closeables.push(closeable);
};

const closeHttpServer = async (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();

        return;
      }

      reject(error);
    });
  });

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, SystemMessages.server_shutdown_started);

  const watchdog = setTimeout(() => {
    process.exit(1);
  }, ServerPolicy.shutdown_timeout_seconds * 1000);

  watchdog.unref();

  for (const closeable of [...closeables].reverse()) {
    try {
      await closeable.close();
    } catch (error: unknown) {
      logger.error({ err: error, resource: closeable.name }, SystemMessages.server_shutdown_failed);
    }
  }

  clearTimeout(watchdog);
  logger.info(SystemMessages.server_shutdown_finished);
  process.exitCode = 0;
};

const start = (): void => {
  registerCloseable({ name: CloseableNames.mail_transport, close: closeMailTransporter });
  registerCloseable({
    name: CloseableNames.prisma,
    close: async () => {
      await disconnectPrisma();
      logger.info(SystemMessages.prisma_disconnected);
    },
  });

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, node_env: env.NODE_ENV }, SystemMessages.server_listening);
  });

  registerCloseable({
    name: CloseableNames.http_server,
    close: () => closeHttpServer(server),
  });

  for (const signal of ShutdownSignals) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }

  process.on(ProcessEvents.uncaught_exception, (error: Error) => {
    logger.fatal({ err: error }, SystemMessages.unhandled_error);
    void shutdown(ProcessEvents.uncaught_exception);
  });

  process.on(ProcessEvents.unhandled_rejection, (reason: unknown) => {
    logger.fatal({ err: reason }, SystemMessages.unhandled_error);
    void shutdown(ProcessEvents.unhandled_rejection);
  });
};

start();
