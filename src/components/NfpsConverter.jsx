import React, { useState, useEffect } from 'react';
import { useERP } from '../hooks/useERP.js';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../services/api.js';

const NfpsConverter = () => {
  const { accounts, currentUser } = useERP();
  const { showSuccess, showError, showWarning } = useToast();

  // Navigation Sub-Tab
  const [activeTab, setActiveTab] = useState('CONVERT'); // 'CONVERT' | 'HISTORY'

  // Workflow Step State
  const [currentStep, setCurrentStep] = useState('UPLOAD'); // 'UPLOAD' | 'MANUAL_MAP' | 'PREVIEW' | 'COMPLETE'

  // Form Configurations
  const [file, setFile] = useState(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [debitAccountNo, setDebitAccountNo] = useState('');
  const [creditNarration, setCreditNarration] = useState('MILK PAYMENT');
  const [refPrefix, setRefPrefix] = useState('NEFT');

  // Loading States
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Parsed Preview & Validation Data
  const [previewData, setPreviewData] = useState(null);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'VALID' | 'INVALID' | 'DUPLICATE'

  // Manual Mapping State
  const [rawRows, setRawRows] = useState([]);
  const [headerRowIdx, setHeaderRowIdx] = useState(0);
  const [manualCols, setManualCols] = useState({
    farmerName: 2,
    beneAccNo: 3,
    beneIfsc: 4,
    amount: 5,
    code: 1,
  });

  // Complete Generated Result State
  const [generatedResult, setGeneratedResult] = useState(null);

  // History State
  const [batches, setBatches] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Auto-set default Debit Account from ERP accounts list
  useEffect(() => {
    if (accounts && accounts.length > 0 && !debitAccountNo) {
      const bankAcc = accounts.find(a => a.type === 'BANK' || a.category === 'ASSET' || a.name.toLowerCase().includes('bank')) || accounts[0];
      setDebitAccountNo(bankAcc.accountNumber || bankAcc.id || '50100736439046');
    }
  }, [accounts, debitAccountNo]);

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchBatches();
    }
  }, [activeTab]);

  const fetchBatches = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await api.get('/nfps/batches');
      setBatches(res.batches || []);
    } catch (err) {
      showError(err.message || 'Failed to fetch batch history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (!selected.name.endsWith('.xlsx') && !selected.name.endsWith('.xls')) {
        showWarning('Please select a valid Excel file (.xlsx or .xls).');
        return;
      }
      setFile(selected);
    }
  };

  const handleUploadAndParse = async (customMapping = null) => {
    if (!file) {
      showWarning('Please select a Bank Statement Excel file to upload.');
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const fileBase64 = event.target.result;
        
        const payload = {
          fileBase64,
          filename: file.name,
          customMapping,
        };

        const res = await api.post('/nfps/upload-parse', payload);

        if (!res.success && res.needsManualMapping) {
          showWarning(res.error || 'Could not auto-detect columns. Please map them manually.');
          setRawRows(res.rawRows || []);
          setCurrentStep('MANUAL_MAP');
          setIsUploading(false);
          return;
        }

        if (res.detectedDate) {
          // Convert DD-MM-YYYY to YYYY-MM-DD for date input
          const parts = res.detectedDate.split('-');
          if (parts.length === 3) {
            setPaymentDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
          }
        }

        setPreviewData(res);
        // Pre-select all valid records
        const validIndexes = res.records
          .map((r, idx) => r.status === 'VALID' ? idx : -1)
          .filter(idx => idx !== -1);
        setSelectedIndices(validIndexes);

        setCurrentStep('PREVIEW');
        showSuccess(`Statement parsed successfully! ${res.summary.valid} valid records ready for conversion.`);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      showError(err.message || 'Failed to upload and parse file');
      setIsUploading(false);
    }
  };

  const handleManualMapSubmit = (e) => {
    e.preventDefault();
    handleUploadAndParse({
      headerRowIndex: Number(headerRowIdx),
      colIndexes: {
        farmerName: Number(manualCols.farmerName),
        beneAccNo: Number(manualCols.beneAccNo),
        beneIfsc: Number(manualCols.beneIfsc),
        amount: Number(manualCols.amount),
        code: Number(manualCols.code),
      }
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allValid = previewData.records
        .map((r, idx) => r.status === 'VALID' ? idx : -1)
        .filter(idx => idx !== -1);
      setSelectedIndices(allValid);
    } else {
      setSelectedIndices([]);
    }
  };

  const handleToggleSelect = (index) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  const handleGenerateNfps = async () => {
    if (!previewData || selectedIndices.length === 0) {
      showWarning('Please select at least one valid record to generate NFPS Excel.');
      return;
    }

    const selectedRecords = selectedIndices.map(idx => previewData.records[idx]);

    setIsGenerating(true);
    try {
      // Format date as DD-MM-YYYY for NFPS Excel column
      const [y, m, d] = paymentDate.split('-');
      const formattedDate = `${d}-${m}-${y}`;

      const payload = {
        records: selectedRecords,
        originalFilename: file.name,
        debitAccountNo,
        creditNarration,
        paymentDate: formattedDate,
        refPrefix,
      };

      const res = await api.post('/nfps/generate', payload);

      setGeneratedResult(res);
      setCurrentStep('COMPLETE');
      showSuccess(`NFPS Excel generated successfully for ${selectedRecords.length} records!`);

      // Trigger automatic browser download
      downloadFile(res.fileBase64, res.nfpsFilename);
    } catch (err) {
      showError(err.message || 'Failed to generate NFPS Excel file.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadFile = (base64, filename) => {
    const link = document.createElement('a');
    link.href = base64.startsWith('data:') ? base64 : `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadHistoricalBatch = (batch) => {
    if (batch.nfpsFileBase64) {
      downloadFile(batch.nfpsFileBase64, batch.nfpsFilename || `NFPS_${batch.batchId}.xlsx`);
    } else {
      showWarning('Historical file content not available.');
    }
  };

  // Filtered records for preview table
  const filteredPreviewRecords = previewData ? previewData.records.filter(r => {
    if (filterStatus === 'ALL') return true;
    return r.status === filterStatus;
  }) : [];

  return (
    <div className="nfps-converter-page page-container fade-in">
      {/* Page Header Bar */}
      <div className="page-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Payments → Bank Statement to NFPS/NEFT Excel Conversion</h2>
          <p className="subtitle">Upload Bank Payment Statement Excel, validate beneficiary records, and generate master NFPS_FMT.xlsx file</p>
        </div>

        <div className="nav-tab-toggle" style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '8px' }}>
          <button
            className={`action-btn ${activeTab === 'CONVERT' ? 'primary-btn' : ''}`}
            onClick={() => setActiveTab('CONVERT')}
            style={{ padding: '6px 16px', fontSize: '0.85rem' }}
          >
            📥 Upload & Convert
          </button>
          <button
            className={`action-btn ${activeTab === 'HISTORY' ? 'primary-btn' : ''}`}
            onClick={() => setActiveTab('HISTORY')}
            style={{ padding: '6px 16px', fontSize: '0.85rem' }}
          >
            📜 Conversion History
          </button>
        </div>
      </div>

      {activeTab === 'CONVERT' && (
        <>
          {/* Workflow Steps Indicator Bar */}
          <div className="glass-panel workflow-stepper" style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 24px', marginBottom: '20px', background: 'rgba(30, 41, 59, 0.6)' }}>
            <div className={`step-item ${currentStep === 'UPLOAD' ? 'active' : ''}`} style={{ color: currentStep === 'UPLOAD' ? '#60a5fa' : '#94a3b8', fontWeight: '600' }}>
              1. Upload Statement
            </div>
            <div style={{ color: '#475569' }}>→</div>
            <div className={`step-item ${currentStep === 'PREVIEW' ? 'active' : ''}`} style={{ color: currentStep === 'PREVIEW' ? '#60a5fa' : '#94a3b8', fontWeight: '600' }}>
              2. Validate & Preview
            </div>
            <div style={{ color: '#475569' }}>→</div>
            <div className={`step-item ${currentStep === 'COMPLETE' ? 'active' : ''}`} style={{ color: currentStep === 'COMPLETE' ? '#10b981' : '#94a3b8', fontWeight: '600' }}>
              3. Download NFPS Excel
            </div>
          </div>

          {/* STEP 1: UPLOAD BANK STATEMENT */}
          {currentStep === 'UPLOAD' && (
            <div className="glass-panel shadow-md fade-in" style={{ padding: '28px', maxWidth: '850px', margin: '0 auto' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #334155', pb: '10px' }}>
                📁 Upload Bank Payment Statement (.xlsx)
              </h3>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div className="form-group span-2" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Select Bank Statement Excel File (.xlsx)</label>
                  <div className="file-drop-area" style={{ border: '2px dashed #3b82f6', borderRadius: '12px', padding: '30px', textAlign: 'center', background: 'rgba(59, 130, 246, 0.05)', cursor: 'pointer' }}>
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                      id="bank-file-input"
                    />
                    <label htmlFor="bank-file-input" style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📊</div>
                      <strong style={{ color: '#60a5fa', fontSize: '1.1rem' }}>
                        {file ? file.name : 'Click to Browse or Drag & Drop Excel File'}
                      </strong>
                      <p style={{ margin: '5px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                        Supported format: Excel (.xlsx, .xls) containing Farmer Name, Account No, IFSC, Amount
                      </p>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '600' }}>Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                  />
                  <small style={{ color: '#94a3b8' }}>Auto-detected from file statement or override</small>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '600' }}>Debit Account Number (DEBIT_ACC_NO)</label>
                  <select value={debitAccountNo} onChange={e => setDebitAccountNo(e.target.value)}>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.accountNumber || acc.id}>
                        {acc.name} ({acc.accountNumber || acc.id})
                      </option>
                    ))}
                  </select>
                  <small style={{ color: '#94a3b8' }}>ERP company debit bank account</small>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '600' }}>Credit Narration (CREDIT_NARR)</label>
                  <input
                    type="text"
                    value={creditNarration}
                    onChange={e => setCreditNarration(e.target.value)}
                    placeholder="e.g. MILK PAYMENT"
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '600' }}>NEFT Reference Prefix</label>
                  <input
                    type="text"
                    value={refPrefix}
                    onChange={e => setRefPrefix(e.target.value)}
                    placeholder="e.g. NEFT"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  className="primary-btn"
                  onClick={() => handleUploadAndParse(null)}
                  disabled={!file || isUploading}
                  style={{ padding: '12px 28px', fontSize: '1rem', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
                >
                  {isUploading ? 'Parsing Statement...' : '🔍 Upload & Validate Records →'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 1.5: MANUAL COLUMN MAPPING FALLBACK */}
          {currentStep === 'MANUAL_MAP' && (
            <div className="glass-panel shadow-md fade-in" style={{ padding: '28px', maxWidth: '850px', margin: '0 auto' }}>
              <h3 style={{ marginTop: 0, color: '#f59e0b', marginBottom: '15px' }}>
                ⚠️ Manual Column Mapping Required
              </h3>
              <p style={{ color: '#cbd5e1', marginBottom: '20px' }}>
                We could not automatically detect header columns in your file. Please specify column positions manually:
              </p>

              <form onSubmit={handleManualMapSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label>Header Row Number (0-indexed)</label>
                    <input type="number" min="0" value={headerRowIdx} onChange={e => setHeaderRowIdx(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Farmer / Beneficiary Name Column Index</label>
                    <input type="number" min="0" value={manualCols.farmerName} onChange={e => setManualCols({ ...manualCols, farmerName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Account Number Column Index</label>
                    <input type="number" min="0" value={manualCols.beneAccNo} onChange={e => setManualCols({ ...manualCols, beneAccNo: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>IFSC Code Column Index</label>
                    <input type="number" min="0" value={manualCols.beneIfsc} onChange={e => setManualCols({ ...manualCols, beneIfsc: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Amount Column Index</label>
                    <input type="number" min="0" value={manualCols.amount} onChange={e => setManualCols({ ...manualCols, amount: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="action-btn" onClick={() => setCurrentStep('UPLOAD')}>Cancel</button>
                  <button type="submit" className="primary-btn">Parse with Manual Mapping</button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2: CONVERSION PREVIEW */}
          {currentStep === 'PREVIEW' && previewData && (
            <div className="preview-container fade-in">
              {/* Summary Metrics Grid */}
              <div className="metrics-cards-grid four-cols" style={{ marginBottom: '20px' }}>
                <div className="metric-card glass-panel shadow-sm">
                  <span className="card-lbl">Total Uploaded Records</span>
                  <h3 className="card-val">{previewData.summary.total}</h3>
                </div>
                <div className="metric-card glass-panel shadow-sm border-left-green">
                  <span className="card-lbl">Valid Records</span>
                  <h3 className="card-val text-green">🟢 {previewData.summary.valid}</h3>
                </div>
                <div className="metric-card glass-panel shadow-sm border-left-red">
                  <span className="card-lbl">Invalid Records</span>
                  <h3 className="card-val text-red">🔴 {previewData.summary.invalid}</h3>
                </div>
                <div className="metric-card glass-panel shadow-sm border-left-amber">
                  <span className="card-lbl">Duplicate Records</span>
                  <h3 className="card-val text-amber">⚠️ {previewData.summary.duplicate}</h3>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="filter-toolbar glass-panel shadow-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontWeight: '600', color: '#94a3b8' }}>Filter Records:</span>
                  <button className={`action-btn ${filterStatus === 'ALL' ? 'primary-btn' : ''}`} onClick={() => setFilterStatus('ALL')}>All ({previewData.summary.total})</button>
                  <button className={`action-btn ${filterStatus === 'VALID' ? 'primary-btn' : ''}`} onClick={() => setFilterStatus('VALID')}>Valid ({previewData.summary.valid})</button>
                  <button className={`action-btn ${filterStatus === 'INVALID' ? 'primary-btn' : ''}`} onClick={() => setFilterStatus('INVALID')}>Invalid ({previewData.summary.invalid})</button>
                  <button className={`action-btn ${filterStatus === 'DUPLICATE' ? 'primary-btn' : ''}`} onClick={() => setFilterStatus('DUPLICATE')}>Duplicates ({previewData.summary.duplicate})</button>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right', marginRight: '10px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block' }}>Selected Valid Amount</span>
                    <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>
                      ₹{selectedIndices.reduce((sum, idx) => sum + (previewData.records[idx]?.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>

                  <button className="action-btn" onClick={() => setCurrentStep('UPLOAD')}>← Back</button>
                  <button
                    className="primary-btn"
                    onClick={handleGenerateNfps}
                    disabled={selectedIndices.length === 0 || isGenerating}
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '10px 24px', fontSize: '0.95rem' }}
                  >
                    {isGenerating ? 'Generating NFPS Excel...' : `⚡ Generate NFPS Excel (${selectedIndices.length}) →`}
                  </button>
                </div>
              </div>

              {/* Records Preview Table */}
              <div className="logs-table-card glass-panel shadow-md">
                <div className="table-responsive">
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input
                            type="checkbox"
                            checked={selectedIndices.length === previewData.summary.valid && previewData.summary.valid > 0}
                            onChange={handleSelectAll}
                          />
                        </th>
                        <th>#</th>
                        <th>Farmer / Beneficiary Name</th>
                        <th>Beneficiary Ac No</th>
                        <th>IFSC Code</th>
                        <th>Amount (₹)</th>
                        <th>Status</th>
                        <th>Validation Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPreviewRecords.map((r, originalIdx) => {
                        const isSelected = selectedIndices.includes(originalIdx);
                        return (
                          <tr key={originalIdx} style={{ background: r.status === 'INVALID' ? 'rgba(239, 68, 68, 0.08)' : r.status === 'DUPLICATE' ? 'rgba(245, 158, 11, 0.08)' : 'transparent' }}>
                            <td>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={r.status !== 'VALID'}
                                onChange={() => handleToggleSelect(originalIdx)}
                              />
                            </td>
                            <td>{r.sourceRowNumber || originalIdx + 1}</td>
                            <td><strong>{r.farmerName || '-'}</strong></td>
                            <td><code>{r.beneAccNo || '-'}</code></td>
                            <td><code>{r.beneIfsc || '-'}</code></td>
                            <td style={{ fontWeight: '600', color: '#10b981' }}>₹{(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td>
                              {r.status === 'VALID' && <span className="status-pill status-active">🟢 Valid</span>}
                              {r.status === 'INVALID' && <span className="status-pill status-rejected">🔴 Invalid</span>}
                              {r.status === 'DUPLICATE' && <span className="status-pill status-pending">⚠️ Duplicate</span>}
                            </td>
                            <td style={{ fontSize: '0.85rem', color: r.status === 'VALID' ? '#10b981' : '#ef4444' }}>
                              {r.status === 'VALID' ? 'Ready for NFPS conversion' : r.errorMessage}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CONVERSION COMPLETE */}
          {currentStep === 'COMPLETE' && generatedResult && (
            <div className="glass-panel shadow-md fade-in text-center" style={{ padding: '40px', maxWidth: '650px', margin: '0 auto' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '15px' }}>🎉</div>
              <h2 style={{ color: '#10b981', margin: '0 0 10px 0' }}>NFPS Excel Generated Successfully!</h2>
              <p style={{ color: '#cbd5e1', fontSize: '1rem', marginBottom: '25px' }}>
                Batch <strong>{generatedResult.batch.batchId}</strong> has been created and saved in the ERP database audit trail.
              </p>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', marginBottom: '25px', textAlign: 'left' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem' }}>
                  <div><strong>Batch ID:</strong> <code>{generatedResult.batch.batchId}</code></div>
                  <div><strong>Generated File:</strong> <code>{generatedResult.nfpsFilename}</code></div>
                  <div><strong>Total Records:</strong> {generatedResult.batch.totalRecords}</div>
                  <div><strong>Total Amount:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>₹{generatedResult.batch.totalAmount.toLocaleString()}</span></div>
                  <div><strong>Debit Account:</strong> <code>{generatedResult.batch.debitAccountNo}</code></div>
                  <div><strong>Payment Date:</strong> {generatedResult.batch.paymentDate}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                <button
                  className="primary-btn"
                  onClick={() => downloadFile(generatedResult.fileBase64, generatedResult.nfpsFilename)}
                  style={{ padding: '12px 24px', fontSize: '1rem', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  📥 Re-Download NFPS_FMT.xlsx
                </button>
                <button
                  className="action-btn"
                  onClick={() => { setCurrentStep('UPLOAD'); setFile(null); setPreviewData(null); }}
                  style={{ padding: '12px 24px', fontSize: '1rem' }}
                >
                  🔄 Convert Another Statement
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* BATCH CONVERSION HISTORY TAB */}
      {activeTab === 'HISTORY' && (
        <div className="history-container fade-in">
          <div className="logs-table-card glass-panel shadow-md">
            <div className="table-responsive">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th>Original Filename</th>
                    <th>NFPS Output File</th>
                    <th>Upload Date & Time</th>
                    <th>Records (Val/Inv/Dup)</th>
                    <th>Total Amount (₹)</th>
                    <th>Uploaded By</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingHistory ? (
                    <tr>
                      <td colSpan={8} className="text-center py-6">Loading batch conversion history...</td>
                    </tr>
                  ) : batches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-6">No historical NFPS conversion batches found.</td>
                    </tr>
                  ) : (
                    batches.map(batch => (
                      <tr key={batch._id || batch.batchId}>
                        <td><code>{batch.batchId}</code></td>
                        <td>{batch.originalFilename}</td>
                        <td><strong>{batch.nfpsFilename}</strong></td>
                        <td>{new Date(batch.createdAt).toLocaleString('en-IN')}</td>
                        <td>
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>{batch.validRecords}</span> / <span style={{ color: '#ef4444' }}>{batch.invalidRecords}</span> / <span style={{ color: '#f59e0b' }}>{batch.duplicateRecords}</span>
                        </td>
                        <td style={{ fontWeight: 'bold', color: '#10b981' }}>₹{(batch.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td>{batch.createdBy}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="action-btn"
                            onClick={() => handleDownloadHistoricalBatch(batch)}
                            title="Download Generated NFPS Excel File"
                            style={{ fontSize: '0.85rem', padding: '4px 10px' }}
                          >
                            📥 Download NFPS
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NfpsConverter;
