import { z } from "zod";

export const propertyIdParamsSchema = z
  .object({
    propertyId: z.uuid(),
  })
  .strict();

export const createReviewSchema = z
  .object({
    propertyId: z.uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional(),
  })
  .strict();

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
