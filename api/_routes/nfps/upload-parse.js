import dbConnect from '../../_lib/db.js';
import { verifyAuth } from '../../_lib/auth.js';
import { parseBankStatementBuffer, validateAndCheckDuplicates, extractDateFromHeaderOrFilename } from '../../_lib/nfpsEngine.js';

export default async function handler(req, res) {
  try {
    await dbConnect();
    const user = verifyAuth(req);

    if (req.method === 'POST') {
      const { fileBase64, filename, customMapping } = req.body;

      if (!fileBase64) {
        return res.status(400).json({ error: 'Missing Excel file payload.' });
      }

      // Clean Base64 header if present
      let cleanB64 = fileBase64;
      if (cleanB64.includes('base64,')) {
        cleanB64 = cleanB64.split('base64,')[1];
      }
      const fileBuffer = Buffer.from(cleanB64, 'base64');

      // Step 1: Parse and detect headers
      const parseResult = parseBankStatementBuffer(fileBuffer, customMapping);

      if (!parseResult.success) {
        return res.status(200).json({
          success: false,
          needsManualMapping: true,
          error: parseResult.error,
          rawRows: parseResult.rawRows,
          titleHeaderInfo: parseResult.titleHeaderInfo,
        });
      }

      // Step 2: Extract Payment Date Range from header text or filename
      const detectedDate = extractDateFromHeaderOrFilename(parseResult.titleHeaderInfo, filename);

      // Step 3: Validate Records and Check Duplicates against DB
      const validationResult = await validateAndCheckDuplicates(parseResult.records);

      return res.status(200).json({
        success: true,
        filename,
        detectedDate,
        summary: validationResult.summary,
        records: validationResult.records,
        titleHeaderInfo: parseResult.titleHeaderInfo,
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Bank Statement Parse Error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse Bank Statement file' });
  }
}
