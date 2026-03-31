import { Router } from "express";
import {
  getAllForms,
  createForm,
  updateForm,
  deleteForm,
} from "../controllers/pmForm.controller.js";

const router = Router();

router.get("/", getAllForms);
router.post("/", createForm);
router.patch("/:id", updateForm);
router.delete("/:id", deleteForm);

export default router;
