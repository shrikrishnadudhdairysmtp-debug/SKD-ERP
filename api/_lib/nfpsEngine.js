import * as XLSX from 'xlsx';
import dbConnect from './db.js';
import NfpsRecord from '../_models/NfpsRecord.js';

/**
 * Clean string helper
 */
function cleanStr(val) {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

/**
 * Standard IFSC Code Validator (4 letters + 0 + 6 alphanumeric characters)
 */
export function validateIfsc(ifsc) {
  if (!ifsc) return false;
  const clean = cleanStr(ifsc).toUpperCase().replace(/\s+/g, '');
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(clean);
}

/**
 * Extract Date from Title Text or Filename (e.g. "Date : 11-08-2026 To : 20-08-2026" or "Bank Statement11082026MorningTo20082026Evening.xlsx")
 */
export function extractDateFromHeaderOrFilename(text, filename = '') {
  const combined = `${text || ''} ${filename || ''}`;
  
  // Try pattern 1: DD-MM-YYYY To DD-MM-YYYY or DD/MM/YYYY
  const rangeMatch = combined.match(/(\d{2}[-/\.]\d{2}[-/\.]\d{4})\s*(?:to|-)?\s*(\d{2}[-/\.]\d{2}[-/\.]\d{4})/i);
  if (rangeMatch && rangeMatch[2]) {
    const parts = rangeMatch[2].split(/[-/\.]/);
    return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
  }

  // Try pattern 2: Compact 8 digit dates in filename e.g. 11082026To20082026
  const compactMatch = combined.match(/(\d{8})[a-z]*(?:to)?\s*(\d{8})/i);
  if (compactMatch && compactMatch[2]) {
    const dStr = compactMatch[2];
    const day = dStr.slice(0, 2);
    const month = dStr.slice(2, 4);
    const year = dStr.slice(4, 8);
    return `${day}-${month}-${year}`;
  }

  // Fallback to today's date formatted as DD-MM-YYYY
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}-${m}-${y}`;
}

/**
 * Dynamic Excel Reader and Header Detector
 */
export function parseBankStatementBuffer(fileBuffer, customMapping = null) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, cellText: false });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  let titleHeaderInfo = '';
  let headerRowIndex = -1;
  let colIndexes = {
    farmerName: -1,
    beneAccNo: -1,
    beneIfsc: -1,
    amount: -1,
    code: -1,
    srNo: -1,
  };

  // Search for table header row
  for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
    const row = rawRows[r].map(c => cleanStr(c).toLowerCase());
    
    // Concatenate upper title text for date detection
    if (headerRowIndex === -1 && row.some(cell => cell.includes('date') || cell.includes('statement') || cell.includes('period'))) {
      titleHeaderInfo += ' ' + rawRows[r].join(' ');
    }

    const hasName = row.some(c => c.includes('farmer') || c.includes('beneficiary') || c.includes('party') || c === 'name' || c.includes('name'));
    const hasAcc = row.some(c => c.includes('ac') || c.includes('acc') || c.includes('account'));
    const hasIfsc = row.some(c => c.includes('ifsc'));
    const hasAmt = row.some(c => c.includes('amount') || c.includes('amt'));

    if (hasName && (hasAcc || hasIfsc || hasAmt)) {
      headerRowIndex = r;
      row.forEach((cell, cIdx) => {
        if (cell.includes('farmer') || cell.includes('beneficiary') || cell.includes('party') || cell === 'name' || cell.includes('name')) colIndexes.farmerName = cIdx;
        if (cell.includes('ac') || cell.includes('acc') || cell.includes('account')) colIndexes.beneAccNo = cIdx;
        if (cell.includes('ifsc')) colIndexes.beneIfsc = cIdx;
        if (cell.includes('amount') || cell.includes('amt')) colIndexes.amount = cIdx;
        if (cell.includes('code') || cell.includes('farmer code')) colIndexes.code = cIdx;
        if (cell.includes('sr') || cell.includes('srno') || cell.includes('s.no')) colIndexes.srNo = cIdx;
      });
      break;
    }
  }

  // Use custom mapping if header detection failed or override provided
  if (customMapping) {
    headerRowIndex = customMapping.headerRowIndex || 0;
    colIndexes = { ...colIndexes, ...customMapping.colIndexes };
  }

  if (headerRowIndex === -1 || colIndexes.farmerName === -1 || colIndexes.beneAccNo === -1 || colIndexes.amount === -1) {
    return {
      success: false,
      error: 'We could not automatically identify the required payment columns.',
      rawRows: rawRows.slice(0, 15),
      titleHeaderInfo,
    };
  }

  // Extract Payment Records
  const records = [];
  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const farmerName = cleanStr(row[colIndexes.farmerName]);
    const beneAccNo = cleanStr(row[colIndexes.beneAccNo]).replace(/[^0-9A-Za-z]/g, '');
    const beneIfsc = cleanStr(row[colIndexes.beneIfsc]).toUpperCase().replace(/\s+/g, '');
    const rawAmt = row[colIndexes.amount];
    const amount = typeof rawAmt === 'number' ? rawAmt : parseFloat(cleanStr(rawAmt).replace(/,/g, '')) || 0;
    const code = colIndexes.code !== -1 ? cleanStr(row[colIndexes.code]) : '';
    const srNo = colIndexes.srNo !== -1 ? cleanStr(row[colIndexes.srNo]) : String(r - headerRowIndex);

    // Skip empty trailing rows
    if (!farmerName && !beneAccNo && amount === 0) continue;

    records.push({
      sourceRowNumber: r + 1,
      srNo,
      farmerName,
      beneAccNo,
      beneIfsc,
      amount,
      code,
    });
  }

  return {
    success: true,
    titleHeaderInfo,
    headerRowIndex,
    colIndexes,
    records,
  };
}

/**
 * Validate records and perform duplicate checks
 */
export async function validateAndCheckDuplicates(records, existingDbRecords = []) {
  await dbConnect();

  const validatedList = [];
  const seenAccNoMap = new Map();

  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;
  let totalValidAmount = 0;

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const errors = [];

    // Validation Rules
    if (!rec.farmerName) {
      errors.push('Beneficiary/Farmer name is missing');
    }

    if (!rec.beneAccNo) {
      errors.push('Account number is missing');
    } else if (rec.beneAccNo.length < 6) {
      errors.push('Account number must be at least 6 digits');
    }

    if (!rec.beneIfsc) {
      errors.push('IFSC code is missing');
    } else if (!validateIfsc(rec.beneIfsc)) {
      errors.push(`Invalid IFSC code format: "${rec.beneIfsc}" (Expected e.g. HDFC0002260)`);
    }

    if (rec.amount <= 0 || isNaN(rec.amount)) {
      errors.push('Payment amount must be a number greater than 0');
    }

    // Duplicate Check within current file
    const fileKey = `${rec.beneAccNo}_${rec.amount}`;
    let isDup = false;
    if (seenAccNoMap.has(fileKey)) {
      isDup = true;
      errors.push(`Duplicate payment record in file (Row ${seenAccNoMap.get(fileKey)})`);
    } else if (rec.beneAccNo && rec.amount > 0) {
      seenAccNoMap.set(fileKey, rec.sourceRowNumber);
    }

    // Duplicate Check against Database
    if (!isDup && rec.beneAccNo) {
      const dbMatch = await NfpsRecord.findOne({
        beneAccNo: rec.beneAccNo,
        amount: rec.amount,
      }).lean();

      if (dbMatch) {
        isDup = true;
        errors.push(`Already imported in Batch "${dbMatch.batchId}" with Ref #${dbMatch.refNo}`);
      }
    }

    let status = 'VALID';
    if (isDup) {
      status = 'DUPLICATE';
      duplicateCount++;
    } else if (errors.length > 0) {
      status = 'INVALID';
      invalidCount++;
    } else {
      validCount++;
      totalValidAmount += rec.amount;
    }

    validatedList.push({
      ...rec,
      status,
      errorMessage: errors.join('; '),
    });
  }

  return {
    records: validatedList,
    summary: {
      total: records.length,
      valid: validCount,
      invalid: invalidCount,
      duplicate: duplicateCount,
      totalValidAmount: Math.round(totalValidAmount * 100) / 100,
    }
  };
}

/**
 * Generate Master NFPS_FMT.xlsx Output File matching exact structure of C:\Users\sachi\Downloads\NFPS_FMT (1).xlsx
 */
export function generateNfpsExcel(nfpsRecords, debitAccountNo, creditNarration, paymentDate, refPrefix = 'NEFT') {
  // Master Column Header Structure (Exact 13 columns in exact order matching master template)
  const masterHeaders = [
    'PYMT_PROD_TYPE_CODE',
    'PYMT_MODE',
    'DEBIT_ACC_NO',
    'BNF_NAME',
    'BENE_ACC_NO',
    'BENE_IFSC',
    'AMOUNT',
    'CREDIT_NARR',
    'PYMT_DATE',
    'MOBILE_NUM',
    'EMAIL_ID',
    'REMARK',
    'REF_NO'
  ];

  const worksheet = {};
  
  // Set headers as string cells in Row 1
  masterHeaders.forEach((header, colIdx) => {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    worksheet[cellAddr] = { t: 's', v: header, z: '@' };
  });

  // Set data rows with explicit TEXT formatting ('t': 's', 'z': '@') for account numbers, IFSC, date, and strings
  nfpsRecords.forEach((rec, idx) => {
    const rowIdx = idx + 1;
    const refNo = rec.refNo || `${refPrefix}${paymentDate.replace(/[^0-9]/g, '')}${String(idx + 1).padStart(4, '0')}`;

    const rowData = [
      { t: 's', v: String(rec.pymtProdTypeCode || 'PAB_VENDOR'), z: '@' },
      { t: 's', v: String(rec.pymtMode || 'NEFT'), z: '@' },
      { t: 's', v: String(debitAccountNo || rec.debitAccNo || '50100000000000'), z: '@' },
      { t: 's', v: String(rec.farmerName || ''), z: '@' },
      { t: 's', v: String(rec.beneAccNo || ''), z: '@' },
      { t: 's', v: String(rec.beneIfsc || ''), z: '@' },
      { t: 'n', v: Number(rec.amount || 0), z: '0.00' },
      { t: 's', v: String(creditNarration || rec.creditNarr || 'MILK PAYMENT'), z: '@' },
      { t: 's', v: String(paymentDate || rec.paymentDate || ''), z: '@' },
      { t: 's', v: String(rec.mobileNum || ''), z: '@' },
      { t: 's', v: String(rec.emailId || ''), z: '@' },
      { t: 's', v: String(rec.code ? `CODE:${rec.code}` : (rec.remark || '')), z: '@' },
      { t: 's', v: String(refNo || ''), z: '@' },
    ];

    rowData.forEach((cellObj, colIdx) => {
      const cellAddr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
      worksheet[cellAddr] = cellObj;
    });
  });

  // Set worksheet range reference
  const totalRows = nfpsRecords.length + 1;
  const range = { s: { r: 0, c: 0 }, e: { r: totalRows - 1, c: 12 } };
  worksheet['!ref'] = XLSX.utils.encode_range(range);

  // Match sheet name "Sheet1" exactly as in master template
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  const fileBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const base64 = fileBuffer.toString('base64');

  return {
    fileBuffer,
    base64,
    filename: `NFPS_FMT_${paymentDate.replace(/[^0-9]/g, '')}_${Date.now().toString().slice(-4)}.xlsx`,
  };
}
