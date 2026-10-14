import { env } from './config/env';
import { logger } from './infrastructure/logger/logger';
import { app } from './app';

const server = app.listen(env.PORT, () => {
  logger.info(`API Server running on http://localhost:${env.PORT}`, {
    port: env.PORT,
    environment: env.NODE_ENV,
  });
});

export { server };
