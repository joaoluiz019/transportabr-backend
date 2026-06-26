import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Envio de e-mail. Usa SMTP quando SMTP_HOST está definido; caso contrário,
 * apenas registra o conteúdo no log (modo desenvolvimento). A escolha do
 * provedor transacional definitivo é tratada na Fase 5.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;

  constructor() {
    if (process.env.SMTP_HOST) {
      const port = Number(process.env.SMTP_PORT ?? 587);
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    } else {
      this.transporter = null;
    }
  }

  async send(to: string, subject: string, html: string, text?: string): Promise<void> {
    const from = process.env.SMTP_FROM ?? 'TransportaBR <no-reply@transportabr.com>';
    if (!this.transporter) {
      this.logger.warn(
        `SMTP não configurado — e-mail apenas registrado:\n  Para: ${to}\n  Assunto: ${subject}\n  ${text ?? html}`,
      );
      return;
    }
    try {
      await this.transporter.sendMail({ from, to, subject, html, text });
      this.logger.log(`E-mail enviado para ${to}: ${subject}`);
    } catch (e: any) {
      // Não propaga: uma falha de SMTP não deve quebrar o fluxo (ex.: forgot-password).
      this.logger.error(`Falha ao enviar e-mail para ${to}: ${e?.message ?? e}`);
    }
  }

  async sendPasswordReset(
    to: string,
    name: string | null,
    resetUrl: string,
    migrated: boolean,
  ): Promise<void> {
    const greeting = name ? `Olá, ${name}` : 'Olá';
    const intro = migrated
      ? 'A plataforma TransportaBR foi atualizada e, por segurança, agora utiliza senha própria. Defina sua senha para continuar acessando sua conta.'
      : 'Recebemos um pedido para redefinir a sua senha.';
    const subject = migrated
      ? 'TransportaBR atualizado — defina sua senha'
      : 'TransportaBR — redefinição de senha';
    const html =
      `<p>${greeting},</p><p>${intro}</p>` +
      `<p><a href="${resetUrl}">Definir minha senha</a></p>` +
      `<p>Se você não solicitou, ignore este e-mail. O link expira em 1 hora.</p>`;
    const text = `${greeting},\n\n${intro}\n\nDefina sua senha: ${resetUrl}\n\n(O link expira em 1 hora.)`;
    await this.send(to, subject, html, text);
  }
}
