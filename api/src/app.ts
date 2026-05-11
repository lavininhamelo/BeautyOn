import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import * as Sentry from '@sentry/node';
import { tmpUploadsDir } from './lib/paths.js';
import type { Request, Response, NextFunction } from 'express';
import routes from './routes.js';
import sentryConfig, { sentryEnabled } from './config/sentry.js';
import { corsConfig } from './config/cors.js';
import './config/queue.js';

class App {
  public server: express.Express;

  constructor() {
    this.server = express();

    if (sentryEnabled) {
      Sentry.init(sentryConfig);
    }

    this.middlewares();
    this.routes();
    this.exceptionHandler();
  }

  middlewares() {
    if (sentryEnabled) {
      const sentryRequestHandler = (Sentry as any)?.Handlers?.requestHandler?.();
      if (sentryRequestHandler) {
        this.server.use(sentryRequestHandler);
      }
    }

    this.server.use(cors(corsConfig));
    this.server.use(express.json());
    this.server.use('/files', express.static(tmpUploadsDir));
  }

  routes() {
    this.server.use(routes);
    if (sentryEnabled) {
      const sentryErrorHandler = (Sentry as any)?.Handlers?.errorHandler?.();
      if (sentryErrorHandler) {
        this.server.use(sentryErrorHandler);
      }
    }
  }

  exceptionHandler() {
    this.server.use(async (err: unknown, req: Request, res: Response, _next: NextFunction) => {
      if (process.env.NODE_ENV === 'development') {
        const { Youch } = await import('youch');

        const youch = new Youch();
        const output = await youch.toJSON(err);

        return res.status(500).json(output);
      }

      return res.status(500).json({ error: 'Internal server error' });
    });
  }
}

export default new App().server;