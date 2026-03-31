import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  getAllLandingPages,
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
  uploadZip,
  pullGithub,
} from "../controllers/pmLandingPage.controller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_TMP = path.join(__dirname, "../../public/tmp");
if (!fs.existsSync(UPLOAD_TMP)) fs.mkdirSync(UPLOAD_TMP, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_TMP),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/zip" || file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Only ZIP files are allowed"));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const router = Router();

router.get("/", getAllLandingPages);
router.post("/", createLandingPage);
router.patch("/:id", updateLandingPage);
router.delete("/:id", deleteLandingPage);
router.post("/:id/upload-zip", upload.single("zip"), uploadZip);
router.post("/:id/pull-github", pullGithub);

export default router;
