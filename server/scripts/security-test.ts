const baseUrl = process.env.SECURITY_TEST_API_URL || 'http://127.0.0.1:3001/api';

async function check(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, init);
}

const unauthenticated = await check('/despesas?mes=2026-10');
if (unauthenticated.status !== 401) {
  throw new Error(`Esperado 401 sem cookie, recebido ${unauthenticated.status}`);
}

const invalidMonth = await check('/despesas?mes=2026-13');
if (invalidMonth.status !== 401) {
  throw new Error(`A rota protegida deve autenticar antes da validação; recebido ${invalidMonth.status}`);
}

const wrongContentType = await check('/auth/login', {
  method: 'POST',
  body: '{}',
});
if (wrongContentType.status !== 415) {
  throw new Error(`Esperado 415 para Content-Type ausente, recebido ${wrongContentType.status}`);
}

const externalOrigin = await check('/auth/logout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
  body: '{}',
});
if (externalOrigin.status !== 403) {
  throw new Error(`Esperado 403 para Origin externo, recebido ${externalOrigin.status}`);
}

console.log('Testes básicos de segurança passaram.');
