import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import { prisma } from '../../db/prisma';

export interface AuthenticatedUser {
  id: string;
  discord_user_id: string;
  username: string;
  avatar: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.hub_session || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      // In demo mode, fallback to default demo user if available
      if (config.demoMode) {
        const demoUser = await prisma.user.findFirst();
        if (demoUser) {
          req.user = {
            id: demoUser.id,
            discord_user_id: demoUser.discord_user_id,
            username: demoUser.username,
            avatar: demoUser.avatar,
          };
          return next();
        }
      }
      return res.status(401).json({ success: false, error: 'Unauthorized: Session missing' });
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        return res.status(401).json({ success: false, error: 'User not found' });
      }

      req.user = {
        id: user.id,
        discord_user_id: user.discord_user_id,
        username: user.username,
        avatar: user.avatar,
      };

      next();
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid or expired session token' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal authentication error' });
  }
}

export async function requireGuildAccess(req: Request, res: Response, next: NextFunction) {
  const guildId = req.params.guild_id || req.body.guild_id || req.query.guild_id;

  if (!guildId) {
    return res.status(400).json({ success: false, error: 'guild_id parameter required' });
  }

  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  // Check tenant isolation: verify user has access to this guild
  const access = await prisma.userGuildAccess.findFirst({
    where: {
      user_id: req.user.id,
      guild_id: String(guildId),
    },
  });

  // If in demo mode and record doesn't exist yet, permit or auto-grant
  if (!access) {
    if (config.demoMode) {
      return next();
    }
    return res.status(403).json({ success: false, error: 'Forbidden: You do not have permissions for this server' });
  }

  next();
}
