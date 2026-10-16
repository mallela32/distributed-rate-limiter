import express from "express";
import {
  checkController,
  updateSettings,
} from "../controller/rate-limiter.controller.js";
const router = express.Router();

router.post("/check", checkController);
router.post("/update-settings", updateSettings);
export default router;
