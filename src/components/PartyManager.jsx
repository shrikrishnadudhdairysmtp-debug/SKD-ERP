import React, { useState } from 'react';
import { useERP } from '../hooks/useERP.js';
import { computePartyBalance } from '../utils/calculations.js';

const PartyManager = ({ onViewLedger }) => {
  const { parties, transactions, loans = [], addParty, editParty, deleteParty } = useERP();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('CUSTOMER');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const resetForm = () => {
    setName(''); setType('CUSTOMER'); setPhone(''); setEmail('');
    setEditId(null); setShowForm(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Party name is required.');

    if (editId) {
      editParty(editId, { name: name.trim(), phone, email });
    } else {
      addParty({
        id: 'party_' + Date.now().toString(),
        name: name.trim(),
        type,
        phone,
        email,
      });
    }
    resetForm();
  };

  const handleEdit = (party) => {
    setEditId(party.id);
    setName(party.name);
    setType(party.type);
    setPhone(party.phone || '');
    setEmail(party.email || '');
    setShowForm(true);
  };

  const handleDelete = (party) => {
    if (confirm(`Delete party "${party.name}"? This will also remove their linked account.`)) {
      deleteParty(party.id);
    }
  };

  return (
    <div className="party-manager">
      {/* Add / Edit Form */}
      <div className="party-header">
        <h3 className="section-title">Special Person Accounts</h3>
        <button className="primary-btn add-party-btn" onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? 'Cancel' : '+ Add Party'}
        </button>
      </div>

      {showForm && (
        <form className="party-form glass-panel" onSubmit={handleSubmit}>
          <div className="party-form-grid">
            <div className="form-group">
              <label>Name <span className="required-star">*</span></label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Ravi Kumar"
                required
              />
            </div>

            {!editId && (
              <div className="form-group">
                <label>Type</label>
                <select value={type} onChange={e => setType(e.target.value)}>
                  <option value="CUSTOMER">Customer (AR)</option>
                  <option value="VENDOR">Vendor (AP)</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Phone</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <button type="submit" className="primary-btn">{editId ? 'Update Party' : 'Create Party'}</button>
        </form>
      )}

      {/* Party Cards */}
      {parties.length === 0 ? (
        <div className="glass-panel text-center party-empty">
          <p className="party-empty-icon">👥</p>
          <p>No parties yet.</p>
          <p className="text-secondary">Add Customers or Vendors to track receivables and payables.</p>
        </div>
      ) : (
        <div className="party-grid">
          {parties.map(party => {
            const balance = computePartyBalance(transactions, party.id);
            const isCustomer = party.type === 'CUSTOMER';
            const partyLoans = loans.filter(l => l.partyId === party.id || l.partyName?.toLowerCase() === party.name?.toLowerCase());
            const totalLoanOutstanding = partyLoans.reduce((sum, l) => sum + (l.totalOutstanding || 0), 0);

            return (
              <div key={party.id} className="party-card glass-panel">
                <div className="party-card-header">
                  <div>
                    <span className={`party-type-badge ${isCustomer ? 'customer' : 'vendor'}`}>
                      {isCustomer ? 'Customer' : 'Vendor'}
                    </span>
                    {party.memberRef && (
                      <span className="party-type-badge" style={{ marginLeft: '0.4rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                        🆔 {party.memberRef}
                      </span>
                    )}
                    {partyLoans.length > 0 && (
                      <span className="party-type-badge vendor" style={{ marginLeft: '0.4rem', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
                        🏦 {partyLoans.length} Loan{partyLoans.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <h4 className="party-name" style={{ marginBottom: '0.2rem' }}>{party.name}</h4>
                    <div style={{ fontSize: '0.85rem', color: '#60a5fa', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      Member ID: <code>{party.memberRef || party.voucherRef || 'N/A'}</code>
                    </div>
                  </div>
                  <div className="party-balance">
                    <span className="party-balance-label">
                      {isCustomer ? 'Receivable' : 'Payable'}
                    </span>
                    <span className={`party-balance-amount ${isCustomer ? 'positive' : 'negative'}`}>
                      ₹{Math.abs(balance.outstanding).toLocaleString()}
                    </span>
                  </div>
                </div>

                {partyLoans.length > 0 && (
                  <div className="party-loan-strip glass-panel" style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-secondary">Loan Outstanding:</span>
                    <strong className="text-amber">₹{totalLoanOutstanding.toLocaleString()}</strong>
                  </div>
                )}

                {(party.phone || party.email) && (
                  <div className="party-contact">
                    {party.phone && <span>📞 {party.phone}</span>}
                    {party.email && <span>✉️ {party.email}</span>}
                  </div>
                )}

                <div className="party-actions">
                  <button className="action-btn" onClick={() => onViewLedger && onViewLedger(party)}>
                    View Ledger
                  </button>
                  <button className="action-btn" onClick={() => handleEdit(party)}>Edit</button>
                  <button className="action-btn delete" onClick={() => handleDelete(party)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PartyManager;
