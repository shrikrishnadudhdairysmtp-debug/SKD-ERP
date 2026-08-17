import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', globalLimiter);

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
const { default: healthHandler } = await import('./_routes/health.js');
const { default: seedHandler } = await import('./_routes/seed.js');
const { default: accountsHandler } = await import('./_routes/accounts/index.js');
const { default: authLoginHandler } = await import('./_routes/auth/login.js');
const { default: authMeHandler } = await import('./_routes/auth/me.js');
const { default: categoriesHandler } = await import('./_routes/categories/index.js');
const { default: dashboardHandler } = await import('./_routes/dashboard/index.js');
const { default: partiesHandler } = await import('./_routes/parties/index.js');
const { default: partyIdHandler } = await import('./_routes/parties/[id].js');
const { default: transactionsHandler } = await import('./_routes/transactions/index.js');
const { default: transactionIdHandler } = await import('./_routes/transactions/[id].js');
const { default: usersHandler } = await import('./_routes/users/index.js');
const { default: userIdHandler } = await import('./_routes/users/[id].js');
const { default: userPermissionsHandler } = await import('./_routes/users/permissions.js');
const { default: loansHandler } = await import('./_routes/loans/index.js');
const { default: loanIdHandler } = await import('./_routes/loans/[id].js');
const { default: loanPayHandler } = await import('./_routes/loans/[id]/pay.js');

const { default: emailSettingsHandler } = await import('./_routes/email/settings.js');
const { default: emailTemplatesHandler } = await import('./_routes/email/templates.js');
const { default: emailTestHandler } = await import('./_routes/email/test.js');
const { default: emailLogsHandler } = await import('./_routes/email/logs.js');
const { default: emailResendHandler } = await import('./_routes/email/resend.js');
const { default: emailReportHandler } = await import('./_routes/email/report.js');

// Setup Routes
app.all('/api/health', wrap(healthHandler));
app.all('/api/seed', wrap(seedHandler));

app.all('/api/accounts', wrap(accountsHandler));

app.all('/api/auth/login', loginLimiter, wrap(authLoginHandler));
app.all('/api/auth/me', wrap(authMeHandler));

app.all('/api/categories', wrap(categoriesHandler));
app.all('/api/dashboard', wrap(dashboardHandler));

app.all('/api/parties', wrap(partiesHandler));
app.all('/api/parties/:id', injectParams, wrap(partyIdHandler));

app.all('/api/transactions', wrap(transactionsHandler));
app.all('/api/transactions/:id', injectParams, wrap(transactionIdHandler));

app.all('/api/users', wrap(usersHandler));
app.all('/api/users/:id/permissions', injectParams, wrap(userPermissionsHandler));
app.all('/api/users/:id', injectParams, wrap(userIdHandler));

app.all('/api/loans', wrap(loansHandler));
app.all('/api/loans/:id/pay', injectParams, wrap(loanPayHandler));
app.all('/api/loans/:id', injectParams, wrap(loanIdHandler));

app.all('/api/email/settings', wrap(emailSettingsHandler));
app.all('/api/email/templates', wrap(emailTemplatesHandler));
app.all('/api/email/test', wrap(emailTestHandler));
app.all('/api/email/logs', wrap(emailLogsHandler));
app.all('/api/email/resend', wrap(emailResendHandler));
app.all('/api/email/report', wrap(emailReportHandler));

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
