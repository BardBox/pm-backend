import { Router } from "express";
import { createUpload } from "../middlewares/multer.middleware.js";
import {
  getStories,
  getAllStories,
  createStory,
  updateStory,
  deleteStory,
} from "../controllers/pmStory.controller.js";

const router = Router();
const upload = createUpload("story");
const storyUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "logo", maxCount: 1 },
]);

// Public
router.get("/", getStories);

// Admin
router.get("/all", getAllStories);
router.post("/", storyUpload, createStory);
router.patch("/:id", storyUpload, updateStory);
router.delete("/:id", deleteStory);

export default router;
