import { Router } from "express";
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from "../lib/tokens.js";
import { prisma } from "../lib/prisma.js";
import type { User } from "../generated/client.js";
import { validateBody } from "../middleware/validate.js";
import {
  googleAuthSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "../schemas/auth.js";
import { Errors } from "../lib/errors.js";
import argon2 from "argon2";
import { requireRole, verifyJwt } from "../middleware/auth.js";
import { OAuth2Client } from "google-auth-library";
import { env } from "../lib/env.js";

export const authRouter = Router();

async function issueTokens(user: Pick<User, "id" | "role" | "email">) {
  const accessToken = await signAccessToken({
    sub: user.id,
    role: user.role,
    email: user.email,
  });
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });
  return { accessToken, refreshToken };
}

authRouter.post(
  "/register",
  validateBody(registerSchema),
  async (req, res, next) => {
    try {
      const { email, password, displayName } = req.body;
      if (await prisma.user.findUnique({ where: { email } }))
        throw Errors.conflict("Email already registered");
      const user = await prisma.user.create({
        data: {
          email,
          displayName: displayName ?? email.split["@"][0],
          passwordHash: await argon2.hash(password),
        },
      });
      res.status(201).json(await issueTokens(user));
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (
      !user?.passwordHash ||
      !(await argon2.verify(user.passwordHash, password))
    ) {
      throw Errors.unauthenticated("Invalid credentials");
    }
    res.json(await issueTokens(user));
  } catch (err) {
    next(err);
  }
});


// exchanges a Google ID token for our own token pair
const googleOAuthClient = new OAuth2Client();

authRouter.post(
  "/google",
  validateBody(googleAuthSchema),
  async (req, res, next) => {
    try {
      if (!env.GOOGLE_CLIENT_IDS) {
        throw Errors.unavailable("Google sign-in is not configured");
      }
      const audience = env.GOOGLE_CLIENT_IDS.split(",").map((id) => id.trim());

      let payload;
      try {
        const ticket = await googleOAuthClient.verifyIdToken({
          idToken: req.body.idToken,
          audience,
        });
        payload = ticket.getPayload();
      } catch {
        throw Errors.unauthenticated("Invalid or expired Google token");
      }
      if (!payload?.email || payload.email_verified !== true) {
        throw Errors.unauthenticated("Google account has no verified email");
      }

      let user = await prisma.user.findUnique({
        where: { email: payload.email },
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: payload.email,
            displayName: payload.name ?? payload.email.split("@")[0]!,
            avatarUrl: payload.picture ?? null,
            // no passwordHash: this account authenticates via Google only
          },
        });
      }
      res.json(await issueTokens(user));
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = (req.body as { refreshToken?: string }).refreshToken;
    if (!refreshToken) throw Errors.unauthenticated("Missing refresh token");

    const stored = await prisma.refreshToken.findFirst({
      where: {
        tokenHash: hashToken(refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!stored) throw Errors.unauthenticated("Invalid refresh token");

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) throw Errors.unauthenticated("Invalid refresh token");

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }); // basic rotation
    res.json(await issueTokens(user)); // fresh access token re-reads role from `user`
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", verifyJwt, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        avatarUrl: true,
        bioTag: true,
      },
    });
    if (!user) throw Errors.notFound("User");
    res.json(user);
  } catch (err) {
    next(err);
  }
});


authRouter.patch(
  "/me",
  verifyJwt,
  validateBody(updateProfileSchema),
  async (req, res, next) => {
    try {
      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          ...(req.body.displayName !== undefined
            ? { displayName: req.body.displayName.trim() }
            : {}),
          ...(req.body.avatarUrl !== undefined
            ? { avatarUrl: req.body.avatarUrl }
            : {}),
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          avatarUrl: true,
          bioTag: true,
        },
      });
      res.json(user);
    } catch (err) {
      next(err);
    }
  },
);
