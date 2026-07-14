import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { requireAdmin } from "../middleware/auth";
import { logError } from "../validation";

const router = Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../../public/uploads");
if (process.env.NODE_ENV !== "production") {
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (error) {
    logError("Could not create local upload directory", error);
  }
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Error: File upload only supports the following filetypes - " + filetypes));
  },
});

/**
 * POST /api/uploads
 * Admin-only - upload a single image
 */
router.post(
  "/",
  requireAdmin as any,
  (_req, res, next) => {
    if (process.env.NODE_ENV === "production") {
      res.status(503).json({ error: "Image uploads require persistent object storage." });
      return;
    }
    next();
  },
  upload.single("image"),
  (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: fileUrl });
  } catch (error) {
    logError("Upload error", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
  }
);

export default router;
