import 'dotenv/config';

import express from 'express';
import { join } from 'node:path';
import cors from 'cors';
import * as Sentry from '@sentry/node';
import { webBuildDir } from './lib/paths.js';
import FileController from './app/Controllers/FileController.js';
import type { Request, Response, NextFunction } from 'express';
import routes from './routes.js';
import sentryConfig, { sentryEnabled } from './config/sentry.js';
import { corsConfig } from './config/cors.js';
import { requestLogger } from './app/Middlewares/requestLogger.js';
import { log } from './lib/logger.js';
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

    this.server.use(requestLogger);
    this.server.use(cors(corsConfig));
    this.server.use(express.json());
    this.server.get('/files/:id', FileController.download.bind(FileController));
  }

  routes() {
    this.server.use('/api', routes);

    if (webBuildDir) {
      const buildDir = webBuildDir;
      this.server.use(express.static(buildDir));
      this.server.get(/^\/(?!api\/|files\/).*/, (_req: Request, res: Response) => {
        res.sendFile(join(buildDir, 'index.html'));
      });
    }

    if (sentryEnabled) {
      const sentryErrorHandler = (Sentry as any)?.Handlers?.errorHandler?.();
      if (sentryErrorHandler) {
        this.server.use(sentryErrorHandler);
      }
    }
  }

  exceptionHandler() {
    this.server.use(async (err: unknown, req: Request, res: Response, _next: NextFunction) => {
      log.error(`unhandled: ${req.method} ${req.originalUrl}`, err);
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
