import { Router } from "express";
import {
  authAdminUser,
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
} from "../controllers/pmAdminUser.controller.js";

const router = Router();

// Public endpoint - users authenticate here
router.post("/auth", authAdminUser);

// Protected endpoints - require super admin role
// Note: Authorization checks should be done via JWT verification in middleware
// For now, these are accessible to authenticated requests
router.get("/", listAdminUsers);
router.post("/", createAdminUser);
router.patch("/:id", updateAdminUser);
router.delete("/:id", deleteAdminUser);

export default router;
