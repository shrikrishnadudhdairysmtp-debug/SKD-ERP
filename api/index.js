import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting (configured safely for serverless environments)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

app.use(['/api/', '/'], globalLimiter);

// Express wrapper for Serverless handlers (req, res)
function wrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (err) {
      next(err);
    }
  };
}

// Helper to merge Express route params into req.query
function injectParams(req, _res, next) {
  const q = { ...req.query, ...req.params };
  Object.defineProperty(req, 'query', {
    value: q,
    configurable: true,
    enumerable: true,
    writable: true
  });
  next();
}

// Import Handlers
import healthHandler from './_routes/health.js';
import seedHandler from './_routes/seed.js';
import accountsHandler from './_routes/accounts/index.js';
import authLoginHandler from './_routes/auth/login.js';
import authMeHandler from './_routes/auth/me.js';
import categoriesHandler from './_routes/categories/index.js';
import dashboardHandler from './_routes/dashboard/index.js';
import partiesHandler from './_routes/parties/index.js';
import partyIdHandler from './_routes/parties/[id].js';
import transactionsHandler from './_routes/transactions/index.js';
import transactionIdHandler from './_routes/transactions/[id].js';
import usersHandler from './_routes/users/index.js';
import userIdHandler from './_routes/users/[id].js';
import userPermissionsHandler from './_routes/users/permissions.js';
import loansHandler from './_routes/loans/index.js';
import loanIdHandler from './_routes/loans/[id].js';
import loanPayHandler from './_routes/loans/[id]/pay.js';

import emailSettingsHandler from './_routes/email/settings.js';
import emailTemplatesHandler from './_routes/email/templates.js';
import emailTestHandler from './_routes/email/test.js';
import emailLogsHandler from './_routes/email/logs.js';
import emailResendHandler from './_routes/email/resend.js';
import emailReportHandler from './_routes/email/report.js';
import emailProcessQueueHandler from './_routes/email/process-queue.js';

import nfpsUploadParseHandler from './_routes/nfps/upload-parse.js';
import nfpsGenerateHandler from './_routes/nfps/generate.js';
import nfpsBatchesHandler from './_routes/nfps/batches.js';

// Setup Routes (supporting both /api/path and /path for Vercel rewrites)
app.all(['/api/health', '/health'], wrap(healthHandler));
app.all(['/api/seed', '/seed'], wrap(seedHandler));

app.all(['/api/accounts', '/accounts'], wrap(accountsHandler));

app.all(['/api/auth/login', '/auth/login'], loginLimiter, wrap(authLoginHandler));
app.all(['/api/auth/me', '/auth/me'], wrap(authMeHandler));

app.all(['/api/categories', '/categories'], wrap(categoriesHandler));
app.all(['/api/dashboard', '/dashboard'], wrap(dashboardHandler));

app.all(['/api/parties', '/parties'], wrap(partiesHandler));
app.all(['/api/parties/:id', '/parties/:id'], injectParams, wrap(partyIdHandler));

app.all(['/api/transactions', '/transactions'], wrap(transactionsHandler));
app.all(['/api/transactions/:id', '/transactions/:id'], injectParams, wrap(transactionIdHandler));

app.all(['/api/users', '/users'], wrap(usersHandler));
app.all(['/api/users/:id/permissions', '/users/:id/permissions'], injectParams, wrap(userPermissionsHandler));
app.all(['/api/users/:id', '/users/:id'], injectParams, wrap(userIdHandler));

app.all(['/api/loans', '/loans'], wrap(loansHandler));
app.all(['/api/loans/:id/pay', '/loans/:id/pay'], injectParams, wrap(loanPayHandler));
app.all(['/api/loans/:id', '/loans/:id'], injectParams, wrap(loanIdHandler));

app.all(['/api/email/settings', '/email/settings'], wrap(emailSettingsHandler));
app.all(['/api/email/templates', '/email/templates'], wrap(emailTemplatesHandler));
app.all(['/api/email/test', '/email/test'], wrap(emailTestHandler));
app.all(['/api/email/logs', '/email/logs'], wrap(emailLogsHandler));
app.all(['/api/email/resend', '/email/resend'], wrap(emailResendHandler));
app.all(['/api/email/report', '/email/report'], wrap(emailReportHandler));
app.all(['/api/email/process-queue', '/email/process-queue'], wrap(emailProcessQueueHandler));

app.all(['/api/nfps/upload-parse', '/nfps/upload-parse'], wrap(nfpsUploadParseHandler));
app.all(['/api/nfps/generate', '/nfps/generate'], wrap(nfpsGenerateHandler));
app.all(['/api/nfps/batches', '/nfps/batches'], wrap(nfpsBatchesHandler));

// 404 Fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global JSON Error Handler
app.use((err, _req, res, _next) => {
  console.error('API Server Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'An internal server error occurred' });
});

export default app;
