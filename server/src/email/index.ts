import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';

export interface EmailMessage {
  para: string;
  assunto: string;
  texto: string;
  tipo: string;
}

interface EmailTransport {
  send(message: EmailMessage): Promise<{ messageId?: string }>;
}

const transportName = process.env.EMAIL_TRANSPORT || 'console';
const production = process.env.NODE_ENV === 'production';
const dailyCap = Number(process.env.EMAIL_DAILY_CAP || '200');
let sentToday = 0;
let sentDate = new Date().toISOString().slice(0, 10);

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith('replace-') || value.startsWith('configure-')) {
    throw new Error(`Variável de email ausente ou placeholder: ${name}`);
  }
  return value;
}

function recipientHash(email: string): string {
  return createHash('sha256').update(email).digest('hex').slice(0, 12);
}

function logEmail(tipo: string, para: string, status: string, messageId?: string): void {
  console.log(JSON.stringify({
    evento: 'email',
    tipo,
    destinatario_hash: recipientHash(para),
    status,
    ...(messageId ? { message_id: messageId } : {}),
  }));
}

class ConsoleTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<{ messageId: string }> {
    console.log(JSON.stringify({
      evento: 'email_console',
      tipo: message.tipo,
      destinatario_hash: recipientHash(message.para),
      assunto: message.assunto,
    }));
    return { messageId: `console-${Date.now()}` };
  }
}

class FileTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<{ messageId: string }> {
    const directory = resolve('server/.tmp/outbox');
    await mkdir(directory, { recursive: true });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    await writeFile(
      resolve(directory, id),
      JSON.stringify({ para: message.para, assunto: message.assunto, texto: message.texto, tipo: message.tipo }),
      'utf8',
    );
    return { messageId: id };
  }
}

class SmtpTransport implements EmailTransport {
  private readonly transporter: Transporter;

  constructor() {
    const port = Number(required('SMTP_PORT'));
    if (!Number.isInteger(port) || ![465, 587].includes(port)) {
      throw new Error('SMTP_PORT deve ser 465 ou 587.');
    }
    this.transporter = nodemailer.createTransport({
      host: required('SMTP_HOST'),
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: { user: required('SMTP_USER'), pass: required('SMTP_PASS') },
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  async send(message: EmailMessage): Promise<{ messageId?: string }> {
    const result = await this.transporter.sendMail({
      from: required('EMAIL_FROM'),
      to: message.para,
      subject: message.assunto,
      text: message.texto,
    });
    return { messageId: result.messageId };
  }
}

if (!Number.isInteger(dailyCap) || dailyCap < 1) {
  throw new Error('EMAIL_DAILY_CAP deve ser um inteiro positivo.');
}
if (production && transportName !== 'smtp') {
  throw new Error('Produção exige EMAIL_TRANSPORT=smtp.');
}

const transport: EmailTransport =
  transportName === 'smtp'
    ? new SmtpTransport()
    : transportName === 'file'
      ? production
        ? (() => { throw new Error('EMAIL_TRANSPORT=file não é permitido em produção.'); })()
        : new FileTransport()
      : transportName === 'console'
        ? production
          ? (() => { throw new Error('EMAIL_TRANSPORT=console não é permitido em produção.'); })()
          : new ConsoleTransport()
        : (() => { throw new Error('EMAIL_TRANSPORT inválido.'); })();

export function enviarEmail(message: EmailMessage): void {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== sentDate) {
    sentDate = today;
    sentToday = 0;
  }
  if (sentToday >= dailyCap) {
    logEmail(message.tipo, message.para, 'daily_cap');
    return;
  }
  sentToday += 1;

  void (async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await transport.send(message);
        logEmail(message.tipo, message.para, 'sent', result.messageId);
        return;
      } catch (error) {
        if (attempt === 1) {
          console.error(JSON.stringify({
            evento: 'email',
            tipo: message.tipo,
            destinatario_hash: recipientHash(message.para),
            status: 'failed',
            erro: error instanceof Error ? error.name : 'UnknownError',
          }));
        }
      }
    }
  })();
}
