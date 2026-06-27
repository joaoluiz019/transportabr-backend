import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators';

@Controller()
export class HealthController {
  // Liveness/health check público (ex.: para o Coolify/Traefik). Responde 200.
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'transportabr-api' };
  }
}
