import { Router } from "express";
import {
  getScoringConfig,
  updateScoringConfig,
  addEvent,
  updateEvent,
  deleteEvent,
  addPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  resetScoringConfig,
} from "../controllers/pmScoringConfig.controller.js";

const router = Router();

router.get("/", getScoringConfig);
router.patch("/", updateScoringConfig);
router.post("/reset", resetScoringConfig);

// Event CRUD
router.post("/events", addEvent);
router.patch("/events/:eventId", updateEvent);
router.delete("/events/:eventId", deleteEvent);

// Pipeline Stage CRUD
router.post("/stages", addPipelineStage);
router.patch("/stages/:stageId", updatePipelineStage);
router.delete("/stages/:stageId", deletePipelineStage);

export default router;
