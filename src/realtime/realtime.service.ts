import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * Emite eventos de mudança de entidade para a sala da empresa (multi-tenant).
 * O Server é injetado pelo gateway em afterInit().
 */
@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitChange(companyId: string | null, entity: string, action: 'created' | 'updated' | 'deleted') {
    if (!this.server || !companyId) return;
    this.server.to(`company:${companyId}`).emit('entity:changed', { entity, action });
  }
}
