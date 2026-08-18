import argon2 from "argon2";
import { prisma } from "../src/lib/prisma.js";
import { Role, PropertyType } from "../src/generated/enums.js";

async function main() {
  const passwordHash = await argon2.hash("password123");

  const vendor = await prisma.user.upsert({
    where: { email: "vendor@nestboard.dev" },
    create: {
      email: "vendor@nestboard.dev",
      displayName: "Aisha Perera",
      role: Role.ADMIN,
      bioTag: "Property Manager",
      passwordHash,
    },
    update: {},
  });

  const vendorB = await prisma.user.upsert({
    where: { email: "vendorb@nestboard.dev" },
    create: {
      email: "vendorb@nestboard.dev",
      displayName: "Bandara Perera",
      role: Role.ADMIN,
      bioTag: "Property Manager",
      passwordHash,
    },
    update: {},
  });

  const tenants = [
    {
      email: "tenant1@nestboard.dev",
      displayName: "Kavindu Silva",
    },
    {
      email: "tenant2@nestboard.dev",
      displayName: "Nethmi Fernando",
    },
    {
      email: "tenant3@nestboard.dev",
      displayName: "Tharindu Bandara",
    },
  ];

  for (const tenant of tenants) {
    await prisma.user.upsert({
      where: { email: tenant.email },
      create: {
        ...tenant,
        role: Role.USER,
        passwordHash,
      },
      update: {},
    });
  }

  const properties = [
    {
      vendorId: vendor.id,
      title: "Sunset Apartment",
      description:
        "A modern co-living apartment in the heart of Ethul Kotte.",
      address: "45 Temple Road, Ethul Kotte",
      city: "Ethul Kotte",
      type: PropertyType.APARTMENT,
      rating: 4.8,
      amenities: ["AC", "WiFi", "Parking", "Kitchen"],
      latitude: 6.8956,
      longitude: 79.9092,
      imageUrl:
        "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&h=700&fit=crop",
      minStay: "2 months",
      basePrice: 18000,
    },
    {
      vendorId: vendor.id,
      title: "Colombo City House",
      description:
        "A comfortable shared house close to Colombo city attractions.",
      address: "18 Flower Road, Colombo 07",
      city: "Colombo",
      type: PropertyType.HOUSE,
      rating: 4.6,
      amenities: ["WiFi", "Kitchen", "Laundry", "Security"],
      latitude: 6.9108,
      longitude: 79.8636,
      imageUrl:
        "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&h=700&fit=crop",
      minStay: "1 month",
      basePrice: 24000,
    },
    {
      vendorId: vendorB.id,
      title: "Palm Grove Villa",
      description:
        "A peaceful co-living villa with a garden and spacious common areas.",
      address: "21 Lake Drive, Rajagiriya",
      city: "Rajagiriya",
      type: PropertyType.VILLA,
      rating: 4.9,
      amenities: ["AC", "WiFi", "Garden", "Parking", "Kitchen"],
      latitude: 6.9094,
      longitude: 79.8943,
      imageUrl:
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&h=700&fit=crop",
      minStay: "3 months",
      basePrice: 32000,
    },
    {
      vendorId: vendor.id,
      title: "Kandy Hills Residence",
      description:
        "A scenic residence offering quiet rooms near central Kandy.",
      address: "73 Hill Street, Kandy",
      city: "Kandy",
      type: PropertyType.HOUSE,
      rating: 4.5,
      amenities: ["WiFi", "Mountain View", "Kitchen", "Laundry"],
      latitude: 7.2906,
      longitude: 80.6337,
      imageUrl:
        "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=1200&h=700&fit=crop",
      minStay: "1 month",
      basePrice: 16000,
    },
    {
      vendorId: vendorB.id,
      title: "Galle Fort Living",
      description:
        "A stylish shared apartment located close to historic Galle Fort.",
      address: "12 Lighthouse Street, Galle",
      city: "Galle",
      type: PropertyType.APARTMENT,
      rating: 4.7,
      amenities: ["AC", "WiFi", "Kitchen", "Sea View"],
      latitude: 6.026,
      longitude: 80.217,
      imageUrl:
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&h=700&fit=crop",
      minStay: "2 months",
      basePrice: 28000,
    },
    {
      vendorId: vendor.id,
      title: "Negombo Beach Villa",
      description:
        "A relaxing co-living villa within walking distance of the beach.",
      address: "36 Beach Road, Negombo",
      city: "Negombo",
      type: PropertyType.VILLA,
      rating: 4.4,
      amenities: ["AC", "WiFi", "Garden", "Beach Access"],
      latitude: 7.2094,
      longitude: 79.8358,
      imageUrl:
        "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&h=700&fit=crop",
      minStay: "1 month",
      basePrice: 30000,
    },
    {
      vendorId: vendorB.id,
      title: "Mount Lavinia Suites",
      description:
        "Modern shared suites with quick access to Mount Lavinia beach.",
      address: "90 Hotel Road, Mount Lavinia",
      city: "Mount Lavinia",
      type: PropertyType.HOTEL,
      rating: 4.3,
      amenities: ["AC", "WiFi", "Security", "Housekeeping"],
      latitude: 6.839,
      longitude: 79.8653,
      imageUrl:
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&h=700&fit=crop",
      minStay: "2 weeks",
      basePrice: 35000,
    },
    {
      vendorId: vendor.id,
      title: "Nugegoda Student House",
      description:
        "An affordable shared house suitable for students and young workers.",
      address: "55 High Level Road, Nugegoda",
      city: "Nugegoda",
      type: PropertyType.HOUSE,
      rating: 4.2,
      amenities: ["WiFi", "Study Area", "Kitchen", "Laundry"],
      latitude: 6.8649,
      longitude: 79.8997,
      imageUrl:
        "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&h=700&fit=crop",
      minStay: "3 months",
      basePrice: 14000,
    },
    {
      vendorId: vendorB.id,
      title: "Dehiwala Urban Apartments",
      description:
        "Convenient apartment living with access to transport and shopping.",
      address: "28 Station Road, Dehiwala",
      city: "Dehiwala",
      type: PropertyType.APARTMENT,
      rating: 4.1,
      amenities: ["AC", "WiFi", "Parking", "Elevator"],
      latitude: 6.851,
      longitude: 79.865,
      imageUrl:
        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&h=700&fit=crop",
      minStay: "2 months",
      basePrice: 22000,
    },
    {
      vendorId: vendor.id,
      title: "Moratuwa Campus Living",
      description:
        "Budget-friendly co-living accommodation near Moratuwa University.",
      address: "11 Bandaranayake Mawatha, Moratuwa",
      city: "Moratuwa",
      type: PropertyType.HOUSE,
      rating: 4.0,
      amenities: ["WiFi", "Study Area", "Kitchen", "Parking"],
      latitude: 6.7969,
      longitude: 79.9018,
      imageUrl:
        "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200&h=700&fit=crop",
      minStay: "3 months",
      basePrice: 12000,
    },
    {
      vendorId: vendorB.id,
      title: "Battaramulla Lake Villa",
      description:
        "A premium shared villa overlooking the peaceful Diyawanna Lake.",
      address: "42 Lake View Gardens, Battaramulla",
      city: "Battaramulla",
      type: PropertyType.VILLA,
      rating: 4.8,
      amenities: ["AC", "WiFi", "Garden", "Lake View", "Parking"],
      latitude: 6.9022,
      longitude: 79.9197,
      imageUrl:
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&h=700&fit=crop",
      minStay: "3 months",
      basePrice: 40000,
    },
    {
      vendorId: vendor.id,
      title: "Colombo Central Hotel",
      description:
        "Flexible long-stay hotel rooms for professionals in central Colombo.",
      address: "105 Union Place, Colombo 02",
      city: "Colombo",
      type: PropertyType.HOTEL,
      rating: 4.6,
      amenities: ["AC", "WiFi", "Gym", "Security", "Housekeeping"],
      latitude: 6.9188,
      longitude: 79.8562,
      imageUrl:
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&h=700&fit=crop",
      minStay: "2 weeks",
      basePrice: 45000,
    },
    {
      vendorId: vendorB.id,
      title: "Kelaniya Riverside Apartments",
      description:
        "Well-connected riverside apartments for students and professionals.",
      address: "64 Kandy Road, Kelaniya",
      city: "Kelaniya",
      type: PropertyType.APARTMENT,
      rating: 4.3,
      amenities: ["WiFi", "Parking", "Kitchen", "River View"],
      latitude: 6.9553,
      longitude: 79.922,
      imageUrl:
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&h=700&fit=crop",
      minStay: "2 months",
      basePrice: 20000,
    },
  ];

  for (const seed of properties) {
    const existingProperty = await prisma.property.findFirst({
      where: {
        vendorId: seed.vendorId,
        title: seed.title,
      },
    });

    const property =
      existingProperty ??
      (await prisma.property.create({
        data: {
          vendorId: seed.vendorId,
          title: seed.title,
          description: seed.description,
          address: seed.address,
          city: seed.city,
          type: seed.type,
          rating: seed.rating,
          amenities: seed.amenities,
          latitude: seed.latitude,
          longitude: seed.longitude,
          imageUrl: seed.imageUrl,
          minStay: seed.minStay,
        },
      }));

    const roomTypes = [
      {
        name: "Shared Room",
        pricePerMonth: seed.basePrice,
        seatCapacity: 3,
        hasAC: false,
      },
      {
        name: "Premium Room",
        pricePerMonth: seed.basePrice + 8000,
        seatCapacity: 2,
        hasAC: true,
      },
    ];

    for (const roomTypeSeed of roomTypes) {
      let roomType = await prisma.roomType.findFirst({
        where: {
          propertyId: property.id,
          name: roomTypeSeed.name,
        },
      });

      if (!roomType) {
        roomType = await prisma.roomType.create({
          data: {
            propertyId: property.id,
            ...roomTypeSeed,
          },
        });
      }

      for (const roomNumber of [101, 102]) {
        const roomLabel = `${roomTypeSeed.name} - Room ${roomNumber}`;

        const existingRoom = await prisma.room.findFirst({
          where: {
            roomTypeId: roomType.id,
            roomLabel,
          },
        });

        if (!existingRoom) {
          await prisma.room.create({
            data: {
              roomTypeId: roomType.id,
              roomLabel,
            },
          });
        }
      }
    }
  }

  console.log(`Seed complete. ${properties.length} demo properties are ready.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });