import { db } from "../config/db.js";

export const healthCheck = (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
};

export const healthCheckDb = async (req, res) => {
  try {
    const result = await db.query("SELECT NOW() as now, version() as version");
    res.json({
      status: "ok",
      db_time: result.rows[0].now,
      db_version: result.rows[0].version.split(" ").slice(0, 2).join(" ")
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};