import type { RequestHandler } from "express";
import * as svc from "../services/booking-service.js";
import { prisma } from "../lib/prisma.js";

async function createConfirmationNotification(userId: string) {
  await prisma.notification.create({
    data: {
      userId,
      title: "Booking confirmed",
      message: "Your NestBoard booking has been confirmed successfully.",
      type: "BOOKING_CONFIRMED",
    },
  });
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    const booking = await svc.createBookingPending(req.user!.id, req.body);
    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
};

// create and confirm in one request
export const createConfirmed: RequestHandler = async (req, res, next) => {
  try {
    const booking = await svc.createBookingConfirmed(req.user!.id, req.body);
    await createConfirmationNotification(req.user!.id);
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

export const confirm: RequestHandler = async (req, res, next) => {
  try {
    const booking = await svc.confirmBooking(
      String(req.params.id!),
      req.user!.id,
    );
    await createConfirmationNotification(req.user!.id);
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

export const myBookings: RequestHandler = async (req, res, next) => {
  try {
    res.json(await svc.listMyBookings(req.user!.id));
  } catch (err) {
    next(err);
  }
};
