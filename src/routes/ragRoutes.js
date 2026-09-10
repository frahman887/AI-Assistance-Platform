import { Router } from "express";
import { askQuestion } from "../controllers/ragController.js";

const router = Router();

// Intentionally no requireAuth here — this is hit by the public-facing
// widget, not the logged-in business owner.
router.post("/ask", askQuestion);

export default router;