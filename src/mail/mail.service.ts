import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

/**
 * Envio de e-mail via Resend. Usa o provedor quando RESEND_API_KEY está
 * definido; caso contrário, apenas registra o conteúdo no log (modo
 * desenvolvimento).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;

  constructor() {
    this.resend = process.env.RESEND_API_KEY
      ? new Resend(process.env.RESEND_API_KEY)
      : null;
  }

  async send(to: string, subject: string, html: string, text?: string): Promise<void> {
    const from = process.env.RESEND_FROM ?? 'TransportaBR <no-reply@transportabr.com.br>';
    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY não configurado — e-mail apenas registrado:\n  Para: ${to}\n  Assunto: ${subject}\n  ${text ?? html}`,
      );
      return;
    }
    const { data, error } = await this.resend.emails.send({
      from,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });
    if (error) {
      // Não propaga: uma falha de envio não deve quebrar o fluxo (ex.: forgot-password).
      this.logger.error(`Falha ao enviar e-mail para ${to}: ${error.message}`);
      return;
    }
    this.logger.log(`E-mail enviado para ${to} (id: ${data?.id}): ${subject}`);
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
