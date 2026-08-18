import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { Role } from "../generated/enums.js";
import { verifyJwt, requireRole } from "../middleware/auth.js";
import { env } from "../lib/env.js";
import { Errors } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { uploadToR2 } from "../lib/storage.js";

export const uploadsRouter = Router();

const useR2 = env.UPLOAD_PROVIDER === "r2";

if (!useR2) {
  fs.mkdirSync(env.UPLOAD_LOCAL_DIR, { recursive: true });
}

const storage = useR2
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, env.UPLOAD_LOCAL_DIR),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${randomUUID()}${ext}`);
      },
    });

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const allowed = allowedTypes.includes(file.mimetype);

    cb(
      allowed
        ? null
        : (Errors.validation(
            "Only JPG/PNG/WEBP images are allowed",
          ) as any),
      allowed,
    );
  },
});

uploadsRouter.post(
  "/cover-image",
  verifyJwt,
  requireRole(Role.ADMIN),
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw Errors.validation("Missing image field");
      }

      let url: string;

      if (useR2) {
        const ext = path.extname(req.file.originalname).toLowerCase();
        const key = `cover-images/${randomUUID()}${ext}`;

        url = await uploadToR2(
          key,
          req.file.buffer,
          req.file.mimetype,
        );
      } else {
        url = `/uploads/${req.file.filename}`;
      }

      res.status(201).json({ url });
    } catch (err) {
      next(err);
    }
  },
);

uploadsRouter.post(
  "/profile-image",
  verifyJwt,
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw Errors.validation("Missing image field");
      }

      let avatarUrl: string;

      if (useR2) {
        const ext = path.extname(req.file.originalname).toLowerCase();
        const key = `profile-images/${req.user!.id}/${randomUUID()}${ext}`;

        avatarUrl = await uploadToR2(
          key,
          req.file.buffer,
          req.file.mimetype,
        );
      } else {
        avatarUrl = `/uploads/${req.file.filename}`;
      }

      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: { avatarUrl },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          avatarUrl: true,
          bioTag: true,
        },
      });

      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  },
);