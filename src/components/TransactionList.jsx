import React, { useState } from 'react';
import { useERP } from '../hooks/useERP.js';
import DeleteConfirmModal from './DeleteConfirmModal.jsx';

const TransactionList = ({ transactions, onDelete, onEdit, pagination, onPageChange, isLoading }) => {
  const { accounts, parties, currentUser } = useERP();
  const [deletingTxn, setDeletingTxn] = useState(null);

  const getAccountName = (id) => accounts.find(a => a.id === id)?.name || id;
  const getPartyName = (id) => parties.find(p => p.id === id)?.name || '';

  const handleDeleteClick = (txn) => {
    setDeletingTxn(txn);
  };

  const handleDeleteConfirm = (id, reason) => {
    onDelete(id, reason);
    setDeletingTxn(null);
  };

  const canDelete = currentUser.role === 'ADMIN' || currentUser.role === 'CHECKER';
  const canEdit = currentUser.role === 'ADMIN';

  if (!isLoading && transactions.length === 0) {
    return <div className="glass-panel text-center"><p>No transactions found.</p></div>;
  }

  return (
    <>
      <div className={`transaction-list glass-panel ${isLoading ? 'loading-overlay' : ''}`}>
        {isLoading && (
          <div className="table-loading-indicator">
            <div className="spinner"></div>
          </div>
        )}
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher Ref</th>
                <th>Remarks</th>
                <th>Debit A/C</th>
                <th>Credit A/C</th>
                <th>Party</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(txn => {
                const debitEntry = txn.entries?.find(e => e.debit > 0);
                const creditEntry = txn.entries?.find(e => e.credit > 0);
                const amount = debitEntry?.debit || creditEntry?.credit || 0;

                const isReceipt = debitEntry && (
                  debitEntry.accountId === 'acc_cash' ||
                  debitEntry.accountId === 'acc_bank'
                ) && creditEntry && (
                  creditEntry.accountId === 'acc_income' ||
                  creditEntry.accountId?.startsWith('acc_ar_')
                );

                const statusClass = txn.status === 'APPROVED' ? 'approved'
                  : txn.status === 'PENDING' ? 'pending'
                  : txn.status === 'REJECTED' ? 'rejected' : '';

                return (
                  <tr key={txn.id} className={txn.isDeleted ? 'deleted-row' : ''}>
                    <td>{new Date(txn.date).toLocaleDateString()}</td>
                    <td>
                      <code style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '0.85rem' }}>
                        {txn.voucherRef || '-'}
                      </code>
                    </td>
                    <td className="remarks-cell">{txn.remarks || '-'}</td>
                    <td className="acc-cell">
                      <span className="acc-tag debit-tag">
                        {debitEntry ? getAccountName(debitEntry.accountId) : '-'}
                      </span>
                    </td>
                    <td className="acc-cell">
                      <span className="acc-tag credit-tag">
                        {creditEntry ? getAccountName(creditEntry.accountId) : '-'}
                      </span>
                    </td>
                    <td>{txn.partyId ? getPartyName(txn.partyId) : '-'}</td>
                    <td>
                      <span className={`status-badge ${statusClass}`}>
                        {txn.status || 'APPROVED'}
                      </span>
                    </td>
                    <td className={isReceipt ? 'positive' : 'negative'}>
                      ₹{amount.toLocaleString()}
                    </td>
                    <td>
                      {canEdit && onEdit && !txn.isDeleted && (
                        <button className="action-btn" onClick={() => onEdit(txn)} style={{ marginRight: '0.4rem' }}>
                          Edit
                        </button>
                      )}
                      {canDelete && !txn.isDeleted && (
                        <button className="action-btn delete" onClick={() => handleDeleteClick(txn)}>
                          Delete
                        </button>
                      )}
                      {txn.isDeleted && (
                        <span className="deleted-label">Deleted</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {pagination && pagination.totalPages > 1 && (
          <div className="pagination-controls">
            <button
              className="action-btn"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              ← Previous
            </button>
            <span className="pagination-info">
              Page {pagination.page} of {pagination.totalPages}
              <span className="pagination-total"> ({pagination.total} total)</span>
            </span>
            <button
              className="action-btn"
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingTxn && (
        <DeleteConfirmModal
          transaction={deletingTxn}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingTxn(null)}
        />
      )}
    </>
  );
};

export default TransactionList;
