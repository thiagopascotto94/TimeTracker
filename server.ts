import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initDb } from './server/db';
import { initRedis } from './server/cache';
import { authRouter } from './server/routes/auth';
import { sessionsRouter } from './server/routes/sessions';
import { tasksRouter } from './server/routes/tasks';
import { reportsRouter } from './server/routes/reports';
import { publicRouter } from './server/routes/public';
import { clientsRouter } from './server/routes/clients';
import { aiRouter } from './server/routes/ai';
import { gitRouter } from './server/routes/git';
import { billingRouter } from './server/routes/billing';
import { invitesRouter } from './server/routes/invites';
import { workspacesRouter } from './server/routes/workspaces';

const PORT = 3000;
const HOST = '0.0.0.0';

async function startServer() {
  const app = express();

  // Initialize SQLite Database with Sequelize
  try {
    await initDb();
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }

  // Initialize Redis client and Session Store (with graceful MemoryStore fallback)
  let sessionStore: any;
  try {
    const redisClient = await initRedis();
    if (redisClient) {
      sessionStore = new RedisStore({
        client: redisClient,
        prefix: 'cronos:sess:',
      });
      console.log('[Sessions] Using RedisStore for session management.');
    } else {
      sessionStore = new session.MemoryStore();
      console.log('[Sessions] Using MemoryStore fallback for session management.');
    }
  } catch (err) {
    console.warn('[Sessions] RedisStore initialization error, using MemoryStore fallback:', err);
    sessionStore = new session.MemoryStore();
  }

  // Middlewares (allow up to 25mb for base64 image uploads and capture rawBody for Stripe webhooks)
  app.use(
    express.json({
      limit: '25mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use(cookieParser());
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || 'time-tracking-faturamento-secret-key-2026',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // AI Studio container behind proxy
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/git', gitRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/invites', invitesRouter);
  app.use('/api/workspaces', workspacesRouter);

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

startServer();
