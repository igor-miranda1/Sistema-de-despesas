import dns from 'node:dns/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const domainCache = new Map<string, { expires: number; valid: boolean }>();
const cacheTtl = 60 * 60 * 1000;
const maxCache = 1000;
let disposableDomains: Set<string> | undefined;

async function loadDisposableDomains(): Promise<Set<string>> {
  if (!disposableDomains) {
    try {
      const content = await readFile(resolve('server/src/data/dominios-descartaveis.txt'), 'utf8');
      disposableDomains = new Set(
        content.split(/\r?\n/).map((line) => line.trim().toLowerCase()).filter(Boolean),
      );
    } catch {
      disposableDomains = new Set();
    }
  }
  return disposableDomains;
}

export function emailNormalizado(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  const [local, domain] = at > 0 ? [email.slice(0, at), email.slice(at + 1)] : ['', ''];
  if (
    !email ||
    email.length > 254 ||
    local.length > 64 ||
    !/^[\x21-\x7e]+$/.test(email) ||
    /[\r\n]/.test(email) ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) ||
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ||
    /^\d+\.\d+\.\d+\.\d+$/.test(domain)
  ) return null;
  if (process.env.NODE_ENV === 'production' && /(^|\.)localhost$|(^|\.)local$|(^|\.)internal$/.test(domain)) {
    return null;
  }
  return email;
}

export async function validarEmail(value: unknown): Promise<{ email: string; transitório: boolean } | null> {
  const email = emailNormalizado(value);
  if (!email) return null;
  const domain = email.slice(email.lastIndexOf('@') + 1);
  if ((await loadDisposableDomains()).has(domain)) return null;
  if (process.env.EMAIL_ALLOW_TEST_DOMAINS === 'true' && domain.endsWith('.test')) {
    return { email, transitório: false };
  }

  const cached = domainCache.get(domain);
  if (cached && cached.expires > Date.now()) {
    return cached.valid ? { email, transitório: false } : null;
  }
  let valid = false;
  let transitório = false;
  try {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(Object.assign(new Error('DNS timeout'), { code: 'ETIMEOUT' })), 3000);
    });
    const [mx, a] = await Promise.allSettled([
      Promise.race([dns.resolveMx(domain), timeout]),
      Promise.race([dns.resolveAny(domain), timeout]),
    ]);
    valid = (mx.status === 'fulfilled' && mx.value.length > 0)
      || (a.status === 'fulfilled' && a.value.some((record) => record.type === 'A' || record.type === 'AAAA'));
    if (!valid && (mx.status === 'rejected' || a.status === 'rejected')) {
      const codes = [mx, a].filter((result) => result.status === 'rejected').map((result) => result.reason?.code);
      transitório = codes.some((code) => ['ETIMEOUT', 'ESERVFAIL', 'EAI_AGAIN'].includes(code));
      if (transitório) return { email, transitório: true };
    }
  } catch {
    transitório = true;
  }
  if (domainCache.size >= maxCache) domainCache.delete(domainCache.keys().next().value as string);
  domainCache.set(domain, { expires: Date.now() + cacheTtl, valid });
  return valid || transitório ? { email, transitório } : null;
}

export function emailHash(email: string): string {
  return createHash('sha256').update(email).digest('hex').slice(0, 12);
}
