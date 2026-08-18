import { api } from './api.js';

export const emailService = {
  // Email Configuration Settings
  getSettings: async () => {
    return await api.get('/email/settings');
  },
  updateSettings: async (data) => {
    return await api.post('/email/settings', data);
  },

  // Email Templates
  getTemplates: async () => {
    return await api.get('/email/templates');
  },
  updateTemplates: async (templates) => {
    return await api.post('/email/templates', { templates });
  },

  // Send Test Email
  sendTestEmail: async (recipientEmail) => {
    return await api.post('/email/test', { recipientEmail });
  },

  // Send Report Email with Attachment
  sendReportEmail: async (recipientEmail, reportTitle, period, attachments = []) => {
    return await api.post('/email/report', { recipientEmail, reportTitle, period, attachments });
  },

  // Email History Logs
  getLogs: async (filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    return await api.get(`/email/logs${query ? `?${query}` : ''}`);
  },

  // Manual Resend
  resendEmail: async (logId) => {
    return await api.post('/email/resend', { id: logId });
  },

  // Process Pending Queue with Immediate 3x Retry Loop
  processPendingQueue: async () => {
    return await api.post('/email/process-queue');
  },
};
