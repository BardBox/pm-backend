import { Router } from "express";
import {
  createPmPlan,
  getAllPmPlans,
  getPmPlan,
  getActivePmPlans,
  updatePmPlan,
  deletePmPlan,
} from "../controllers/pmPlan.controller.js";

const router = Router();

// Public - get active plans (for checkout/landing page)
router.get("/active", getActivePmPlans);

// Admin - manage plans
router.get("/", getAllPmPlans);
router.get("/:id", getPmPlan);
router.post("/", createPmPlan);
router.patch("/:id", updatePmPlan);
router.delete("/:id", deletePmPlan);

export default router;
