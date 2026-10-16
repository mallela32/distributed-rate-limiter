import "../config/loadEnvFile.js";
import express from "express";
import RateLimitingRouter from "./routes/rate-limiter.route.js";

const app = express();
app.use(express.json());
app.use("/rate-limiter", RateLimitingRouter);

export default app;
