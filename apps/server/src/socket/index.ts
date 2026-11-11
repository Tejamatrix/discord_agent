import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { WS_EVENTS } from '@hub/shared';

export class SocketService {
  private io: SocketIOServer | null = null;

  public initialize(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.io.on('connection', (socket) => {
      // Allow joining guild-specific rooms
      socket.on('join_guild', (guildId: string) => {
        socket.join(`guild:${guildId}`);
      });

      socket.on('leave_guild', (guildId: string) => {
        socket.leave(`guild:${guildId}`);
      });

      // Allow joining tenant-isolated rooms
      socket.on('join_tenant', (tenantId: string) => {
        if (tenantId) {
          socket.join(`tenant:${tenantId}`);
        }
      });

      socket.on('leave_tenant', (tenantId: string) => {
        if (tenantId) {
          socket.leave(`tenant:${tenantId}`);
        }
      });
    });

    console.log('⚡ Socket.io real-time server initialized');
  }

  public broadcast(event: string, payload: any) {
    if (this.io) {
      this.io.emit(event, payload);
    }
  }

  public emit(event: string, payload: any) {
    this.broadcast(event, payload);
  }

  public emitToTenant(tenantId: string, event: string, payload: any) {
    if (this.io) {
      if (tenantId) {
        this.io.to(`tenant:${tenantId}`).emit(event, payload);
      } else {
        this.io.emit(event, payload);
      }
    }
  }

  public emitToGuild(guildId: string, event: string, payload: any) {
    if (this.io) {
      this.io.to(`guild:${guildId}`).emit(event, payload);
      // Also emit to all connected clients for dashboard overview
      this.io.emit(event, { ...payload, guildId });
    }
  }
}

export const socketService = new SocketService();
