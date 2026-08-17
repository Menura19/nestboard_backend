import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { verifyJwt } from "../middleware/auth.js";
import { validateParams } from "../middleware/validate.js";

export const notificationsRouter = Router();
notificationsRouter.use(verifyJwt);

const idParam = z.object({ id: z.uuid() });

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const [data, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.notification.count({
        where: { userId: req.user!.id, isRead: false },
      }),
    ]);
    res.json({ data, unreadCount });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch("/read-all", async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ updated: result.count });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch(
  "/:id/read",
  validateParams(idParam),
  async (req, res, next) => {
    try {
      const result = await prisma.notification.updateMany({
        where: { id: String(req.params.id), userId: req.user!.id },
        data: { isRead: true },
      });
      if (result.count === 0) {
        res.status(404).json({ message: "Notification not found" });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);
