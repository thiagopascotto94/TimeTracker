import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initDb } from './server/db';
import { authRouter } from './server/routes/auth';
import { sessionsRouter } from './server/routes/sessions';
import { tasksRouter } from './server/routes/tasks';
import { reportsRouter } from './server/routes/reports';
import { publicRouter } from './server/routes/public';
import { clientsRouter } from './server/routes/clients';
import { aiRouter } from './server/routes/ai';

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

  // Middlewares (allow up to 25mb for base64 image uploads)
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use(cookieParser());
  app.use(
    session({
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
