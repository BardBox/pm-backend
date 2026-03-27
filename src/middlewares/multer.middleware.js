import multer from "multer";
import path from "path";
import fs from "fs";

const baseImageDir = path.join(process.cwd(), "public", "assets", "images");

// Ensure directory exists
if (!fs.existsSync(baseImageDir)) fs.mkdirSync(baseImageDir, { recursive: true });

// Image upload
export const createUpload = (category) => {
  const validCategories = ["story"];
  if (!validCategories.includes(category))
    throw new Error(`Invalid category. Must be one of: ${validCategories.join(", ")}`);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(baseImageDir, category);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
    },
  });

  return multer({ storage });
};
