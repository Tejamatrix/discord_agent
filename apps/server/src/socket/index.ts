import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { WS_EVENTS } from '@hub/shared';
import { liveVoiceManager } from '../audio/liveVoiceManager';
import { tenantAccountManager } from '../account/userAccount';

export class SocketService {
  private io: SocketIOServer | null = null;

  public initialize(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      maxHttpBufferSize: 1e7, // 10MB buffer for live audio chunks
    });

    this.io.on('connection', (socket) => {
      let currentTenantId: string | null = null;

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
          currentTenantId = tenantId;
          socket.join(`tenant:${tenantId}`);
        }
      });

      socket.on('leave_tenant', (tenantId: string) => {
        if (tenantId) {
          socket.leave(`tenant:${tenantId}`);
        }
      });

      // --- LIVE MICROPHONE "SPEAK OUT" REALTIME STREAMING ---
      socket.on('voice:speak_start', async (data: any, callback?: (res: any) => void) => {
        const tenantId = data?.tenantId || currentTenantId || 'default';
        const gain = Number(data?.gain) || 3.0;
        const broadcastAll = data?.broadcastAll !== false;
        const slotIndex = typeof data?.slotIndex === 'number' ? data.slotIndex : undefined;

        try {
          const session = tenantAccountManager.getSession(tenantId);
          await liveVoiceManager.startLiveStream(session, tenantId, {
            gainMultiplier: gain,
            broadcastAll,
            slotIndex,
          });
          if (typeof callback === 'function') {
            callback({ success: true, message: 'Live stream active' });
          }
        } catch (err: any) {
          if (typeof callback === 'function') {
            callback({ success: false, error: err.message });
          }
        }
      });

      socket.on('voice:speak_chunk', (data: any) => {
        const tenantId = data?.tenantId || currentTenantId || 'default';
        const chunk = data?.chunk !== undefined ? data.chunk : data;
        if (chunk) {
          liveVoiceManager.writeChunk(tenantId, chunk);
        }
      });

      socket.on('voice:speak_stop', (data: any, callback?: (res: any) => void) => {
        const tenantId = data?.tenantId || currentTenantId || 'default';
        liveVoiceManager.stopLiveStream(tenantId);
        if (typeof callback === 'function') {
          callback({ success: true });
        }
      });

      socket.on('disconnect', () => {
        if (currentTenantId) {
          liveVoiceManager.stopLiveStream(currentTenantId);
        }
      });
    });

    console.log('⚡ Socket.io real-time server & Live Voice gateway initialized');
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
