import { randomUUID } from 'node:crypto';

const apiUrl = process.env.SMOKE_TEST_API_URL || 'http://127.0.0.1:3001/api';
const testDate = new Date().toISOString().slice(0, 10);

interface TestUser {
  id: string;
  nome: string;
  email: string;
}

interface TestCategory {
  id: number;
  nome: string;
}

function expectStatus(response: Response, expected: number, label: string): void {
  if (response.status !== expected) {
    throw new Error(`${label}: esperado HTTP ${expected}, recebido ${response.status}.`);
  }
}

async function registerUser(
  name: string,
  password = `Teste-${randomUUID()}`,
): Promise<{
  user: TestUser;
  cookie: string;
  email: string;
  password: string;
}> {
  const unique = randomUUID();
  const email = `smoke-${unique}@example.test`;
  const response = await fetch(`${apiUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: name, email, senha: password }),
  });
  expectStatus(response, 201, `Cadastro de ${name}`);
  const user = (await response.json()) as TestUser;
  const setCookie = response.headers.get('set-cookie');
  const cookie = setCookie?.split(';', 1)[0];
  if (!cookie || !user.id || !user.email) throw new Error(`Cadastro de ${name} não retornou sessão/usuário.`);
  return { user, cookie, email, password };
}

async function main(): Promise<void> {
  const unauthenticated = await fetch(`${apiUrl}/despesas`);
  expectStatus(unauthenticated, 401, 'Acesso sem cookie');
  const unauthenticatedSummary = await fetch(
    `${apiUrl}/resumo/mensal?ate=${testDate.slice(0, 7)}&meses=6`,
  );
  expectStatus(unauthenticatedSummary, 401, 'Resumo mensal sem cookie');

  for (const password of ['12345678', '87654321']) {
    const response = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Senha previsível',
        email: `weak-${randomUUID()}@example.test`,
        senha: password,
      }),
    });
    expectStatus(response, 400, `Rejeição de senha sequencial ${password}`);
  }

  const userA = await registerUser('Smoke Test A', '48291736');
  const userB = await registerUser('Smoke Test B');
  const categoriesResponse = await fetch(`${apiUrl}/categorias`, {
    headers: { Cookie: userA.cookie },
  });
  expectStatus(categoriesResponse, 200, 'Listagem de categorias autenticada');
  const categories = (await categoriesResponse.json()) as TestCategory[];
  const categoryId = categories[0]?.id;

  if (!Number.isInteger(categoryId)) {
    throw new Error('Não foi encontrada uma categoria para o teste.');
  }

  const createResponse = await fetch(`${apiUrl}/despesas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: userA.cookie,
    },
    body: JSON.stringify({
      titulo: 'Despesa do smoke test',
      valor: 1,
      data: testDate,
      categoriaId: categoryId,
    }),
  });
  expectStatus(createResponse, 201, 'Criação de despesa do usuário A');
  const expense = (await createResponse.json()) as { id: string };
  let incomeId: string | null = null;

  try {
    const ownExpense = await fetch(`${apiUrl}/despesas/${expense.id}`, {
      headers: { Cookie: userA.cookie },
    });
    expectStatus(ownExpense, 200, 'Leitura pelo dono da despesa');

    const otherUserRead = await fetch(`${apiUrl}/despesas/${expense.id}`, {
      headers: { Cookie: userB.cookie },
    });
    expectStatus(otherUserRead, 404, 'Leitura da despesa pelo usuário B');

    const updateByOtherUser = await fetch(`${apiUrl}/despesas/${expense.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userB.cookie,
      },
      body: JSON.stringify({
        titulo: 'Tentativa de edição',
        valor: 2,
        data: testDate,
        categoriaId: categoryId,
      }),
    });
    expectStatus(updateByOtherUser, 404, 'Edição da despesa pelo usuário B');

    const deleteByOtherUser = await fetch(`${apiUrl}/despesas/${expense.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userB.cookie,
      },
    });
    expectStatus(deleteByOtherUser, 404, 'Exclusão da despesa pelo usuário B');

    const badLogin = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userA.email, senha: 'senha-incorreta' }),
    });
    expectStatus(badLogin, 401, 'Login com senha incorreta');
    const loginBody = (await badLogin.json()) as { erro?: string };

    if (loginBody.erro !== 'Credenciais inválidas.') {
      throw new Error('Login inválido não retornou a mensagem genérica esperada.');
    }

    const createIncome = await fetch(`${apiUrl}/receitas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userA.cookie,
      },
      body: JSON.stringify({
        titulo: 'Receita do smoke test',
        valor: 2,
        data: testDate,
      }),
    });
    expectStatus(createIncome, 201, 'Criação de receita do usuário A');
    incomeId = ((await createIncome.json()) as { id: string }).id;

    for (const query of [
      `ate=${testDate.slice(0, 7)}&meses=7`,
      'ate=2026-13&meses=6',
      'meses=6',
    ]) {
      const invalidSummary = await fetch(`${apiUrl}/resumo/mensal?${query}`, {
        headers: { Cookie: userA.cookie },
      });
      expectStatus(invalidSummary, 400, `Validação do resumo mensal (${query})`);
    }

    const summaryResponse = await fetch(
      `${apiUrl}/resumo/mensal?ate=${testDate.slice(0, 7)}&meses=6`,
      { headers: { Cookie: userA.cookie } },
    );
    expectStatus(summaryResponse, 200, 'Resumo mensal autenticado');
    const summary = (await summaryResponse.json()) as Array<{
      mes: string;
      receitas: number;
      despesas: number;
      saldo: number;
    }>;
    const currentMonth = summary.find((item) => item.mes === testDate.slice(0, 7));
    if (
      summary.length !== 6 ||
      currentMonth?.receitas !== 2 ||
      currentMonth.despesas !== 1 ||
      currentMonth.saldo !== 1 ||
      summary.some((item) =>
        item.mes !== testDate.slice(0, 7) &&
        (item.receitas !== 0 || item.despesas !== 0 || item.saldo !== 0),
      )
    ) {
      throw new Error('Agregação mensal ou preenchimento dos meses vazios incorreto.');
    }

    const yearEnd = Number(testDate.slice(0, 4));
    const monthEnd = Number(testDate.slice(5, 7));
    const twelveMonthStart = new Date(Date.UTC(yearEnd, monthEnd - 1 - 11, 1));
    const twelveMonthEnd =
      `${String(yearEnd).padStart(4, '0')}-${String(monthEnd).padStart(2, '0')}`;
    const twelveMonthResponse = await fetch(
      `${apiUrl}/resumo/mensal?ate=${twelveMonthEnd}&meses=12`,
      { headers: { Cookie: userA.cookie } },
    );
    expectStatus(twelveMonthResponse, 200, 'Resumo dos últimos 12 meses');
    const twelveMonthSummary = (await twelveMonthResponse.json()) as unknown[];
    if (
      twelveMonthSummary.length !== 12 ||
      twelveMonthSummary[0] &&
        (twelveMonthSummary[0] as { mes?: unknown }).mes !==
          `${twelveMonthStart.getUTCFullYear()}-${String(
            twelveMonthStart.getUTCMonth() + 1,
          ).padStart(2, '0')}`
    ) {
      throw new Error('Resumo de 12 meses não retornou o intervalo consecutivo esperado.');
    }

    const otherUserSummary = await fetch(
      `${apiUrl}/resumo/mensal?ate=${testDate.slice(0, 7)}&meses=6`,
      { headers: { Cookie: userB.cookie } },
    );
    expectStatus(otherUserSummary, 200, 'Resumo mensal do usuário B');
    const otherUserMonths = (await otherUserSummary.json()) as Array<{
      receitas: number;
      despesas: number;
      saldo: number;
    }>;
    if (
      otherUserMonths.some(
        (item) => item.receitas !== 0 || item.despesas !== 0 || item.saldo !== 0,
      )
    ) {
      throw new Error('Resumo mensal expôs dados do usuário A para o usuário B.');
    }

    const otherUserIncomes = await fetch(`${apiUrl}/receitas?mes=${testDate.slice(0, 7)}`, {
      headers: { Cookie: userB.cookie },
    });
    expectStatus(otherUserIncomes, 200, 'Listagem de receitas do usuário B');
    if (((await otherUserIncomes.json()) as unknown[]).length !== 0) {
      throw new Error('Usuário B recebeu receita de outra conta.');
    }

    const otherUserReadIncome = await fetch(`${apiUrl}/receitas/${incomeId}`, {
      headers: { Cookie: userB.cookie },
    });
    expectStatus(otherUserReadIncome, 404, 'Leitura da receita pelo usuário B');

    const otherUserUpdateIncome = await fetch(`${apiUrl}/receitas/${incomeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userB.cookie,
      },
      body: JSON.stringify({
        titulo: 'Tentativa de edição',
        valor: 3,
        data: testDate,
      }),
    });
    expectStatus(otherUserUpdateIncome, 404, 'Edição da receita pelo usuário B');

    const otherUserDeleteIncome = await fetch(`${apiUrl}/receitas/${incomeId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userB.cookie,
      },
    });
    expectStatus(otherUserDeleteIncome, 404, 'Exclusão da receita pelo usuário B');
  } finally {
    await fetch(`${apiUrl}/despesas/${expense.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userA.cookie,
      },
    });
    if (incomeId) {
      await fetch(`${apiUrl}/receitas/${incomeId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Cookie: userA.cookie,
        },
      });
    }
  }

  console.log('Smoke test passed: sessions, authentication, expense and income ownership isolation.');
}

main().catch((error: unknown) => {
  console.error('Smoke test failed:', error);
  process.exitCode = 1;
});
