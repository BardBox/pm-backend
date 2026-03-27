import { Router } from "express";
import {
  getAllPlugins,
  getPluginNav,
  getPluginBySlug,
  createPlugin,
  updatePlugin,
  deletePlugin,
  testPlugin,
  proxyRequest,
  addEndpoint,
  removeEndpoint,
} from "../controllers/pmApiPlugin.controller.js";

const router = Router();

router.get("/", getAllPlugins);
router.get("/nav", getPluginNav);
router.get("/:slug", getPluginBySlug);
router.post("/", createPlugin);
router.put("/:slug", updatePlugin);
router.delete("/:slug", deletePlugin);
router.post("/:slug/test", testPlugin);
router.post("/:slug/request", proxyRequest);
router.post("/:slug/endpoints", addEndpoint);
router.delete("/:slug/endpoints/:endpointId", removeEndpoint);

export default router;
