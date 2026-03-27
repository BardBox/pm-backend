import { Router } from "express";
import {
  getAllTemplates,
  getTemplate,
  createTemplate,
  createOnTft,
  syncFromTft,
  getTemplatePreview,
  getChannels,
  updateTemplate,
  deleteTemplate,
  sendWhatsapp,
} from "../controllers/pmWhatsappTemplate.controller.js";

const router = Router();

// TFT integration endpoints (must be before /:id routes)
router.post("/create-on-tft", createOnTft);
router.post("/sync", syncFromTft);
router.get("/channels", getChannels);

// CRUD
router.get("/", getAllTemplates);
router.get("/:id", getTemplate);
router.post("/", createTemplate);
router.put("/:id", updateTemplate);
router.delete("/:id", deleteTemplate);

// Actions
router.post("/:id/send", sendWhatsapp);
router.get("/:id/preview", getTemplatePreview);

export default router;
