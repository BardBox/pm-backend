import { Router } from "express";
import {
  getAllTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  sendCampaign,
} from "../controllers/pmEmailTemplate.controller.js";

const router = Router();

router.get("/", getAllTemplates);
router.get("/:id", getTemplate);
router.post("/", createTemplate);
router.put("/:id", updateTemplate);
router.delete("/:id", deleteTemplate);
router.post("/:id/send", sendCampaign);

export default router;
