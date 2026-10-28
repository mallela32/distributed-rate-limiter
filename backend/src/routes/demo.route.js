import express from "express";
import {
  login,
  sendMessage,
  getProducts,
} from "../controller/demo.controller.js";

const router = express.Router();

router.post("/login", login);
router.post("/messages", sendMessage);
router.get("/products", getProducts);

export default router;
