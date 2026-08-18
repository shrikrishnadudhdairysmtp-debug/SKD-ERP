import React, { useState } from 'react';
import { useERP } from '../hooks/useERP.js';
import { useToast } from '../context/ToastContext.jsx';

/**
 * ApprovalQueue — Checker interface for the Maker-Checker workflow.
 * Shows all PENDING transactions. Checker can Approve or Reject (with notes).
 * Self-approval is blocked: users cannot approve their own transactions.
 */
const ApprovalQueue = () => {
  const { pendingTransactions, accounts, parties, approveTransaction, rejectTransaction, currentUser, isLoading } = useERP();
  const { showWarning } = useToast();

  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionNote, setRejectionNote] = useState('');

  const getAccountName = (id) => accounts.find(a => a.id === id)?.name || id;
  const getPartyName = (id) => parties.find(p => p.id === id)?.name || '';

  const isSelfCreated = (txn) => {
    return txn.createdBy === currentUser.name || txn.createdById === currentUser.id;
  };

  const handleApprove = (txn) => {
    if (isSelfCreated(txn)) {
      showWarning('You cannot approve your own transaction. Another authorized user must review it.');
      return;
    }
    approveTransaction(txn.id);
  };

  const handleReject = (txn) => {
    if (!rejectionNote.trim()) {
      showWarning('Please enter a rejection reason.');
      return;
    }
    if (isSelfCreated(txn)) {
      showWarning('You cannot reject your own transaction. Another authorized user must review it.');
      return;
    }
    rejectTransaction(txn.id, rejectionNote.trim());
    setRejectingId(null);
    setRejectionNote('');
  };

  const isChecker = currentUser.role === 'ADMIN' || currentUser.role === 'CHECKER';

  const handleBatchApprove = async () => {
    const approvable = pendingTransactions.filter(t => !isSelfCreated(t));
    if (approvable.length === 0) {
      showWarning('No transactions available for approval by you (self-created transactions must be reviewed by another user).');
      return;
    }
    if (confirm(`Approve all ${approvable.length} pending transactions immediately?`)) {
      for (const t of approvable) {
        await approveTransaction(t.id);
      }
    }
  };

  return (
    <div className="approval-queue">
      <div className="approval-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>Pending Queue</h3>
          <span className="subtitle" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Real-time background transaction approval pipeline</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="approval-count-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '0.9rem', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold' }}>
            🟡 Pending in Queue: {pendingTransactions.length}
          </span>
          {isChecker && pendingTransactions.length > 0 && (
            <button
              className="primary-btn"
              onClick={handleBatchApprove}
              disabled={isLoading}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', fontSize: '0.85rem' }}
            >
              ✓ Approve All Pending ({pendingTransactions.filter(t => !isSelfCreated(t)).length})
            </button>
          )}
        </div>
      </div>

      {!isChecker && (
        <div className="glass-panel approval-notice">
          <p>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{verticalAlign: 'middle', marginRight: '6px'}}>
              <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 4V3a4 4 0 018 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            You need <strong>Admin</strong> or <strong>Checker</strong> role to approve or reject transactions.
          </p>
          <p className="text-secondary">Current role: {currentUser.role}</p>
        </div>
      )}

      {pendingTransactions.length === 0 ? (
        <div className="glass-panel text-center approval-empty">
          <p className="approval-empty-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="var(--accent)" strokeWidth="2"/>
              <path d="M15 25l6 6 12-12" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </p>
          <p>No pending approvals.</p>
          <p className="text-secondary">All transactions have been reviewed.</p>
        </div>
      ) : (
        <div className="approval-cards">
          {pendingTransactions.map(txn => {
            const debitEntry = txn.entries?.find(e => e.debit > 0);
            const creditEntry = txn.entries?.find(e => e.credit > 0);
            const amount = debitEntry?.debit || creditEntry?.credit || 0;
            const selfCreated = isSelfCreated(txn);

            return (
              <div key={txn.id} className="approval-card glass-panel">
                <div className="approval-card-top">
                  <div className="approval-card-info">
                    <span className="approval-status-badge pending">Pending</span>
                    <span className="approval-date">{new Date(txn.date).toLocaleDateString()}</span>
                    <span className="approval-creator">by {txn.createdBy || 'Unknown'}</span>
                  </div>
                  <div className="approval-amount">
                    <span className="negative">₹{amount.toLocaleString()}</span>
                  </div>
                </div>

                <p className="approval-remarks">{txn.remarks}</p>

                <div className="approval-accounts">
                  <span className="acc-tag debit-tag">{debitEntry ? getAccountName(debitEntry.accountId) : '-'}</span>
                  <span className="approval-arrow">→</span>
                  <span className="acc-tag credit-tag">{creditEntry ? getAccountName(creditEntry.accountId) : '-'}</span>
                  {txn.partyId && <span className="approval-party">• {getPartyName(txn.partyId)}</span>}
                </div>

                {/* Self-approval warning */}
                {isChecker && selfCreated && (
                  <div className="self-approval-notice">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{verticalAlign: 'middle', marginRight: '4px'}}>
                      <path d="M7 1l6.06 10.5H.94L7 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M7 5.5v2.5M7 10v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    You created this transaction — another user must review it.
                  </div>
                )}

                {/* Rejection note input */}
                {rejectingId === txn.id && (
                  <div className="rejection-input-area">
                    <textarea
                      value={rejectionNote}
                      onChange={e => setRejectionNote(e.target.value)}
                      placeholder="Enter reason for rejection..."
                      rows={2}
                      autoFocus
                    />
                  </div>
                )}

                {/* Action buttons */}
                {isChecker && (
                  <div className="approval-actions">
                    {rejectingId === txn.id ? (
                      <>
                        <button className="action-btn" onClick={() => { setRejectingId(null); setRejectionNote(''); }}>
                          Cancel
                        </button>
                        <button
                          className="primary-btn reject-btn"
                          onClick={() => handleReject(txn)}
                          disabled={!rejectionNote.trim() || isLoading}
                        >
                          {isLoading ? 'Rejecting...' : 'Confirm Reject'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          className="primary-btn approve-btn" 
                          onClick={() => handleApprove(txn)}
                          disabled={selfCreated || isLoading}
                          title={selfCreated ? 'You cannot approve your own transaction' : 'Approve this transaction'}
                        >
                          {isLoading ? 'Processing...' : '✓ Approve'}
                        </button>
                        <button 
                          className="action-btn reject-trigger-btn" 
                          onClick={() => setRejectingId(txn.id)}
                          disabled={selfCreated || isLoading}
                          title={selfCreated ? 'You cannot reject your own transaction' : 'Reject this transaction'}
                        >
                          ✗ Reject
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApprovalQueue;
