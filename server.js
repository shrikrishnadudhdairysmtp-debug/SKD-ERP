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
const { default: healthHandler } = await import('./api/health.js');
const { default: seedHandler } = await import('./api/seed.js');
const { default: accountsHandler } = await import('./api/accounts/index.js');
const { default: authLoginHandler } = await import('./api/auth/login.js');
const { default: authMeHandler } = await import('./api/auth/me.js');
const { default: categoriesHandler } = await import('./api/categories/index.js');
const { default: dashboardHandler } = await import('./api/dashboard/index.js');
const { default: partiesHandler } = await import('./api/parties/index.js');
const { default: partyIdHandler } = await import('./api/parties/[id].js');
const { default: transactionsHandler } = await import('./api/transactions/index.js');
const { default: transactionIdHandler } = await import('./api/transactions/[id].js');
const { default: usersHandler } = await import('./api/users/index.js');
const { default: userIdHandler } = await import('./api/users/[id].js');
const { default: userPermissionsHandler } = await import('./api/users/permissions.js');
const { default: loansHandler } = await import('./api/loans/index.js');
const { default: loanIdHandler } = await import('./api/loans/[id].js');
const { default: loanPayHandler } = await import('./api/loans/[id]/pay.js');

const { default: emailSettingsHandler } = await import('./api/email/settings.js');
const { default: emailTemplatesHandler } = await import('./api/email/templates.js');
const { default: emailTestHandler } = await import('./api/email/test.js');
const { default: emailLogsHandler } = await import('./api/email/logs.js');
const { default: emailResendHandler } = await import('./api/email/resend.js');
const { default: emailReportHandler } = await import('./api/email/report.js');
const { processEmailQueue } = await import('./api/_lib/emailService.js');

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

// Start Background Email Queue Worker (runs every 5 seconds)
setInterval(() => {
  processEmailQueue().catch(err => console.error('Background email queue error:', err));
}, 5000);

// 404 Fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend API Server running on http://localhost:${PORT}`);
});
