import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from './db.js';
import { validarEmail } from './email/validation.js';
import {
  type CategoriaRow,
  type DadosCadastro,
  type DadosDespesa,
  type DadosLogin,
  type DadosReceita,
  type Despesa,
  type DespesaRow,
  type Orcamento,
  type OrcamentoRow,
  type Receita,
  type ReceitaRow,
  type ResumoMensal,
  type ResumoMensalRow,
  type Usuario,
  type UsuarioRow,
} from './types.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
    }
  }
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields: string[] = [],
  ) {
    super(message);
  }
}

function requiredJwtSecret(): string {
  const value = process.env.JWT_SECRET;

  if (!value) {
    throw new Error('Variável de ambiente obrigatória ausente: JWT_SECRET');
  }
  if (value.length < 32 || value.includes('configure-uma-chave')) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres e não pode ser placeholder.');
  }

  return value;
}

const jwtSecret = requiredJwtSecret();
const secureCookies = process.env.NODE_ENV === 'production';
const sessionCookieName = secureCookies ? '__Host-session' : 'session';
const sessionDurationMs = 2 * 60 * 60 * 1000;
const fakePasswordHash = bcrypt.hashSync('invalid-login-password', 12);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const authEmailSchema = z.string().trim().toLowerCase().max(160).email();
const passwordSchema = z.string().refine(
  (value) => Buffer.byteLength(value, 'utf8') <= 72,
  'A senha deve ter no máximo 72 bytes.',
);
const registrationSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  email: authEmailSchema,
  senha: passwordSchema.min(8),
});

const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente mais tarde.' },
});
const loginSchema = z.object({ email: authEmailSchema, senha: z.string().min(1) });
const resetSchema = z.object({
  email: authEmailSchema,
  senha: passwordSchema.min(8),
});
const accountPasswordSchema = z.object({ senha: passwordSchema.min(1) });

function validateResetPassword(body: unknown): { email: string; senha: string } {
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, 'Revise os campos informados.', [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
    ]);
  }
  const email = parsed.data.email;
  const senha = parsed.data.senha;
  if (isPredictableNumericSequence(senha)) {
    throw new ApiError(400, 'Essa senha é uma sequência numérica previsível. Escolha uma senha mais forte; combinar letras, números e caracteres especiais é recomendado, mas opcional.', ['senha']);
  }
  return { email, senha };
}

function isPredictableNumericSequence(password: string): boolean {
  if (!/^\d{6,}$/.test(password)) {
    return false;
  }

  const differences = Array.from(password.slice(1), (digit, index) =>
    (Number(digit) - Number(password[index]) + 10) % 10,
  );
  return (
    differences.every((difference) => difference === 1) ||
    differences.every((difference) => difference === 9)
  );
}

function validateRegistration(body: unknown): DadosCadastro {
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, 'Revise os campos informados.', [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
    ]);
  }
  const fields: string[] = [];
  const record = isRecord(body) ? body : {};
  const nome = typeof record.nome === 'string' ? record.nome.trim() : '';
  const email =
    typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
  const senha = typeof record.senha === 'string' ? record.senha : '';

  if (!nome || nome.length > 80) {
    fields.push('nome');
  }
  if (
    !email ||
    email.length > 160 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    fields.push('email');
  }
  if (senha.length < 8 || Buffer.byteLength(senha, 'utf8') > 72) {
    fields.push('senha');
  }
  if (isPredictableNumericSequence(senha)) {
    throw new ApiError(
      400,
      'Essa senha é uma sequência numérica previsível. Escolha uma senha mais forte; combinar letras, números e caracteres especiais é recomendado, mas opcional.',
      ['senha'],
    );
  }

  if (fields.length > 0) {
    throw new ApiError(400, 'Revise os campos informados.', fields);
  }

  return { nome, email, senha };
}

function validateLogin(body: unknown): DadosLogin {
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, 'Revise os campos informados.', [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
    ]);
  }
  const fields: string[] = [];
  const record = isRecord(body) ? body : {};
  const email =
    typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
  const senha = typeof record.senha === 'string' ? record.senha : '';

  if (
    !email ||
    email.length > 160 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    fields.push('email');
  }

  if (!senha) {
    fields.push('senha');
  }

  if (fields.length > 0) {
    throw new ApiError(400, 'Revise os campos informados.', fields);
  }

  return { email, senha };
}

function toPublicUser(user: Usuario): Usuario {
  return { id: user.id, nome: user.nome, email: user.email };
}

async function createSession(
  userId: string,
  tokenVersion: number,
  request: Request,
): Promise<string> {
  const sessionId = randomUUID();
  await pool.execute(
    `INSERT INTO sessoes (id, usuario_id, endereco_ip, user_agent, expira_em)
     VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 2 HOUR))`,
    [
      sessionId,
      userId,
      (request.ip || '').slice(0, 45),
      (request.get('user-agent') || '').slice(0, 255),
    ],
  );
  return sessionId;
}

function setSessionCookie(response: Response, userId: string, tokenVersion: number, sessionId: string): void {
  const token = jwt.sign({ sub: userId, tv: tokenVersion, sid: sessionId }, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '2h',
  });
  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies,
    maxAge: sessionDurationMs,
    expires: new Date(Date.now() + sessionDurationMs),
    path: '/',
  });
}

function clearSessionCookie(response: Response): void {
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies,
    path: '/',
  });
}

function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const token: unknown = request.cookies?.[sessionCookieName];

  if (typeof token !== 'string') {
    next(new ApiError(401, 'Autenticação necessária.'));
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      typeof payload.tv !== 'number' ||
      typeof payload.sid !== 'string'
    ) {
      clearSessionCookie(response);
      next(new ApiError(401, 'Sessão inválida.'));
      return;
    }

    pool.execute<Array<UsuarioRow & { sessao_id: string }>>(
      `SELECT u.token_version, s.id AS sessao_id
       FROM usuarios u INNER JOIN sessoes s ON s.usuario_id = u.id
       WHERE u.id = ? AND s.id = ? AND s.revogada_em IS NULL
         AND s.expira_em > CURRENT_TIMESTAMP`,
      [payload.sub, payload.sid],
    ).then(async ([sessions]) => {
      if (!sessions[0] || sessions[0].token_version !== payload.tv) {
        clearSessionCookie(response);
        next(new ApiError(401, 'Sessão inválida.'));
        return;
      }
      await pool.execute(
        'UPDATE sessoes SET ultimo_acesso_em = CURRENT_TIMESTAMP WHERE id = ?',
        [payload.sid],
      );
      request.userId = payload.sub;
      request.sessionId = payload.sid;
      next();
    }).catch(next);
  } catch {
    clearSessionCookie(response);
    next(new ApiError(401, 'Sessão inválida.'));
  }
}

function authenticatedUserId(request: Request): string {
  if (!request.userId) {
    throw new ApiError(401, 'Autenticação necessária.');
  }

  return request.userId;
}

function isDuplicateEntry(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ER_DUP_ENTRY'
  );
}

function validateExpenseId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new ApiError(400, 'Identificador de despesa inválido.', ['id']);
  }

  return value;
}

interface DateRange {
  start: string;
  endExclusive: string | null;
  endInclusive: string;
}

function validateCategoryId(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new ApiError(400, 'Identificador de categoria inválido.', ['categoriaId']);
  }

  const categoryId = Number(value);
  if (!Number.isSafeInteger(categoryId)) {
    throw new ApiError(400, 'Identificador de categoria inválido.', ['categoriaId']);
  }

  return categoryId;
}

function validateBudget(body: unknown): number {
  const record = isRecord(body) ? body : {};
  const limite = record.limite;

  if (
    typeof limite !== 'number' ||
    !Number.isFinite(limite) ||
    limite <= 0 ||
    limite > 99999999.99 ||
    Number(limite.toFixed(2)) !== limite
  ) {
    throw new ApiError(400, 'Informe um limite positivo com até duas casas decimais.', [
      'limite',
    ]);
  }

  return limite;
}

function toBudget(row: OrcamentoRow): Orcamento {
  const limite = Number(row.limite);

  if (!Number.isInteger(row.categoriaId) || !Number.isFinite(limite)) {
    throw new Error('Registro de orçamento inválido retornado pelo banco.');
  }

  return { categoriaId: row.categoriaId, limite };
}

function isValidIsoDate(value: string): boolean {
  const match =
    /^(?:1\d{3}|[2-9]\d{3})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value);
  if (!match) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
  return day <= daysInMonth;
}

function toDateRange(start: string, end: string): DateRange {
  const [year, month, day] = end.split('-').map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDay = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDate.getUTCDate()).padStart(2, '0')}`;

  return {
    start,
    endExclusive: nextDay.startsWith('+') ? null : nextDay,
    endInclusive: end,
  };
}

function validatePeriod(query: Record<string, unknown>): DateRange | null {
  const hasMonth = query.mes !== undefined;
  const hasStart = query.dataInicio !== undefined;
  const hasEnd = query.dataFim !== undefined;

  if (hasMonth && (hasStart || hasEnd)) {
    throw new ApiError(400, 'Use o filtro por mês ou por intervalo de datas.', [
      'mes',
      'dataInicio',
      'dataFim',
    ]);
  }

  if (hasStart || hasEnd) {
    if (
      typeof query.dataInicio !== 'string' ||
      typeof query.dataFim !== 'string' ||
      !isValidIsoDate(query.dataInicio) ||
      !isValidIsoDate(query.dataFim)
    ) {
      throw new ApiError(400, 'Informe datas válidas no formato YYYY-MM-DD.', [
        'dataInicio',
        'dataFim',
      ]);
    }
    if (query.dataInicio > query.dataFim) {
      throw new ApiError(400, 'A data inicial deve ser anterior ou igual à data final.', [
        'dataInicio',
        'dataFim',
      ]);
    }
    const startDate = Date.parse(`${query.dataInicio}T00:00:00Z`);
    const endDate = Date.parse(`${query.dataFim}T00:00:00Z`);
    if ((endDate - startDate) / 86400000 + 1 > 366) {
      throw new ApiError(400, 'O período máximo é de 366 dias.', ['dataInicio', 'dataFim']);
    }
    return toDateRange(query.dataInicio, query.dataFim);
  }

  if (!hasMonth) {
    throw new ApiError(400, 'O parâmetro mes é obrigatório no formato YYYY-MM.', ['mes']);
  }
  if (
    typeof query.mes !== 'string' ||
    !/^(\d{4})-(0[1-9]|1[0-2])$/.test(query.mes)
  ) {
    throw new ApiError(400, 'Informe o mês no formato YYYY-MM.', ['mes']);
  }

  const [yearText, monthText] = query.mes.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (year < 1000) {
    throw new ApiError(400, 'Informe um mês válido.', ['mes']);
  }

  const start = `${yearText}-${monthText}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endInclusive =
    `${yearText}-${monthText}-${String(lastDay).padStart(2, '0')}`;
  return toDateRange(start, endInclusive);
}

function validateTransaction(
  body: unknown,
): Pick<DadosDespesa, 'titulo' | 'valor' | 'data'> {
  const fields: string[] = [];
  const record = isRecord(body) ? body : {};
  const titulo = typeof record.titulo === 'string' ? record.titulo.trim() : '';
  const valor = record.valor;
  const data = record.data;

  if (!titulo) {
    fields.push('titulo');
  } else if (titulo.length > 120) {
    fields.push('titulo');
  }

  if (
    typeof valor !== 'number' ||
    !Number.isFinite(valor) ||
    valor <= 0 ||
    valor > 99999999.99 ||
    Number(valor.toFixed(2)) !== valor
  ) {
    fields.push('valor');
  }

  if (
    typeof data !== 'string' ||
    !/^(?:1\d{3}|[2-9]\d{3})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(data)
  ) {
    fields.push('data');
  } else {
    const [year, month, day] = data.split('-').map(Number);
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [
      31,
      leapYear ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ][month - 1];

    if (day > daysInMonth) {
      fields.push('data');
    }
  }

  if (
    fields.length > 0 ||
    typeof valor !== 'number' ||
    typeof data !== 'string'
  ) {
    throw new ApiError(400, 'Revise os campos informados.', fields);
  }

  return { titulo, valor, data };
}

function validateExpense(body: unknown): DadosDespesa {
  const transaction = validateTransaction(body);
  const record = isRecord(body) ? body : {};
  const categoriaId = record.categoriaId;

  if (
    typeof categoriaId !== 'number' ||
    !Number.isInteger(categoriaId) ||
    categoriaId < 1
  ) {
    throw new ApiError(400, 'Revise os campos informados.', ['categoriaId']);
  }

  return { ...transaction, categoriaId };
}

function validateIncome(body: unknown): DadosReceita {
  return validateTransaction(body);
}

function toExpense(row: DespesaRow): Despesa {
  const valor = Number(row.valor);

  if (
    !Number.isFinite(valor) ||
    !Number.isInteger(row.categoriaId) ||
    typeof row.categoria !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.data)
  ) {
    throw new Error('Registro de despesa inválido retornado pelo banco.');
  }

  return {
    id: row.id,
    titulo: row.titulo,
    valor,
    data: row.data,
    categoriaId: row.categoriaId,
    categoria: row.categoria,
  };
}

function toIncome(row: ReceitaRow): Receita {
  const valor = Number(row.valor);

  if (!Number.isFinite(valor) || !/^\d{4}-\d{2}-\d{2}$/.test(row.data)) {
    throw new Error('Registro de receita inválido retornado pelo banco.');
  }

  return {
    id: row.id,
    titulo: row.titulo,
    valor,
    data: row.data,
  };
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
if (process.env.NODE_ENV === 'production') {
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist');
  app.use(express.static(webRoot, { index: 'index.html' }));
}
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use('/api', apiRateLimit);
app.use('/api', (request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.get('origin');
    const allowedOrigins = new Set(
      (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    if (origin && !allowedOrigins.has(origin)) {
      response.status(403).json({ erro: 'Origem não autorizada.', campos: ['origin'] });
      return;
    }
    if (request.get('sec-fetch-site') === 'cross-site') {
      response.status(403).json({ erro: 'Origem não autorizada.', campos: ['sec-fetch-site'] });
      return;
    }
  }
  const contentType = request
    .get('content-type')
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase();

  if (
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
    contentType !== 'application/json'
  ) {
    response.status(415).json({
      erro: 'Content-Type deve ser application/json.',
      campos: ['content-type'],
    });
    return;
  }

  next();
});

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Tente novamente mais tarde.' },
});
const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Tente novamente mais tarde.' },
});

app.post(
  '/api/auth/register',
  authRateLimit,
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const data = validateRegistration(request.body);
      const validatedEmail = await validarEmail(data.email);
      if (!validatedEmail) {
        throw new ApiError(400, 'Informe um email válido e recebível.', ['email']);
      }
      data.email = validatedEmail.email;
      const [existing] = await pool.execute<UsuarioRow[]>(
        'SELECT id, nome, email, senha_hash, token_version, email_verificado_em FROM usuarios WHERE email = ?',
        [data.email],
      );

      if (existing.length > 0) {
        throw new ApiError(409, 'Este email já está cadastrado.', ['email']);
      }

      const user: Usuario = {
        id: randomUUID(),
        nome: data.nome,
        email: data.email,
      };
      const passwordHash = await bcrypt.hash(data.senha, 12);

      try {
        await pool.execute(
          `INSERT INTO usuarios (id, nome, email, email_verificado_em, senha_hash)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)`,
          [user.id, user.nome, user.email, passwordHash],
        );
      } catch (error) {
        if (isDuplicateEntry(error)) {
          throw new ApiError(409, 'Este email já está cadastrado.', ['email']);
        }
        throw error;
      }

      setSessionCookie(response, user.id, 0, await createSession(user.id, 0, request));
      response.status(201).json(toPublicUser(user));
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  '/api/auth/login',
  authRateLimit,
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const data = validateLogin(request.body);
      const validatedEmail = await validarEmail(data.email);
      if (!validatedEmail) throw new ApiError(400, 'Informe um email válido.', ['email']);
      data.email = validatedEmail.email;
      const [users] = await pool.execute<UsuarioRow[]>(
        'SELECT id, nome, email, senha_hash, token_version, email_verificado_em FROM usuarios WHERE email = ?',
        [data.email],
      );
      const user = users[0];

      if (!user) {
        throw new ApiError(404, 'Este email ainda não possui uma conta. Crie um usuário para continuar.', ['email']);
      }
      const passwordHash = user.senha_hash;
      if (!(await bcrypt.compare(data.senha, passwordHash))) {
        throw new ApiError(401, 'Credenciais inválidas.');
      }
      setSessionCookie(
        response,
        user.id,
        user.token_version,
        await createSession(user.id, user.token_version, request),
      );
      response.json(toPublicUser(user));
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  '/api/auth/password-reset/confirm',
  passwordResetRateLimit,
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const data = validateResetPassword(request.body);
      const validated = await validarEmail(data.email);
      if (!validated) throw new ApiError(400, 'Informe um email válido.', ['email']);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [users] = await connection.execute<UsuarioRow[]>(
          'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = ?',
          [validated.email],
        );
        const user = users[0];
        if (!user) throw new ApiError(400, 'Email ou senha inválidos.', ['email']);
        const passwordHash = await bcrypt.hash(data.senha, 12);
        await connection.execute(
          'UPDATE usuarios SET senha_hash = ?, token_version = token_version + 1 WHERE id = ?',
          [passwordHash, user.id],
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      clearSessionCookie(response);
      response.json({ mensagem: 'Senha redefinida com sucesso.' });
    } catch (error) {
      next(error);
    }
  },
);

app.post('/api/auth/logout', requireAuth, async (request, response, next) => {
  try {
    if (!request.sessionId) throw new ApiError(401, 'Sessão inválida.');
    await pool.execute('UPDATE sessoes SET revogada_em = CURRENT_TIMESTAMP WHERE id = ?', [
      request.sessionId,
    ]);
  } catch (error) {
    next(error);
    return;
  }
  clearSessionCookie(response);
  response.json({ status: 'ok' });
});

app.post(
  '/api/auth/logout-all',
  requireAuth,
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      await pool.execute(
        'UPDATE sessoes SET revogada_em = CURRENT_TIMESTAMP WHERE usuario_id = ? AND revogada_em IS NULL',
        [authenticatedUserId(request)],
      );
      clearSessionCookie(response);
      response.json({ status: 'ok' });
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  '/api/auth/me/export',
  requireAuth,
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const userId = authenticatedUserId(request);
      const [users] = await pool.execute<UsuarioRow[]>(
        'SELECT id, nome, email FROM usuarios WHERE id = ?',
        [userId],
      );
      if (!users[0]) throw new ApiError(404, 'Usuário não encontrado.');
      const [expenses] = await pool.execute<DespesaRow[]>(
        `SELECT d.id, d.titulo, d.valor, d.data,
                c.id AS categoriaId, c.nome AS categoria
         FROM despesas d INNER JOIN categorias c ON c.id = d.categoria_id
         WHERE d.usuario_id = ? ORDER BY d.data ASC, d.criada_em ASC`,
        [userId],
      );
      const [incomes] = await pool.execute<ReceitaRow[]>(
        'SELECT id, titulo, valor, data FROM receitas WHERE usuario_id = ? ORDER BY data ASC, criada_em ASC',
        [userId],
      );
      const [budgets] = await pool.execute<OrcamentoRow[]>(
        'SELECT categoria_id AS categoriaId, limite FROM orcamentos WHERE usuario_id = ?',
        [userId],
      );
      response.json({
        usuario: { id: users[0].id, nome: users[0].nome, email: users[0].email },
        despesas: expenses.map(toExpense),
        receitas: incomes.map(toIncome),
        orcamentos: budgets.map((budget) => ({
          categoriaId: budget.categoriaId,
          limite: Number(budget.limite),
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  '/api/auth/me',
  requireAuth,
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parsed = accountPasswordSchema.safeParse(request.body);
      if (!parsed.success) throw new ApiError(400, 'Informe sua senha.', ['senha']);
      const userId = authenticatedUserId(request);
      const [users] = await pool.execute<UsuarioRow[]>(
        'SELECT senha_hash FROM usuarios WHERE id = ?',
        [userId],
      );
      if (!users[0] || !(await bcrypt.compare(parsed.data.senha, users[0].senha_hash))) {
        throw new ApiError(401, 'Senha inválida.', ['senha']);
      }
      await pool.execute('DELETE FROM usuarios WHERE id = ?', [userId]);
      clearSessionCookie(response);
      response.json({ status: 'ok' });
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  '/api/auth/me',
  requireAuth,
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const [users] = await pool.execute<UsuarioRow[]>(
        'SELECT id, nome, email, senha_hash, token_version FROM usuarios WHERE id = ?',
        [authenticatedUserId(request)],
      );

      app.get(
        '/api/auth/me/export',
        requireAuth,
        async (request: Request, response: Response, next: NextFunction) => {
          try {
            const userId = authenticatedUserId(request);
            const [users] = await pool.execute<UsuarioRow[]>(
              'SELECT id, nome, email, token_version FROM usuarios WHERE id = ?',
              [userId],
            );
            const [expenses] = await pool.execute<DespesaRow[]>(
              `SELECT d.id, d.titulo, d.valor, d.data,
                      c.id AS categoriaId, c.nome AS categoria
               FROM despesas d INNER JOIN categorias c ON c.id = d.categoria_id
               WHERE d.usuario_id = ? ORDER BY d.data ASC, d.criada_em ASC`,
              [userId],
            );
            const [incomes] = await pool.execute<ReceitaRow[]>(
              'SELECT id, titulo, valor, data FROM receitas WHERE usuario_id = ? ORDER BY data ASC, criada_em ASC',
              [userId],
            );
            const [budgets] = await pool.execute<OrcamentoRow[]>(
              'SELECT categoria_id AS categoriaId, limite FROM orcamentos WHERE usuario_id = ?',
              [userId],
            );
            if (!users[0]) throw new ApiError(404, 'Usuário não encontrado.');
            response.json({
              usuario: { id: users[0].id, nome: users[0].nome, email: users[0].email },
              despesas: expenses.map(toExpense),
              receitas: incomes.map(toIncome),
              orcamentos: budgets.map((budget) => ({
                categoriaId: budget.categoriaId,
                limite: Number(budget.limite),
              })),
            });
          } catch (error) {
            next(error);
          }
        },
      );

      app.delete(
        '/api/auth/me',
        requireAuth,
        async (request: Request, response: Response, next: NextFunction) => {
          try {
            const parsed = accountPasswordSchema.safeParse(request.body);
            if (!parsed.success) throw new ApiError(400, 'Informe sua senha.', ['senha']);
            const userId = authenticatedUserId(request);
            const [users] = await pool.execute<UsuarioRow[]>(
              'SELECT senha_hash FROM usuarios WHERE id = ?',
              [userId],
            );
            if (!users[0] || !(await bcrypt.compare(parsed.data.senha, users[0].senha_hash))) {
              throw new ApiError(401, 'Senha inválida.', ['senha']);
            }
            await pool.execute('DELETE FROM usuarios WHERE id = ?', [userId]);
            clearSessionCookie(response);
            response.json({ status: 'ok' });
          } catch (error) {
            next(error);
          }
        },
      );
      const user = users[0];

      if (!user) {
        clearSessionCookie(response);
        throw new ApiError(401, 'Sessão inválida.');
      }

      response.json(toPublicUser(user));
    } catch (error) {
      next(error);
    }
  },
);

app.get('/api/saude', async (_request, response, next) => {
  try {
    await pool.execute('SELECT 1');
    response.json({ status: 'ok' });
  } catch (error) {
    console.error('Falha na verificação de saúde do MySQL:', error);
    next(new ApiError(503, 'Banco de dados indisponível.'));
  }
});

app.use('/api/despesas', requireAuth);
app.use('/api/categorias', requireAuth);
app.use('/api/orcamentos', requireAuth);
app.use('/api/receitas', requireAuth);
app.use('/api/resumo', requireAuth);

app.get('/api/resumo/mensal', async (request, response, next) => {
  try {
    const ate = request.query.ate;
    const mesesQuery = request.query.meses;
    const meses = mesesQuery === undefined ? 6 : Number(mesesQuery);

    if (
      typeof ate !== 'string' ||
      !/^(\d{4})-(0[1-9]|1[0-2])$/.test(ate) ||
      Number(ate.slice(0, 4)) < 1000
    ) {
      throw new ApiError(400, 'Informe ate no formato YYYY-MM.', ['ate']);
    }
    if (
      (mesesQuery !== undefined &&
        (typeof mesesQuery !== 'string' || !/^(6|12)$/.test(mesesQuery))) ||
      (meses !== 6 && meses !== 12)
    ) {
      throw new ApiError(400, 'meses deve ser 6 ou 12.', ['meses']);
    }

    const [year, month] = ate.split('-').map(Number);
    const endMonthIndex = year * 12 + month - 1;
    const startMonthIndex = endMonthIndex - meses + 1;
    const startYear = Math.floor(startMonthIndex / 12);
    if (startYear < 1000) {
      throw new ApiError(400, 'O período solicitado está fora do intervalo válido.', [
        'ate',
        'meses',
      ]);
    }

    const start = `${String(startYear).padStart(4, '0')}-${String(
      (startMonthIndex % 12) + 1,
    ).padStart(2, '0')}-01`;
    const nextMonthIndex = endMonthIndex + 1;
    const nextYear = Math.floor(nextMonthIndex / 12);
    const endExclusive =
      nextYear > 9999
        ? null
        : `${String(nextYear).padStart(4, '0')}-${String(
            (nextMonthIndex % 12) + 1,
          ).padStart(2, '0')}-01`;
    const userId = authenticatedUserId(request);

    const aggregate = async (table: 'receitas' | 'despesas') => {
      const sql = endExclusive
        ? `SELECT DATE_FORMAT(data, '%Y-%m') AS mes, SUM(valor) AS total
           FROM ${table}
           WHERE usuario_id = ? AND data >= ? AND data < ?
           GROUP BY DATE_FORMAT(data, '%Y-%m')`
        : `SELECT DATE_FORMAT(data, '%Y-%m') AS mes, SUM(valor) AS total
           FROM ${table}
           WHERE usuario_id = ? AND data >= ?
           GROUP BY DATE_FORMAT(data, '%Y-%m')`;
      const parameters = endExclusive
        ? [userId, start, endExclusive]
        : [userId, start];
      const [rows] = await pool.execute<ResumoMensalRow[]>(sql, parameters);
      return new Map(rows.map((row) => [row.mes, Number(row.total)]));
    };

    const [incomeTotals, expenseTotals] = await Promise.all([
      aggregate('receitas'),
      aggregate('despesas'),
    ]);
    const summary: ResumoMensal[] = [];

    for (let offset = 0; offset < meses; offset += 1) {
      const monthIndex = startMonthIndex + offset;
      const currentYear = Math.floor(monthIndex / 12);
      const currentMonth = (monthIndex % 12) + 1;
      const key = `${String(currentYear).padStart(4, '0')}-${String(
        currentMonth,
      ).padStart(2, '0')}`;
      const receitas = incomeTotals.get(key) ?? 0;
      const despesas = expenseTotals.get(key) ?? 0;
      const saldo = Math.round((receitas - despesas) * 100) / 100;

      if (![receitas, despesas, saldo].every(Number.isFinite)) {
        throw new Error('Agregação mensal retornou um valor inválido.');
      }

      summary.push({ mes: key, receitas, despesas, saldo });
    }

    response.json(summary);
  } catch (error) {
    next(error);
  }
});

app.get('/api/despesas', async (request, response, next) => {
  try {
    const period = validatePeriod(request.query);
    const userId = authenticatedUserId(request);
    const query = `SELECT d.id, d.titulo, d.valor, d.data,
                          c.id AS categoriaId, c.nome AS categoria
                   FROM despesas d
                   INNER JOIN categorias c ON c.id = d.categoria_id`;
    let rows: DespesaRow[];

    if (period?.endExclusive) {
      [rows] = await pool.execute<DespesaRow[]>(
        `${query}
         WHERE d.usuario_id = ? AND d.data >= ? AND d.data < ?
         ORDER BY d.data DESC, d.criada_em DESC
         LIMIT 1001`,
        [userId, period.start, period.endExclusive],
      );
    } else if (period) {
      [rows] = await pool.execute<DespesaRow[]>(
        `${query}
         WHERE d.usuario_id = ? AND d.data >= ? AND d.data <= ?
         ORDER BY d.data DESC, d.criada_em DESC
         LIMIT 1001`,
        [userId, period.start, period.endInclusive],
      );
    } else {
      [rows] = await pool.execute<DespesaRow[]>(
        `${query}
         WHERE d.usuario_id = ?
         ORDER BY d.data DESC, d.criada_em DESC
         LIMIT 1001`,
        [userId],
      );
    }

    if (rows.length > 1000) {
      throw new ApiError(422, 'O período contém mais de 1000 despesas. Refine o mês.', ['mes']);
    }
    response.json(rows.map(toExpense));
  } catch (error) {
    next(error);
  }
});

app.get('/api/despesas/:id', async (request, response, next) => {
  try {
    const id = validateExpenseId(request.params.id);
    const [rows] = await pool.execute<DespesaRow[]>(
      `SELECT d.id, d.titulo, d.valor, d.data,
              c.id AS categoriaId, c.nome AS categoria
       FROM despesas d
       INNER JOIN categorias c ON c.id = d.categoria_id
       WHERE d.id = ? AND d.usuario_id = ?`,
      [id, authenticatedUserId(request)],
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Despesa não encontrada.');
    }

    response.json(toExpense(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.get('/api/categorias', async (_request, response, next) => {
  try {
    const [rows] = await pool.execute<CategoriaRow[]>(
      'SELECT id, nome FROM categorias ORDER BY id ASC',
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/orcamentos', async (request, response, next) => {
  try {
    const [rows] = await pool.execute<OrcamentoRow[]>(
      `SELECT categoria_id AS categoriaId, limite
       FROM orcamentos
       WHERE usuario_id = ?
       ORDER BY categoria_id ASC`,
      [authenticatedUserId(request)],
    );
    response.json(rows.map(toBudget));
  } catch (error) {
    next(error);
  }
});

app.put(
  '/api/orcamentos/:categoriaId',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const categoriaId = validateCategoryId(request.params.categoriaId);
      const limite = validateBudget(request.body);
      const usuarioId = authenticatedUserId(request);
      const [categories] = await pool.execute<CategoriaRow[]>(
        'SELECT id FROM categorias WHERE id = ?',
        [categoriaId],
      );

      if (categories.length === 0) {
        throw new ApiError(400, 'Selecione uma categoria válida.', ['categoriaId']);
      }

      await pool.execute(
        `INSERT INTO orcamentos (usuario_id, categoria_id, limite)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE limite = VALUES(limite)`,
        [usuarioId, categoriaId, limite],
      );
      response.json({ categoriaId, limite } satisfies Orcamento);
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  '/api/orcamentos/:categoriaId',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const categoriaId = validateCategoryId(request.params.categoriaId);
      const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM orcamentos
         WHERE usuario_id = ? AND categoria_id = ?`,
        [authenticatedUserId(request), categoriaId],
      );

      if (result.affectedRows === 0) {
        throw new ApiError(404, 'Orçamento não encontrado.');
      }

      response.json({ categoriaId });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  '/api/despesas',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const data = validateExpense(request.body);
      const usuarioId = authenticatedUserId(request);
      const [categories] = await pool.execute<CategoriaRow[]>(
        'SELECT id, nome FROM categorias WHERE id = ?',
        [data.categoriaId],
      );

      if (categories.length === 0) {
        throw new ApiError(400, 'Selecione uma categoria válida.', ['categoriaId']);
      }

      const id = randomUUID();

      await pool.execute<ResultSetHeader>(
        `INSERT INTO despesas (id, titulo, valor, data, categoria_id, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, data.titulo, data.valor, data.data, data.categoriaId, usuarioId],
      );

      response.status(201).json({
        id,
        titulo: data.titulo,
        valor: data.valor,
        data: data.data,
        categoriaId: data.categoriaId,
        categoria: categories[0].nome,
      } satisfies Despesa);
    } catch (error) {
      next(error);
    }
  },
);

app.put(
  '/api/despesas/:id',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const id = validateExpenseId(request.params.id);
      const data = validateExpense(request.body);
      const usuarioId = authenticatedUserId(request);
      const [categories] = await pool.execute<CategoriaRow[]>(
        'SELECT id, nome FROM categorias WHERE id = ?',
        [data.categoriaId],
      );

      if (categories.length === 0) {
        throw new ApiError(400, 'Selecione uma categoria válida.', ['categoriaId']);
      }

      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE despesas
         SET titulo = ?, valor = ?, data = ?, categoria_id = ?
         WHERE id = ? AND usuario_id = ?`,
        [data.titulo, data.valor, data.data, data.categoriaId, id, usuarioId],
      );

      if (result.affectedRows === 0) {
        const [rows] = await pool.execute<DespesaRow[]>(
          `SELECT d.id, d.titulo, d.valor, d.data,
                  c.id AS categoriaId, c.nome AS categoria
           FROM despesas d
           INNER JOIN categorias c ON c.id = d.categoria_id
           WHERE d.id = ? AND d.usuario_id = ?`,
          [id, usuarioId],
        );

        if (rows.length === 0) {
          throw new ApiError(404, 'Despesa não encontrada.');
        }
      }

      response.json({
        id,
        ...data,
        categoria: categories[0].nome,
      } satisfies Despesa);
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  '/api/despesas/:id',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const id = validateExpenseId(request.params.id);
      const usuarioId = authenticatedUserId(request);
      const [result] = await pool.execute<ResultSetHeader>(
        'DELETE FROM despesas WHERE id = ? AND usuario_id = ?',
        [id, usuarioId],
      );

      if (result.affectedRows === 0) {
        throw new ApiError(404, 'Despesa não encontrada.');
      }

      response.json({ id });
    } catch (error) {
      next(error);
    }
  },
);

app.get('/api/receitas', async (request, response, next) => {
  try {
    const period = validatePeriod(request.query);
    const userId = authenticatedUserId(request);
    const query = `SELECT id, titulo, valor, data
                   FROM receitas`;
    let rows: ReceitaRow[];

    if (period?.endExclusive) {
      [rows] = await pool.execute<ReceitaRow[]>(
        `${query}
         WHERE usuario_id = ? AND data >= ? AND data < ?
         ORDER BY data ASC, criada_em ASC
         LIMIT 1001`,
        [userId, period.start, period.endExclusive],
      );
    } else if (period) {
      [rows] = await pool.execute<ReceitaRow[]>(
        `${query}
         WHERE usuario_id = ? AND data >= ? AND data <= ?
         ORDER BY data ASC, criada_em ASC
         LIMIT 1001`,
        [userId, period.start, period.endInclusive],
      );
    } else {
      [rows] = await pool.execute<ReceitaRow[]>(
        `${query}
         WHERE usuario_id = ?
         ORDER BY data ASC, criada_em ASC
         LIMIT 1001`,
        [userId],
      );
    }

    if (rows.length > 1000) {
      throw new ApiError(422, 'O período contém mais de 1000 receitas. Refine o mês.', ['mes']);
    }
    response.json(rows.map(toIncome));
  } catch (error) {
    next(error);
  }
});

app.get('/api/receitas/:id', async (request, response, next) => {
  try {
    const id = validateExpenseId(request.params.id);
    const [rows] = await pool.execute<ReceitaRow[]>(
      `SELECT id, titulo, valor, data
       FROM receitas
       WHERE id = ? AND usuario_id = ?`,
      [id, authenticatedUserId(request)],
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Receita não encontrada.');
    }

    response.json(toIncome(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.post(
  '/api/receitas',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const data = validateIncome(request.body);
      const id = randomUUID();
      const userId = authenticatedUserId(request);

      await pool.execute<ResultSetHeader>(
        `INSERT INTO receitas (id, usuario_id, titulo, valor, data)
         VALUES (?, ?, ?, ?, ?)`,
        [id, userId, data.titulo, data.valor, data.data],
      );

      response.status(201).json({ id, ...data } satisfies Receita);
    } catch (error) {
      next(error);
    }
  },
);

app.put(
  '/api/receitas/:id',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const id = validateExpenseId(request.params.id);
      const data = validateIncome(request.body);
      const userId = authenticatedUserId(request);
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE receitas
         SET titulo = ?, valor = ?, data = ?
         WHERE id = ? AND usuario_id = ?`,
        [data.titulo, data.valor, data.data, id, userId],
      );

      if (result.affectedRows === 0) {
        const [rows] = await pool.execute<ReceitaRow[]>(
          `SELECT id, titulo, valor, data
           FROM receitas
           WHERE id = ? AND usuario_id = ?`,
          [id, userId],
        );

        if (rows.length === 0) {
          throw new ApiError(404, 'Receita não encontrada.');
        }
      }

      response.json({ id, ...data } satisfies Receita);
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  '/api/receitas/:id',
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const id = validateExpenseId(request.params.id);
      const [result] = await pool.execute<ResultSetHeader>(
        'DELETE FROM receitas WHERE id = ? AND usuario_id = ?',
        [id, authenticatedUserId(request)],
      );

      if (result.affectedRows === 0) {
        throw new ApiError(404, 'Receita não encontrada.');
      }

      response.json({ id });
    } catch (error) {
      next(error);
    }
  },
);

app.use(((error: unknown, _request, response, _next) => {
  if (error instanceof ApiError) {
    response.status(error.status).json({
      erro: error.message,
      campos: error.fields,
    });
    return;
  }

  if (
    error instanceof SyntaxError &&
    'status' in error &&
    error.status === 400 &&
    'body' in error
  ) {
    response.status(400).json({
      erro: 'O corpo da requisição contém JSON inválido.',
      campos: ['body'],
    });
    return;
  }

  const correlationId = randomUUID().replace(/-/g, '').slice(0, 12);
  console.error(JSON.stringify({
    evento: 'erro_interno',
    correlationId,
    tipo: error instanceof Error ? error.name : 'UnknownError',
  }));
  response.status(500).json({
    erro: `Erro interno do servidor. Código: ${correlationId}`,
    campos: [],
  });
}) satisfies ErrorRequestHandler);

const apiPort = Number(process.env.API_PORT || '3001');

if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
  throw new Error('API_PORT deve ser uma porta válida.');
}

async function startServer(): Promise<void> {
  const server = app.listen(apiPort, '127.0.0.1', () => {
    console.log(`API disponível em http://127.0.0.1:${apiPort}`);
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
}

startServer().catch((error: unknown) => {
  console.error('Falha ao iniciar a API:', error);
  process.exitCode = 1;
});
