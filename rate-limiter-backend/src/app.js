import "../config/loadEnvFile.js";
import express from "express";
import RateLimitingRouter from "./routes/rate-limiter.route.js";

const app = express();
app.use(express.json());
app.use("/rate-limiter", RateLimitingRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

export default app;
