import { Router } from "express";
import { captureLead } from "../controllers/leadController.js";

const router = Router();

// Public, same as /ask — hit directly by the widget on a customer's site.
router.post("/leads", captureLead);

export default router;