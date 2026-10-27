import express from "express";
import {
  checkController,
  updateSettings,
  listRules,
  deleteRule,
  getMetrics,
} from "../controller/rate-limiter.controller.js";
const router = express.Router();

router.post("/check", checkController);
router.post("/update-settings", updateSettings);
router.get("/rules", listRules);
router.post("/delete-rule", deleteRule);
router.get("/metrics", getMetrics);
export default router;
