import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import ragRoutes from "./routes/ragRoutes.js";
import leadRoutes from "./routes/leadRoutes.js";

const app = express();
app.use(express.static("public"));
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/documents", documentRoutes);

app.use("/", ragRoutes);
app.use("/", leadRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;