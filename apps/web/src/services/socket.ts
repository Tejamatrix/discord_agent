import { io, Socket } from 'socket.io-client';
import { WS_EVENTS } from '@hub/shared';

class WebSocketService {
  private socket: Socket | null = null;

  public connect(): Socket {
    if (!this.socket) {
      const serverUrl = ((import.meta as any).env?.VITE_API_URL || '/').replace(/\/api\/v1\/?$/, '');
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        console.log('⚡ Connected to Control Hub WebSocket server');
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 Disconnected from Control Hub WebSocket');
      });
    }

    return this.socket;
  }

  public joinGuild(guildId: string) {
    if (this.socket) {
      this.socket.emit('join_guild', guildId);
    }
  }

  public leaveGuild(guildId: string) {
    if (this.socket) {
      this.socket.emit('leave_guild', guildId);
    }
  }

  public joinTenant(tenantId: string) {
    if (this.socket && tenantId) {
      this.socket.emit('join_tenant', tenantId);
    }
  }

  public leaveTenant(tenantId: string) {
    if (this.socket && tenantId) {
      this.socket.emit('leave_tenant', tenantId);
    }
  }

  public on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  public off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const wsService = new WebSocketService();
export { WS_EVENTS };
