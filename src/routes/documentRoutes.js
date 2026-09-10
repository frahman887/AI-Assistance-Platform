import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { uploadPdf } from "../middleware/uploadMiddleware.js";
import {
  uploadDocument,
  listDocuments,
  deleteDocument
} from "../controllers/documentController.js";

const router = express.Router();

router.post("/upload", requireAuth, uploadPdf, uploadDocument);
router.get("/", requireAuth, listDocuments);
router.delete("/:id", requireAuth, deleteDocument);

export default router;