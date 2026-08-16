import React, { useState, useEffect } from 'react';
import { emailService } from '../services/emailService.js';
import { useToast } from '../context/ToastContext.jsx';

const EmailLogs = () => {
  const { showSuccess, showError } = useToast();

  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({ total: 0, sent: 0, pending: 0, failed: 0 });
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [resendingId, setResendingId] = useState(null);

  // Selected Log Preview Modal
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [statusFilter, typeFilter]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await emailService.getLogs({
        search: searchTerm,
        status: statusFilter,
        type: typeFilter,
      });
      setLogs(res.data || []);
      setSummary(res.summary || { total: 0, sent: 0, pending: 0, failed: 0 });
    } catch (err) {
      showError(err.message || 'Failed to load email logs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleResend = async (logId) => {
    setResendingId(logId);
    try {
      const res = await emailService.resendEmail(logId);
      showSuccess(`Email dispatch re-attempted for ${res.log?.recipient}`);
      fetchLogs();
    } catch (err) {
      showError(err.message || 'Failed to resend email');
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="email-logs-page page-container fade-in">
      {/* Header Bar */}
      <div className="page-header-bar">
        <div>
          <h2>Email History Logs & Queue</h2>
          <p className="subtitle">Audit history, delivery statuses, retry logs, and manual email resend</p>
        </div>
        <button className="action-btn refresh-btn" onClick={fetchLogs} disabled={isLoading}>
          🔄 Refresh Logs
        </button>
      </div>

      {/* Overview Metrics Cards */}
      <div className="metrics-cards-grid four-cols">
        <div className="metric-card glass-panel shadow-sm">
          <span className="card-lbl">Total Emails Queued</span>
          <h3 className="card-val">{summary.total.toLocaleString()}</h3>
          <span className="card-sub">All system events</span>
        </div>
        <div className="metric-card glass-panel shadow-sm border-left-green">
          <span className="card-lbl">Delivered Successfully</span>
          <h3 className="card-val text-green">🟢 {summary.sent.toLocaleString()}</h3>
          <span className="card-sub">Sent via SMTP</span>
        </div>
        <div className="metric-card glass-panel shadow-sm border-left-amber">
          <span className="card-lbl">Pending in Queue</span>
          <h3 className="card-val text-amber">🟡 {summary.pending.toLocaleString()}</h3>
          <span className="card-sub">Processing background</span>
        </div>
        <div className="metric-card glass-panel shadow-sm border-left-red">
          <span className="card-lbl">Failed Dispatches</span>
          <h3 className="card-val text-red">🔴 {summary.failed.toLocaleString()}</h3>
          <span className="card-sub">Retry count exceeded</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="filter-toolbar glass-panel shadow-sm">
        <form onSubmit={handleSearchSubmit} className="search-form-inline">
          <div className="search-input-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search recipient, subject, event ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button type="submit" className="action-btn">Search</button>
        </form>

        <div className="filters-right-group">
          <div className="filter-select-item">
            <label>Status:</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="SENT">🟢 Sent</option>
              <option value="PENDING">🟡 Pending</option>
              <option value="FAILED">🔴 Failed</option>
            </select>
          </div>

          <div className="filter-select-item">
            <label>Event Type:</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="ALL">All Types</option>
              <option value="LOAN_CREATED">New Loan</option>
              <option value="LOAN_PAYMENT">Loan Payment</option>
              <option value="NEW_MEMBER">New Member</option>
              <option value="PAYMENT_REMINDER">Reminder</option>
              <option value="PAYMENT_OVERDUE">Overdue Alert</option>
              <option value="MILK_COLLECTION">Milk Entry</option>
              <option value="PAYMENT_RECEIVED">Payment Received</option>
              <option value="TEST_EMAIL">Test Email</option>
            </select>
          </div>
        </div>
      </div>

      {/* Log Records Table */}
      <div className="logs-table-card glass-panel shadow-md">
        <div className="table-responsive">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Event Ref ID</th>
                <th>Recipient</th>
                <th>Notification Type</th>
                <th>Subject</th>
                <th>Sent / Created Date</th>
                <th>Status</th>
                <th>Retries</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-6">Loading email logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6">No email log entries found.</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log._id || log.id}>
                    <td><code>{log.eventRefId || 'SYS-EVENT'}</code></td>
                    <td>
                      <div>
                        <strong>{log.recipientName || 'Recipient'}</strong>
                        <div className="sub-text">{log.recipient}</div>
                      </div>
                    </td>
                    <td><span className="type-tag">{log.notificationType}</span></td>
                    <td className="subject-cell">{log.subject}</td>
                    <td>{new Date(log.sentAt || log.createdAt).toLocaleString('en-IN')}</td>
                    <td>
                      {log.status === 'SENT' && <span className="status-pill status-active">🟢 SENT</span>}
                      {log.status === 'PENDING' && <span className="status-pill status-pending">🟡 PENDING</span>}
                      {log.status === 'FAILED' && <span className="status-pill status-rejected">🔴 FAILED</span>}
                    </td>
                    <td>{log.retryCount} / {log.maxRetries}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="action-btns-group">
                        <button
                          type="button"
                          className="btn-action-icon"
                          title="View Email Message"
                          onClick={() => setSelectedLog(log)}
                        >
                          👁️
                        </button>
                        <button
                          type="button"
                          className="action-btn resend-btn-sm"
                          disabled={resendingId === log._id}
                          onClick={() => handleResend(log._id)}
                          title="Resend Email"
                        >
                          {resendingId === log._id ? 'Sending...' : '🔄 Resend'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Body Preview Modal */}
      {selectedLog && (
        <div className="modal-backdrop-overlay">
          <div className="modal-dialog-card max-w-2xl shadow-2xl">
            <div className="dialog-header">
              <div>
                <h2>Email Preview: {selectedLog.subject}</h2>
                <span className="sub-heading">Recipient: {selectedLog.recipient} • Type: {selectedLog.notificationType}</span>
              </div>
              <button className="btn-modal-close" onClick={() => setSelectedLog(null)}>✕</button>
            </div>

            <div className="email-preview-content">
              {selectedLog.status === 'FAILED' && selectedLog.errorMessage && (
                <div className="error-banner-box">
                  <strong>⚠️ Last Failure Reason:</strong> {selectedLog.errorMessage}
                </div>
              )}
              <div
                className="email-body-html-box"
                dangerouslySetInnerHTML={{ __html: selectedLog.bodyHtml }}
              />
            </div>

            <div className="modal-footer-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  handleResend(selectedLog._id);
                  setSelectedLog(null);
                }}
              >
                🔄 Resend Email Now
              </button>
              <button type="button" className="btn-cancel" onClick={() => setSelectedLog(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailLogs;
