import dbConnect from '../../_lib/db.js';
import NfpsBatch from '../../_models/NfpsBatch.js';
import NfpsRecord from '../../_models/NfpsRecord.js';
import AuditTrail from '../../_models/AuditTrail.js';
import { verifyAuth } from '../../_lib/auth.js';
import { generateNfpsExcel } from '../../_lib/nfpsEngine.js';
import { generateVoucherRef } from '../../_lib/referenceGenerator.js';

export default async function handler(req, res) {
  try {
    await dbConnect();
    const user = verifyAuth(req);

    if (req.method === 'POST') {
      const {
        records,
        originalFilename,
        debitAccountNo,
        creditNarration,
        paymentDate,
        refPrefix = 'NEFT',
      } = req.body;

      if (!records || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'No valid records provided for NFPS generation.' });
      }

      // Generate unique Batch ID (e.g. BANK-20260825-001)
      const dateTag = (paymentDate || new Date().toISOString().slice(0, 10)).replace(/[^0-9]/g, '');
      const batchCount = await NfpsBatch.countDocuments() + 1;
      const batchId = `BANK-${dateTag}-${String(batchCount).padStart(3, '0')}`;

      // Assign unique NEFT Reference Numbers for each record using atomic sequence counter
      const processedRecords = [];
      let totalAmount = 0;

      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const refNo = await generateVoucherRef('IN', 'PAYMENT'); // Uses atomic YYYY-IN-PAYMENT-XXXXXX format or custom prefix
        const finalRef = `${refPrefix || 'NEFT'}${refNo.replace(/[^0-9]/g, '')}`;

        const nfpsRec = {
          batchId,
          sourceFilename: originalFilename || 'Bank_Statement.xlsx',
          sourceRowNumber: r.sourceRowNumber || (i + 1),
          sourceCode: r.code || '',
          pymtProdTypeCode: 'PAB_VENDOR',
          pymtMode: 'NEFT',
          debitAccNo: debitAccountNo || '50100000000000',
          farmerName: r.farmerName,
          beneAccNo: r.beneAccNo,
          beneIfsc: r.beneIfsc,
          amount: Number(r.amount || 0),
          creditNarr: creditNarration || 'MILK PAYMENT',
          paymentDate: paymentDate || new Date().toLocaleDateString('en-IN'),
          refNo: finalRef,
          status: 'SAVED',
          createdBy: user.name,
        };

        totalAmount += nfpsRec.amount;
        processedRecords.push(nfpsRec);
      }

      // Save individual NEFT records in MongoDB audit log
      await NfpsRecord.insertMany(processedRecords);

      // Generate Master NFPS_FMT.xlsx Excel file
      const nfpsFile = generateNfpsExcel(
        processedRecords,
        debitAccountNo,
        creditNarration,
        paymentDate,
        refPrefix
      );

      // Save Batch record in MongoDB
      const newBatch = await NfpsBatch.create({
        batchId,
        originalFilename: originalFilename || 'Bank_Statement.xlsx',
        debitAccountNo: debitAccountNo || '50100000000000',
        creditNarration: creditNarration || 'MILK PAYMENT',
        paymentDate: paymentDate || new Date().toLocaleDateString('en-IN'),
        refPrefix,
        totalRecords: records.length,
        validRecords: records.length,
        invalidRecords: 0,
        duplicateRecords: 0,
        totalAmount: Math.round(totalAmount * 100) / 100,
        nfpsFilename: nfpsFile.filename,
        nfpsFileBase64: nfpsFile.base64,
        status: 'PROCESSED',
        createdBy: user.name,
        createdById: user.id || user.name,
      });

      // Write system audit log
      await AuditTrail.create({
        action: 'NFPS_BATCH_GENERATED',
        user: user.name,
        role: user.role,
        details: {
          batchId,
          recordCount: records.length,
          totalAmount: newBatch.totalAmount,
          filename: nfpsFile.filename,
        },
      });

      return res.status(200).json({
        message: `NFPS Excel file successfully generated for Batch ${batchId}!`,
        batch: newBatch,
        nfpsFilename: nfpsFile.filename,
        fileBase64: nfpsFile.base64,
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('NFPS Generation Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate NFPS Excel file.' });
  }
}
