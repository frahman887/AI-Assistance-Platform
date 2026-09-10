import express from "express";
import { healthCheck, healthCheckDb } from "../controllers/healthController.js";

const router = express.Router();

router.get("/", healthCheck);
router.get("/db", healthCheckDb);

export default router;