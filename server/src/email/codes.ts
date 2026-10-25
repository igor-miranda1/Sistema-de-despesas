import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const secret = process.env.RESET_CODE_SECRET;
if (!secret || secret.length < 32 || secret.startsWith('replace-')) {
  throw new Error('RESET_CODE_SECRET deve ter pelo menos 32 caracteres.');
}
const codeSecret: string = secret;

export function novoCodigo(): string {
  return String(randomInt(100000, 1000000));
}

export function codigoHmac(finalidade: string, usuarioId: string, codigo: string): string {
  return createHmac('sha256', codeSecret)
    .update(`${finalidade}:${usuarioId}:${codigo}`)
    .digest('hex');
}

export function compararCodigo(expected: string, actual: string): boolean {
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(actual, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
