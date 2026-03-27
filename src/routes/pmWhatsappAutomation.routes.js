import { Router } from "express";
import {
  getAllAutomations,
  getAutomationGroups,
  getPipelineStages,
  createCustomGroup,
  deleteCustomGroup,
  upsertAutomation,
  deleteAutomation,
} from "../controllers/pmWhatsappAutomation.controller.js";

const router = Router();

router.get("/", getAllAutomations);
router.get("/groups", getAutomationGroups);
router.get("/pipeline-stages", getPipelineStages);
router.post("/groups", createCustomGroup);
router.delete("/groups/:type", deleteCustomGroup);
router.put("/", upsertAutomation);
router.delete("/:id", deleteAutomation);

export default router;
