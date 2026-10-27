import "../config/loadEnvFile.js";
import express from "express";
import RateLimitingRouter from "./routes/rate-limiter.route.js";
import { logger } from "./utils/logger.js";

const app = express();
app.use(express.json());
app.use("/rate-limiter", RateLimitingRouter);

app.use((err, req, res, next) => {
  logger.error("unhandled error", { message: err.message });
  res.status(500).json({ error: "internal server error" });
});

export default app;
