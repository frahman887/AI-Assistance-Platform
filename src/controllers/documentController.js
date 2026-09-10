import { db } from "../config/db.js";
import { uploadBlob, deleteBlob } from "../services/blobService.js";
import { processDocument } from "../services/documentProcessingService.js";

export async function uploadDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const userId = req.user.userId;
    const { originalname, buffer } = req.file;

    const { blobName, url } = await uploadBlob(buffer, originalname, userId);

    const result = await db.query(
      `INSERT INTO documents (user_id, file_name, blob_url, uploaded_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, file_name, blob_url, uploaded_at`,
      [userId, originalname, url]
    );

    const document = result.rows[0];

    let processingResult;
    try {
      processingResult = await processDocument(document.id, userId, buffer);
    } catch (procErr) {
      console.error("Processing failed for document", document.id, procErr);
      return res.status(201).json({
        document,
        blobName,
        warning: "Document uploaded but processing failed: " + procErr.message
      });
    }

    res.status(201).json({
      document,
      blobName,
      processing: processingResult
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
}

export async function listDocuments(req, res) {
  try {
    const userId = req.user.userId;
    const result = await db.query(
      `SELECT id, file_name, blob_url, uploaded_at
       FROM documents
       WHERE user_id = $1
       ORDER BY uploaded_at DESC`,
      [userId]
    );
    res.json({ documents: result.rows });
  } catch (err) {
    console.error("List error:", err);
    res.status(500).json({ error: "Failed to list documents" });
  }
}

export async function deleteDocument(req, res) {
  try {
    const userId = req.user.userId;
    const documentId = parseInt(req.params.id, 10);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: "Invalid document ID" });
    }

    const findResult = await db.query(
      `SELECT id, blob_url FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    if (findResult.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const doc = findResult.rows[0];
    const blobName = doc.blob_url.split("/documents/")[1];

    if (blobName) {
      await deleteBlob(blobName);
    }

    await db.query(`DELETE FROM documents WHERE id = $1`, [documentId]);

    res.json({ deleted: true, id: documentId });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
}