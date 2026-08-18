import { Router } from "express";
import { BookingStatus, Role } from "../generated/enums.js";
import { Prisma } from "../generated/client.js";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/errors.js";
import { optionalAuth, requireRole, verifyJwt } from "../middleware/auth.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import {
  createReviewSchema,
  propertyIdParamsSchema,
} from "../schemas/review.js";

export const reviewsRouter = Router();

function reviewDTO(review: {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    user: review.user,
  };
}

reviewsRouter.get(
  "/property/:propertyId",
  optionalAuth,
  validateParams(propertyIdParamsSchema),
  async (req, res, next) => {
    try {
      const propertyId = String(req.params.propertyId);
      const property = await prisma.property.findFirst({
        where: { id: propertyId, isActive: true },
        select: { id: true, rating: true },
      });

      if (!property) {
        throw Errors.notFound("Property");
      }

      const [reviews, aggregate] = await Promise.all([
        prisma.review.findMany({
          where: { propertyId },
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        }),
        prisma.review.aggregate({
          where: { propertyId },
          _avg: { rating: true },
          _count: { _all: true },
        }),
      ]);

      let ownReview = null;
      let canReview = false;
      let eligibilityReason: string | null = req.user
        ? null
        : "Sign in to leave a review";

      if (req.user?.role === Role.USER) {
        ownReview =
          reviews.find((review) => review.userId === req.user?.id) ?? null;

        if (ownReview) {
          eligibilityReason = "You have already reviewed this property";
        } else {
          const qualifyingBooking = await prisma.booking.findFirst({
            where: {
              tenantId: req.user.id,
              bookingStatus: BookingStatus.CONFIRMED,
              leaseStart: { lte: new Date() },
              room: {
                roomType: {
                  propertyId,
                },
              },
            },
            select: { id: true },
          });

          canReview = Boolean(qualifyingBooking);
          eligibilityReason = canReview
            ? null
            : "A confirmed booking that has started is required";
        }
      } else if (req.user) {
        eligibilityReason = "Only tenants can review properties";
      }

      res.json({
        reviews: reviews.map(reviewDTO),
        averageRating:
          aggregate._avg.rating === null
            ? Number(property.rating.toString())
            : aggregate._avg.rating,
        reviewCount: aggregate._count._all,
        canReview,
        eligibilityReason,
        ownReview: ownReview ? reviewDTO(ownReview) : null,
      });
    } catch (error) {
      next(error);
    }
  },
);

reviewsRouter.post(
  "/",
  verifyJwt,
  requireRole(Role.USER),
  validateBody(createReviewSchema),
  async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw Errors.unauthenticated();
      }

      const { propertyId, rating, comment } = req.body;

      const property = await prisma.property.findFirst({
        where: { id: propertyId, isActive: true },
        select: { id: true },
      });

      if (!property) {
        throw Errors.notFound("Property");
      }

      const existing = await prisma.review.findUnique({
        where: {
          userId_propertyId: {
            userId,
            propertyId,
          },
        },
        select: { id: true },
      });

      if (existing) {
        throw Errors.conflict("You have already reviewed this property");
      }

      const booking = await prisma.booking.findFirst({
        where: {
          tenantId: userId,
          bookingStatus: BookingStatus.CONFIRMED,
          leaseStart: { lte: new Date() },
          room: {
            roomType: {
              propertyId,
            },
          },
        },
        orderBy: { leaseStart: "desc" },
        select: { id: true },
      });

      if (!booking) {
        throw Errors.forbidden(
          "A confirmed booking that has started is required to review this property",
        );
      }

      const created = await prisma.$transaction(async (tx) => {
        const review = await tx.review.create({
          data: {
            userId,
            propertyId,
            bookingId: booking.id,
            rating,
            comment: comment?.trim() || null,
          },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        });

        const aggregate = await tx.review.aggregate({
          where: { propertyId },
          _avg: { rating: true },
        });

        await tx.property.update({
          where: { id: propertyId },
          data: {
            rating: aggregate._avg.rating ?? rating,
          },
        });

        return review;
      });

      res.status(201).json(reviewDTO(created));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        next(Errors.conflict("You have already reviewed this property"));
        return;
      }

      next(error);
    }
  },
);
