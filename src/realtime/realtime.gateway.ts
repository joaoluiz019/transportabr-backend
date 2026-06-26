import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { TenantService } from '../auth/tenant.service';
import { RealtimeService } from './realtime.service';

/**
 * Gateway Socket.io. O cliente conecta com o JWT (handshake.auth.token); o
 * gateway valida, resolve a empresa e entra na sala `company:<id>`, recebendo
 * apenas eventos do próprio tenant.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  constructor(
    private readonly jwt: JwtService,
    private readonly tenant: TenantService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.setServer(server);
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        (client.handshake.query?.token as string | undefined);
      if (!token) return client.disconnect();
      const payload: any = await this.jwt.verifyAsync(token);
      const ctx = await this.tenant.resolve(payload.email);
      if (!ctx.companyId) return client.disconnect();
      client.join(`company:${ctx.companyId}`);
    } catch {
      client.disconnect();
    }
  }
}
