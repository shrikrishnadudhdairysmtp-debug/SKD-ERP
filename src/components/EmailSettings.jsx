import React, { useState, useEffect } from 'react';
import { emailService } from '../services/emailService.js';
import { useToast } from '../context/ToastContext.jsx';

const EmailSettings = () => {
  const { showSuccess, showError, showWarning } = useToast();
  const [activeTab, setActiveTab] = useState('SMTP'); // SMTP, NOTIFICATIONS, TEMPLATES

  // SMTP Settings State
  const [smtpForm, setSmtpForm] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    senderName: '',
    senderEmail: '',
    secureSsl: false,
    enabled: true,
    companyName: '',
    companyContact: '',
  });

  // Toggles State
  const [toggles, setToggles] = useState({
    newMember: true,
    newLoan: true,
    paymentReceived: true,
    paymentReminder: true,
    overduePayment: true,
    loanClosure: true,
    milkCollection: true,
    invoice: true,
  });

  // Templates State
  const [templates, setTemplates] = useState({});
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('LOAN_CREATED');
  const [templateForm, setTemplateForm] = useState({ subject: '', body: '' });

  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Load Settings & Templates
  useEffect(() => {
    loadSettings();
    loadTemplates();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await emailService.getSettings();
      setSmtpForm({
        smtpHost: data.smtpHost || '',
        smtpPort: data.smtpPort || 587,
        smtpUsername: data.smtpUsername || '',
        smtpPassword: data.smtpPassword || '',
        senderName: data.senderName || '',
        senderEmail: data.senderEmail || '',
        secureSsl: Boolean(data.secureSsl),
        enabled: data.enabled !== undefined ? data.enabled : true,
        companyName: data.companyName || '',
        companyContact: data.companyContact || '',
      });
      if (data.notificationToggles) {
        setToggles(data.notificationToggles);
      }
    } catch (err) {
      showError(err.message || 'Failed to load email configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const tmps = await emailService.getTemplates();
      setTemplates(tmps || {});
      if (tmps['LOAN_CREATED']) {
        setTemplateForm({
          subject: tmps['LOAN_CREATED'].subject || '',
          body: tmps['LOAN_CREATED'].body || '',
        });
      }
    } catch (err) {
      console.error('Failed to load email templates', err);
    }
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await emailService.updateSettings(smtpForm);
      showSuccess('SMTP Configuration saved successfully!');
      loadSettings();
    } catch (err) {
      showError(err.message || 'Failed to save SMTP configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleChange = async (key, value) => {
    const updatedToggles = { ...toggles, [key]: value };
    setToggles(updatedToggles);
    try {
      await emailService.updateSettings({ notificationToggles: updatedToggles });
      showSuccess('Notification settings updated');
    } catch (err) {
      showError(err.message || 'Failed to update notification toggles');
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      showWarning('Please enter a valid email address for testing.');
      return;
    }
    setIsTesting(true);
    try {
      await emailService.sendTestEmail(testEmailAddress);
      showSuccess(`Test email queued for ${testEmailAddress}`);
    } catch (err) {
      showError(err.message || 'Test email dispatch failed');
    } finally {
      setIsTesting(false);
    }
  };

  // Automatically update template form whenever template selection or templates data changes
  useEffect(() => {
    if (templates && templates[selectedTemplateKey]) {
      setTemplateForm({
        subject: templates[selectedTemplateKey].subject || '',
        body: templates[selectedTemplateKey].body || '',
      });
    }
  }, [selectedTemplateKey, templates]);

  const handleSelectTemplate = (key) => {
    setSelectedTemplateKey(key);
    if (templates && templates[key]) {
      setTemplateForm({
        subject: templates[key].subject || '',
        body: templates[key].body || '',
      });
    } else {
      setTemplateForm({ subject: '', body: '' });
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const updated = {
        ...templates,
        [selectedTemplateKey]: templateForm,
      };
      await emailService.updateTemplates(updated);
      setTemplates(updated);
      showSuccess(`Template "${selectedTemplateKey}" updated successfully!`);
    } catch (err) {
      showError(err.message || 'Failed to save template');
    } finally {
      setIsLoading(false);
    }
  };

  const insertTag = (tag) => {
    setTemplateForm(prev => ({
      ...prev,
      body: prev.body + ` ${tag} `,
    }));
  };

  return (
    <div className="email-settings-page page-container fade-in">
      {/* Header Banner */}
      <div className="page-header-bar">
        <div>
          <h2>Email & Notification System</h2>
          <p className="subtitle">Configure SMTP server, notification triggers, and custom email templates</p>
        </div>
        <div className="status-toggle-box">
          <label className="toggle-label">
            <span>Global Email Notifications:</span>
            <input
              type="checkbox"
              checked={smtpForm.enabled}
              onChange={e => {
                setSmtpForm(s => ({ ...s, enabled: e.target.checked }));
                emailService.updateSettings({ enabled: e.target.checked });
                showSuccess(e.target.checked ? 'Email notifications enabled' : 'Email notifications disabled');
              }}
            />
            <span className={`status-pill ${smtpForm.enabled ? 'status-active' : 'status-inactive'}`}>
              {smtpForm.enabled ? '🟢 ENABLED' : '🔴 DISABLED'}
            </span>
          </label>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="settings-tabs-nav">
        <button
          className={`tab-nav-btn ${activeTab === 'SMTP' ? 'active' : ''}`}
          onClick={() => setActiveTab('SMTP')}
        >
          ⚙️ SMTP Configuration
        </button>
        <button
          className={`tab-nav-btn ${activeTab === 'NOTIFICATIONS' ? 'active' : ''}`}
          onClick={() => setActiveTab('NOTIFICATIONS')}
        >
          🔔 Notification Controls
        </button>
        <button
          className={`tab-nav-btn ${activeTab === 'TEMPLATES' ? 'active' : ''}`}
          onClick={() => setActiveTab('TEMPLATES')}
        >
          📝 Email Templates
        </button>
      </div>

      {/* ── TAB 1: SMTP CONFIGURATION ── */}
      {activeTab === 'SMTP' && (
        <div className="tab-pane-card glass-panel shadow-md">
          <form onSubmit={handleSaveSmtp}>
            <h3>SMTP Mail Server Credentials</h3>
            <p className="form-help-text">Credentials are encrypted and stored safely on the backend server.</p>

            <div className="grid-2-fields">
              <div className="form-group">
                <label>SMTP Host Server <span className="req-star">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. smtp.gmail.com"
                  value={smtpForm.smtpHost}
                  onChange={e => setSmtpForm(s => ({ ...s, smtpHost: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>SMTP Port <span className="req-star">*</span></label>
                <input
                  type="number"
                  placeholder="587 or 465"
                  value={smtpForm.smtpPort}
                  onChange={e => setSmtpForm(s => ({ ...s, smtpPort: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>SMTP Username / Account Email <span className="req-star">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. notifications@yourdomain.com"
                  value={smtpForm.smtpUsername}
                  onChange={e => setSmtpForm(s => ({ ...s, smtpUsername: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>SMTP App Password / Auth Secret <span className="req-star">*</span></label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={smtpForm.smtpPassword}
                  onChange={e => setSmtpForm(s => ({ ...s, smtpPassword: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Sender Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. SKD ERP System"
                  value={smtpForm.senderName}
                  onChange={e => setSmtpForm(s => ({ ...s, senderName: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Sender Reply-To Email</label>
                <input
                  type="email"
                  placeholder="e.g. noreply@skderp.com"
                  value={smtpForm.senderEmail}
                  onChange={e => setSmtpForm(s => ({ ...s, senderEmail: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Company Name (for Templates)</label>
                <input
                  type="text"
                  placeholder="SKD ERP Services"
                  value={smtpForm.companyName}
                  onChange={e => setSmtpForm(s => ({ ...s, companyName: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Company Contact Info</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={smtpForm.companyContact}
                  onChange={e => setSmtpForm(s => ({ ...s, companyContact: e.target.value }))}
                />
              </div>
            </div>

            <div className="checkbox-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={smtpForm.secureSsl}
                  onChange={e => setSmtpForm(s => ({ ...s, secureSsl: e.target.checked }))}
                />
                Use Secure SSL/TLS Encryption (Port 465)
              </label>
            </div>

            <div className="form-actions-bar">
              <button type="submit" className="primary-btn" disabled={isLoading}>
                {isLoading ? 'Saving...' : '💾 Save SMTP Configuration'}
              </button>
            </div>
          </form>

          <hr className="divider-hr" />

          {/* Test Email Section */}
          <div className="test-email-box">
            <h4>🧪 Test Email Dispatch</h4>
            <p className="sub-heading">Send a test notification to verify your SMTP server setup.</p>
            <div className="inline-test-row">
              <input
                type="email"
                placeholder="Enter recipient email address"
                value={testEmailAddress}
                onChange={e => setTestEmailAddress(e.target.value)}
              />
              <button
                type="button"
                className="action-btn test-btn"
                onClick={handleSendTestEmail}
                disabled={isTesting}
              >
                {isTesting ? 'Sending...' : '📨 Send Test Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: NOTIFICATION CONTROLS ── */}
      {activeTab === 'NOTIFICATIONS' && (
        <div className="tab-pane-card glass-panel shadow-md">
          <h3>Automatic Event Notification Toggles</h3>
          <p className="form-help-text">Enable or disable specific email notifications triggered by ERP events.</p>

          <table className="erp-table notification-table">
            <thead>
              <tr>
                <th>Notification Event</th>
                <th>Target Recipient</th>
                <th>Description</th>
                <th style={{ textAlign: 'center' }}>Email Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>New Member Registration</strong></td>
                <td>Customer / Member</td>
                <td>Sent when a new member or customer profile is created</td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={toggles.newMember}
                    onChange={e => handleToggleChange('newMember', e.target.checked)}
                  />
                </td>
              </tr>
              <tr>
                <td><strong>Loan Issued Successfully</strong></td>
                <td>Borrower</td>
                <td>Sent when a new loan is approved and disbursed</td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={toggles.newLoan}
                    onChange={e => handleToggleChange('newLoan', e.target.checked)}
                  />
                </td>
              </tr>
              <tr>
                <td><strong>Loan Payment Confirmation</strong></td>
                <td>Borrower</td>
                <td>Sent when a repayment installment is recorded</td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={toggles.paymentReceived}
                    onChange={e => handleToggleChange('paymentReceived', e.target.checked)}
                  />
                </td>
              </tr>
              <tr>
                <td><strong>Payment Due Reminder</strong></td>
                <td>Borrower</td>
                <td>Sent prior to repayment due date (7, 3, 1 day before)</td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={toggles.paymentReminder}
                    onChange={e => handleToggleChange('paymentReminder', e.target.checked)}
                  />
                </td>
              </tr>
              <tr>
                <td><strong>Loan Payment Overdue Alert</strong></td>
                <td>Borrower</td>
                <td>Sent automatically when installment becomes overdue</td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={toggles.overduePayment}
                    onChange={e => handleToggleChange('overduePayment', e.target.checked)}
                  />
                </td>
              </tr>
              <tr>
                <td><strong>Loan Closure & No Dues</strong></td>
                <td>Borrower</td>
                <td>Sent when loan is fully repaid and closed</td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={toggles.loanClosure}
                    onChange={e => handleToggleChange('loanClosure', e.target.checked)}
                  />
                </td>
              </tr>
              <tr>
                <td><strong>Milk Collection Entry</strong></td>
                <td>Dairy Member</td>
                <td>Sent when daily milk quantity & fat is logged</td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={toggles.milkCollection}
                    onChange={e => handleToggleChange('milkCollection', e.target.checked)}
                  />
                </td>
              </tr>
              <tr>
                <td><strong>Invoice & Financial Receipts</strong></td>
                <td>Customer / Party</td>
                <td>Sent on billing, payments, and account adjustments</td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={toggles.invoice}
                    onChange={e => handleToggleChange('invoice', e.target.checked)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 3: EMAIL TEMPLATES EDITOR ── */}
      {activeTab === 'TEMPLATES' && (
        <div className="tab-pane-card glass-panel shadow-md template-editor-pane">
          <div className="template-editor-grid">
            {/* Sidebar List of Events */}
            <div className="template-sidebar-list">
              <h4>Select Template</h4>
              {[
                { key: 'LOAN_CREATED', label: '🏦 New Loan Issued' },
                { key: 'LOAN_PAYMENT', label: '💳 Loan Payment Confirmation' },
                { key: 'NEW_MEMBER', label: '👤 New Member Registration' },
                { key: 'PAYMENT_REMINDER', label: '📅 Payment Reminder' },
                { key: 'PAYMENT_OVERDUE', label: '⚠️ Payment Overdue' },
                { key: 'MILK_COLLECTION', label: '🥛 Milk Collection Entry' },
                { key: 'PAYMENT_RECEIVED', label: '💵 Financial Transaction' },
                { key: 'LOAN_CLOSED', label: '✅ Loan Closure' },
                { key: 'REPORT_EMAIL', label: '📊 Statement Report' },
                { key: 'TEST_EMAIL', label: '🧪 SMTP Test Email' },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  className={`template-select-btn ${selectedTemplateKey === t.key ? 'active' : ''}`}
                  onClick={() => handleSelectTemplate(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Template Editor Form */}
            <div className="template-form-box">
              <form onSubmit={handleSaveTemplate}>
                <h3>Editing Template: <code>{selectedTemplateKey}</code></h3>

                {/* Available Variables Pills */}
                <div className="variables-pills-box">
                  <span className="pills-title">Available Placeholders (click to insert):</span>
                  <div className="pills-flex">
                    {['{{customer_name}}', '{{member_id}}', '{{loan_id}}', '{{loan_amount}}', '{{payment_amount}}', '{{outstanding_amount}}', '{{due_date}}', '{{payment_date}}', '{{company_name}}'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className="tag-pill"
                        onClick={() => insertTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Email Subject Line <span className="req-star">*</span></label>
                  <input
                    type="text"
                    value={templateForm.subject}
                    onChange={e => setTemplateForm(tf => ({ ...tf, subject: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email Body Message <span className="req-star">*</span></label>
                  <textarea
                    rows={10}
                    value={templateForm.body}
                    onChange={e => setTemplateForm(tf => ({ ...tf, body: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-actions-bar">
                  <button type="submit" className="primary-btn" disabled={isLoading}>
                    {isLoading ? 'Saving...' : '💾 Save Template'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailSettings;
