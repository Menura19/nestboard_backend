import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/errors.js";
import { requireRole, verifyJwt } from "../middleware/auth.js";
import { Role } from "../generated/enums.js";
import type { Prisma } from "../generated/client.js";

export const adminRouter = Router();

adminRouter.use(verifyJwt, requireRole(Role.ADMIN));

function withoutUndefined(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

const idParams = z.object({ id: z.uuid() });
const imageUrl = z.union([
  z.url(),
  z.string().startsWith("/uploads/"),
]);

const propertyFields = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  address: z.string().trim().min(3).max(240),
  city: z.string().trim().min(2).max(120),
  type: z.enum(["HOUSE", "VILLA", "APARTMENT", "HOTEL"]),
  amenities: z.array(z.string().trim().min(1).max(80)).max(30),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  imageUrl,
  minStay: z.string().trim().min(1).max(80),
  isActive: z.boolean(),
});

const createPropertySchema = propertyFields.strict();
const updatePropertySchema = propertyFields.partial().strict().refine(
  (body) => Object.keys(body).length > 0,
  "At least one property field is required",
);

const roomTypeFields = z.object({
  name: z.string().trim().min(2).max(80),
  pricePerMonth: z.number().positive().max(100_000_000),
  seatCapacity: z.number().int().min(1).max(100),
  hasAC: z.boolean(),
  isAvailable: z.boolean(),
});

const createRoomTypeSchema = roomTypeFields.strict();
const updateRoomTypeSchema = roomTypeFields.partial().strict().refine(
  (body) => Object.keys(body).length > 0,
  "At least one room-type field is required",
);

const roomFields = z.object({
  roomLabel: z.string().trim().min(1).max(80),
  isAvailable: z.boolean(),
});

const createRoomSchema = roomFields.strict();
const updateRoomSchema = roomFields.partial().strict().refine(
  (body) => Object.keys(body).length > 0,
  "At least one room field is required",
);

async function ownedProperty(id: string, vendorId: string) {
  const property = await prisma.property.findFirst({
    where: { id, vendorId },
  });
  if (!property) throw Errors.notFound("Property");
  return property;
}

async function ownedRoomType(id: string, vendorId: string) {
  const roomType = await prisma.roomType.findFirst({
    where: { id, property: { vendorId } },
    include: { property: true },
  });
  if (!roomType) throw Errors.notFound("Room type");
  return roomType;
}

async function ownedRoom(id: string, vendorId: string) {
  const room = await prisma.room.findFirst({
    where: { id, roomType: { property: { vendorId } } },
    include: { roomType: { include: { property: true } } },
  });
  if (!room) throw Errors.notFound("Room");
  return room;
}

adminRouter.get("/summary", async (req, res, next) => {
  try {
    const vendorId = req.user!.id;
    const [properties, bookings] = await Promise.all([
      prisma.property.findMany({
        where: { vendorId },
        include: { roomTypes: { include: { rooms: true } } },
      }),
      prisma.booking.findMany({
        where: { room: { roomType: { property: { vendorId } } } },
        select: { bookingStatus: true, totalAmount: true },
      }),
    ]);

    const roomCount = properties.reduce(
      (sum, property) =>
        sum + property.roomTypes.reduce((inner, type) => inner + type.rooms.length, 0),
      0,
    );
    const totalSeats = properties.reduce(
      (sum, property) =>
        sum + property.roomTypes.reduce(
          (inner, type) => inner + type.seatCapacity * type.rooms.length,
          0,
        ),
      0,
    );
    const activeBookings = bookings.filter((booking) =>
      booking.bookingStatus === "CONFIRMED" || booking.bookingStatus === "PENDING"
    ).length;
    const revenue = bookings
      .filter((booking) => booking.bookingStatus === "CONFIRMED")
      .reduce((sum, booking) => sum + Number(booking.totalAmount), 0);

    res.json({
      properties: properties.length,
      rooms: roomCount,
      bookings: bookings.length,
      activeBookings,
      totalSeats,
      occupancyPercent: totalSeats ? Math.round((activeBookings / totalSeats) * 1000) / 10 : 0,
      confirmedRevenue: revenue,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/bookings", async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { room: { roomType: { property: { vendorId: req.user!.id } } } },
      orderBy: { createdAt: "desc" },
      include: {
        tenant: { select: { id: true, displayName: true, email: true } },
        room: {
          include: {
            roomType: { include: { property: { select: { id: true, title: true } } } },
          },
        },
      },
    });
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/properties", async (req, res, next) => {
  try {
    const properties = await prisma.property.findMany({
      where: { vendorId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: {
        roomTypes: {
          orderBy: { createdAt: "asc" },
          include: { rooms: { orderBy: { createdAt: "asc" } } },
        },
      },
    });
    res.json(properties);
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/properties", async (req, res, next) => {
  try {
    const input = createPropertySchema.parse(req.body);
    const property = await prisma.property.create({
      data: { ...input, vendorId: req.user!.id },
    });
    res.status(201).json(property);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/properties/:id", async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    await ownedProperty(id, req.user!.id);
    const input = updatePropertySchema.parse(req.body);
    res.json(await prisma.property.update({ where: { id }, data: withoutUndefined(input) as Prisma.PropertyUpdateInput }));
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/properties/:id", async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    await ownedProperty(id, req.user!.id);
    const booking = await prisma.booking.findFirst({
      where: { room: { roomType: { propertyId: id } } },
      select: { id: true },
    });
    if (booking) throw Errors.conflict("Cannot delete a property that has bookings");
    await prisma.property.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/properties/:id/room-types", async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    await ownedProperty(id, req.user!.id);
    const input = createRoomTypeSchema.parse(req.body);
    const roomType = await prisma.roomType.create({
      data: { ...input, propertyId: id },
    });
    res.status(201).json(roomType);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/room-types/:id", async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    await ownedRoomType(id, req.user!.id);
    const input = updateRoomTypeSchema.parse(req.body);
    res.json(await prisma.roomType.update({ where: { id }, data: withoutUndefined(input) as Prisma.RoomTypeUpdateInput }));
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/room-types/:id", async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    await ownedRoomType(id, req.user!.id);
    const booking = await prisma.booking.findFirst({
      where: { room: { roomTypeId: id } },
      select: { id: true },
    });
    if (booking) throw Errors.conflict("Cannot delete a room type that has bookings");
    await prisma.roomType.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/room-types/:id/rooms", async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    await ownedRoomType(id, req.user!.id);
    const input = createRoomSchema.parse(req.body);
    const room = await prisma.room.create({ data: { ...input, roomTypeId: id } });
    res.status(201).json(room);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/rooms/:id", async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    await ownedRoom(id, req.user!.id);
    const input = updateRoomSchema.parse(req.body);
    res.json(await prisma.room.update({ where: { id }, data: withoutUndefined(input) as Prisma.RoomUpdateInput }));
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/rooms/:id", async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    await ownedRoom(id, req.user!.id);
    const booking = await prisma.booking.findFirst({ where: { roomId: id }, select: { id: true } });
    if (booking) throw Errors.conflict("Cannot delete a room that has bookings");
    await prisma.room.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
