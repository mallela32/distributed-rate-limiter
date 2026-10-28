import express from "express";
import {
  login,
  sendMessage,
  getProducts,
} from "../controller/demo.controller.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = express.Router();
router.use(rateLimit);

router.post("/login", login);
router.post("/messages", sendMessage);
router.get("/products", getProducts);

export default router;
