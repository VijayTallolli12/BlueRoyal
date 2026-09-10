import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { swaggerSpec } from './config/swagger';
import { correlationIdMiddleware } from './core/middleware/correlation-id.middleware';
import { errorHandlerMiddleware } from './core/middleware/error-handler.middleware';
import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import masterRouter from './modules/masters/routes/master.routes';
import attendanceRouter from './modules/attendance/routes/attendance.routes';
import leaveRouter from './modules/leave/routes/leave.routes';
import { payrollRoutes } from './modules/payroll/routes/payroll.routes';
import documentRouter from './modules/documents/routes/document.routes';
import onboardingRouter from './modules/onboarding/routes/onboarding.routes';
import settlementRouter from './modules/settlement/routes/settlement.routes';
import dashboardRouter from './modules/dashboard/routes/dashboard.routes';

export function createApp(): Express {
  const app = express();

  // Security and base middlewares
  app.use(helmet());
  // Strict CORS configuration with exact approved production & staging origins
  const configuredOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  const approvedOrigins = new Set<string>([
    'https://blue-royal-hrms.vercel.app',
    'https://blue-royal-hrms.onrender.com',
    'http://localhost:4200',
    ...configuredOrigins,
  ]);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, server-to-server health checks)
        if (!origin || approvedOrigins.has(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not permitted by CORS policy`));
      },
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(correlationIdMiddleware);

  // API Documentation Explorer
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Domain Routers under versioned prefix
  app.use(env.API_PREFIX, healthRouter);
  app.use(`${env.API_PREFIX}/auth`, authRouter);
  app.use(env.API_PREFIX, masterRouter);
  app.use(`${env.API_PREFIX}/attendance`, attendanceRouter);
  app.use(`${env.API_PREFIX}/leave`, leaveRouter);
  app.use(`${env.API_PREFIX}/payroll`, payrollRoutes);
  app.use(env.API_PREFIX, documentRouter);
  app.use(env.API_PREFIX, onboardingRouter);
  app.use(env.API_PREFIX, settlementRouter);
  app.use(`${env.API_PREFIX}/dashboard`, dashboardRouter);

  // 404 handler for undefined routes
  app.use((req, res, _next) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Cannot ${req.method} ${req.originalUrl}`,
      },
      meta: {
        correlationId: (req.headers['x-correlation-id'] as string) || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Centralized Global Error Handler
  app.use(errorHandlerMiddleware);

  return app;
}
