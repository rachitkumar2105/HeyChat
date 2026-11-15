import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { isOriginAllowed } from './config.js';
import type { AppContext } from './context.js';
import { AppError } from './lib/errors.js';
import { errorHandler, limiters } from './lib/http.js';
import { authRoutes } from './routes/auth.js';
import { conversationRoutes, messageRoutes } from './routes/conversations.js';
import { mediaRoutes } from './routes/media.js';
import { userRoutes } from './routes/users.js';

export function createApp(ctx: AppContext) {
  const app = express();
  const startedAt = Date.now();

  app.disable('x-powered-by');
  // Hugging Face terminates TLS in front of the container; trust exactly one proxy hop
  // so rate limiting keys on the real client IP without letting clients spoof it.
  app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger: ctx.log,
      autoLogging: { ignore: (req) => req.url === '/health' || req.url?.startsWith('/media/') === true },
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      serializers: {
        req: (req) => ({ method: req.method, url: String(req.url).split('?')[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  const corsMw = cors({
    origin: (origin, cb) => cb(null, isOriginAllowed(ctx.config, origin)),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });

  app.get('/', (_req, res) => {
    res.json({ name: 'HeyChat API', status: 'ok', docs: 'https://github.com/rachitkumar2105/HeyChat' });
  });

  app.get('/health', async (_req, res) => {
    const db = await ctx.db.ping();
    res.status(db ? 200 : 503).json({
      status: db ? 'ok' : 'degraded',
      db,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      online: ctx.hub.onlineCount,
    });
  });

  app.use('/media', limiters.global, mediaRoutes(ctx));

  const api = express.Router();
  api.use(corsMw);
  api.use(limiters.global);
  api.use(express.json({ limit: '32kb' }));
  api.use('/auth', authRoutes(ctx));
  api.use('/users', userRoutes(ctx));
  api.use('/conversations', conversationRoutes(ctx));
  api.use('/messages', messageRoutes(ctx));
  api.use((_req, _res, next) => next(new AppError(404, 'not_found', 'No such endpoint.')));
  app.use('/api', api);

  app.use((_req, _res, next) => next(new AppError(404, 'not_found', 'No such endpoint.')));
  app.use(errorHandler(ctx));
  return app;
}
