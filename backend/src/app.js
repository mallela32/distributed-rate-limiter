import express from "express";
import demoRouter from "./routes/demo.route.js";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
app.use("/api", demoRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

export default app;
