import { Router } from "express";
import {
  getIntegrations,
  testIntegration,
  testAllIntegrations,
} from "../controllers/pmApiIntegrations.controller.js";

const router = Router();

router.get("/", getIntegrations);
router.post("/:id/test", testIntegration);
router.post("/test-all", testAllIntegrations);

export default router;
