import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import { MailService } from './mail.service';

class SendEmailDto {
  @IsEmail()
  to: string;

  @IsString()
  subject: string;

  @IsString()
  body: string;
}

@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  // Substitui base44.integrations.Core.SendEmail (ex.: convite de motorista). Requer autenticação.
  @Post('send')
  async send(@Body() dto: SendEmailDto) {
    await this.mail.send(dto.to, dto.subject, dto.body, dto.body);
    return { ok: true };
  }
}
