import './style.css';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import type {
  Categoria,
  Despesa,
  Orcamento,
  Receita,
  ResumoMensal,
  Usuario,
} from './types';
import {
  formatIsoToPtBr,
  localToday as getLocalToday,
  monthRange,
  validateRange,
} from './date-utils';
import { getDateValue, initializeDatePicker, setDateValue } from './date-picker';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

function getElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Elemento obrigatório não encontrado: ${selector}`);
  }

  return element;
}

const expenseForm = getElement<HTMLFormElement>('#expense-form');
const titleInput = getElement<HTMLInputElement>('#expense-title');
const amountInput = getElement<HTMLInputElement>('#expense-amount');
const dateInput = getElement<HTMLInputElement>('#expense-date');
const categorySelect = getElement<HTMLSelectElement>('#expense-category');
const formError = getElement<HTMLParagraphElement>('#form-error');
const apiStatus = getElement<HTMLParagraphElement>('#api-status');
const totalAmount = getElement<HTMLParagraphElement>('#total-amount');
const categoryTotals = getElement<HTMLUListElement>('#category-totals');
const categoryCount = getElement<HTMLSpanElement>('#category-count');
const expenseList = getElement<HTMLUListElement>('#expense-list');
const expenseCount = getElement<HTMLSpanElement>('#expense-count');
const expensePeriodLabel = getElement<HTMLParagraphElement>('#expense-period-label');
const periodMode = getElement<HTMLSelectElement>('#period-mode');
const periodMonthControl = getElement<HTMLDivElement>('#period-month-control');
const monthSelect = getElement<HTMLSelectElement>('#expense-month');
const yearInput = getElement<HTMLInputElement>('#expense-year');
const periodRangeControl = getElement<HTMLDivElement>('#period-range-control');
const periodStartInput = getElement<HTMLInputElement>('#period-start');
const periodEndInput = getElement<HTMLInputElement>('#period-end');
const periodPreviousButton = getElement<HTMLButtonElement>('#period-previous');
const periodNextButton = getElement<HTMLButtonElement>('#period-next');
const dashboardTab = getElement<HTMLButtonElement>('#dashboard-tab');
const chartsTab = getElement<HTMLButtonElement>('#charts-tab');
const dashboardView = getElement<HTMLDivElement>('#dashboard-view');
const chartsView = getElement<HTMLElement>('#charts-view');
const chartMonthCount = getElement<HTMLSelectElement>('#chart-month-count');
const chartStatus = getElement<HTMLParagraphElement>('#chart-status');
const chartEmptyState = getElement<HTMLDivElement>('#chart-empty-state');
const chartCanvasContainer = getElement<HTMLDivElement>('#chart-canvas-container');
const chartCanvas = getElement<HTMLCanvasElement>('#monthly-chart');
const chartTablePanel = getElement<HTMLDivElement>('#chart-table-panel');
const chartTableBody = getElement<HTMLTableSectionElement>('#chart-table-body');
const submitButton = getElement<HTMLButtonElement>('.submit-button');
const cancelEditButton = getElement<HTMLButtonElement>('#cancel-edit');
const formTitle = getElement<HTMLHeadingElement>('#form-title');
const formDescription = getElement<HTMLParagraphElement>('#form-description');
const incomeForm = getElement<HTMLFormElement>('#income-form');
const incomeTitleInput = getElement<HTMLInputElement>('#income-title');
const incomeAmountInput = getElement<HTMLInputElement>('#income-amount-input');
const incomeDateInput = getElement<HTMLInputElement>('#income-date');
const incomeFormError = getElement<HTMLParagraphElement>('#income-form-error');
const incomeFormTitle = getElement<HTMLHeadingElement>('#income-form-title');
const incomeFormDescription = getElement<HTMLParagraphElement>('#income-form-description');
const incomeSubmitButton = getElement<HTMLButtonElement>('#income-submit');
const cancelIncomeEditButton = getElement<HTMLButtonElement>('#cancel-income-edit');
const incomeList = getElement<HTMLUListElement>('#income-list');
const incomeCount = getElement<HTMLSpanElement>('#income-count');
const incomeTotalAmount = getElement<HTMLParagraphElement>('#income-amount');
const balanceAmount = getElement<HTMLParagraphElement>('#balance-amount');
const balanceCaption = getElement<HTMLParagraphElement>('#balance-caption');
const appShell = getElement<HTMLDivElement>('#app-shell');
const authView = getElement<HTMLElement>('#auth-view');
const loginForm = getElement<HTMLFormElement>('#login-form');
const registerForm = getElement<HTMLFormElement>('#register-form');
const resetRequestForm = getElement<HTMLFormElement>('#reset-request-form');
const authError = getElement<HTMLParagraphElement>('#auth-error');
const authTitle = getElement<HTMLHeadingElement>('#auth-title');
const authSwitchLabel = getElement<HTMLSpanElement>('#auth-switch-label');
const authSwitchButton = getElement<HTMLButtonElement>('#auth-switch-button');
const forgotPasswordButton = getElement<HTMLButtonElement>('#forgot-password-button');
const logoutButton = getElement<HTMLButtonElement>('#logout-button');
const logoutAllButton = getElement<HTMLButtonElement>('#logout-all-button');
const exportAccountButton = getElement<HTMLButtonElement>('#export-account-button');
const deleteAccountButton = getElement<HTMLButtonElement>('#delete-account-button');
const userName = getElement<HTMLSpanElement>('#user-name');

initializeDatePicker(dateInput);
initializeDatePicker(incomeDateInput);
initializeDatePicker(periodStartInput, {
  optional: true,
  getMax: () => getDateValue(periodEndInput) || null,
  onChange: () => reloadForPeriodChange(),
});
initializeDatePicker(periodEndInput, {
  optional: true,
  getMin: () => getDateValue(periodStartInput) || null,
  onChange: () => reloadForPeriodChange(),
});

let expenses: Despesa[] = [];
let incomes: Receita[] = [];
let categories: Categoria[] = [];
let budgets: Orcamento[] = [];
let editingExpenseId: string | null = null;
let editingIncomeId: string | null = null;
let editingBudgetCategoryId: number | null = null;
let loadSequence = 0;
let dataAbortController: AbortController | null = null;
let chartLoadSequence = 0;
let monthlySummary: ResumoMensal[] | null = null;
let monthlySummaryKey: string | null = null;
let monthlyChart: Chart | null = null;
let chartsTabActive = false;
const appName = import.meta.env.VITE_APP_NAME || 'Despesas — Painel financeiro';
const locale = 'pt-BR';
const currency = import.meta.env.VITE_CURRENCY || 'BRL';

document.title = appName;

const currencyFormatter = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency,
});
const predictablePasswordMessage =
  'Essa senha é uma sequência numérica previsível. Escolha uma senha mais forte; combinar letras, números e caracteres especiais é recomendado, mas opcional.';

class ApiResponseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function isCategory(value: unknown): value is Categoria {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const category = value as Record<string, unknown>;
  return (
    typeof category.id === 'number' &&
    Number.isInteger(category.id) &&
    category.id > 0 &&
    typeof category.nome === 'string'
  );
}

function isUser(value: unknown): value is Usuario {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    typeof user.nome === 'string' &&
    typeof user.email === 'string'
  );
}

function isBudget(value: unknown): value is Orcamento {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const budget = value as Record<string, unknown>;
  return (
    typeof budget.categoriaId === 'number' &&
    Number.isInteger(budget.categoriaId) &&
    typeof budget.limite === 'number' &&
    Number.isFinite(budget.limite) &&
    budget.limite > 0
  );
}

const localToday = getLocalToday;

function formatDate(value: string): string {
  return formatIsoToPtBr(value);
}

function selectedMonth(): string | null {
  return periodMode.value === 'month' ? selectedMonthValue() : null;
}

function selectedMonthValue(): string {
  return `${yearInput.value}-${monthSelect.value}`;
}

function selectedRange(): { start: string; end: string } {
  if (periodMode.value === 'month') {
    return monthRange(Number(yearInput.value), Number(monthSelect.value));
  }
  return {
    start: getDateValue(periodStartInput),
    end: getDateValue(periodEndInput),
  };
}

function selectedPeriodQuery(): URLSearchParams | null {
  if (periodMode.value === 'month' && yearInput.value) {
    return new URLSearchParams({ mes: selectedMonthValue() });
  }

  if (periodMode.value === 'range') {
    const start = getDateValue(periodStartInput);
    const end = getDateValue(periodEndInput);
    return new URLSearchParams({
      dataInicio: start ?? '',
      dataFim: end ?? '',
    });
  }

  return null;
}

function hasPeriodFilter(): boolean {
  return periodMode.value !== 'all';
}

function validateSelectedPeriod(): boolean {
  if (periodMode.value === 'month') {
    const year = Number(yearInput.value);
    if (
      /^\d{4}$/.test(yearInput.value) &&
      Number.isInteger(year) &&
      year >= 1000 &&
      year <= 9999 &&
      /^(0[1-9]|1[0-2])$/.test(monthSelect.value)
    ) {
      return true;
    }
    setApiStatus('Selecione um mês válido para filtrar.', 'error');
    return false;
  }

  if (periodMode.value === 'range') {
    const start = getDateValue(periodStartInput);
    const end = getDateValue(periodEndInput);
    const error = validateRange({ start: start ?? '', end: end ?? '' });
    if (error) {
      setApiStatus(error, 'error');
      return false;
    }
  }

  return true;
}

function updatePeriodControls(): void {
  const isMonth = periodMode.value === 'month';
  const isRange = periodMode.value === 'range';
  periodMonthControl.hidden = !isMonth;
  periodRangeControl.hidden = !isRange;
  monthSelect.required = isMonth;
  yearInput.required = isMonth;
  periodStartInput.required = isRange;
  periodEndInput.required = isRange;
}

function reloadForPeriodChange(): void {
  const scrollTop = window.scrollY;
  if (!validateSelectedPeriod()) {
    return;
  }

  void loadData().finally(() => {
    window.requestAnimationFrame(() => window.scrollTo(0, scrollTop));
  });
}

function shiftSelectedMonth(offset: number): void {
  const date = new Date(Number(yearInput.value), Number(monthSelect.value) - 1 + offset, 1);
  yearInput.value = String(date.getFullYear());
  monthSelect.value = String(date.getMonth() + 1).padStart(2, '0');
  reloadForPeriodChange();
}

function isValidAmount(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value > 0 &&
    value <= 99999999.99 &&
    Number(value.toFixed(2)) === value
  );
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1000 &&
    year <= 9999 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
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

function isExpense(value: unknown): value is Despesa {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const expense = value as Record<string, unknown>;
  return (
    typeof expense.id === 'string' &&
    typeof expense.titulo === 'string' &&
    typeof expense.valor === 'number' &&
    Number.isFinite(expense.valor) &&
    typeof expense.data === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(expense.data) &&
    typeof expense.categoriaId === 'number' &&
    Number.isInteger(expense.categoriaId) &&
    expense.categoriaId > 0 &&
    typeof expense.categoria === 'string' &&
    expense.categoria.length > 0
  );
}

function isIncome(value: unknown): value is Receita {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const income = value as Record<string, unknown>;
  return (
    typeof income.id === 'string' &&
    typeof income.titulo === 'string' &&
    typeof income.valor === 'number' &&
    Number.isFinite(income.valor) &&
    typeof income.data === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(income.data)
  );
}

function isMonthlySummary(value: unknown): value is ResumoMensal {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const summary = value as Record<string, unknown>;
  return (
    typeof summary.mes === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(summary.mes) &&
    typeof summary.receitas === 'number' &&
    Number.isFinite(summary.receitas) &&
    typeof summary.despesas === 'number' &&
    Number.isFinite(summary.despesas) &&
    typeof summary.saldo === 'number' &&
    Number.isFinite(summary.saldo)
  );
}

async function requestApi<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`/api${path}`, options);
  } catch {
    throw new Error('Não foi possível conectar à API. Verifique se o servidor está em execução.');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (response.status === 502 || response.status === 503) {
      throw new Error('A API está indisponível. Inicie o servidor da API e tente novamente.');
    }
    throw new Error('A API retornou uma resposta inválida.');
  }

  if (!response.ok) {
    let message = 'A solicitação não foi concluída. Tente novamente.';
    if (
      typeof body === 'object' &&
      body !== null &&
      'erro' in body &&
      typeof body.erro === 'string'
    ) {
      message = body.erro;
    }

    if (response.status === 401) {
      showLogin();
    }

    throw new ApiResponseError(message, response.status);
  }

  return body as T;
}

function setApiStatus(message: string, state: 'loading' | 'error' | 'success'): void {
  apiStatus.textContent = message;
  apiStatus.className = `api-status api-status-${state}`;
  apiStatus.hidden = message.length === 0;
}

function totalForCategory(categoryId: number): number {
  const cents = expenses
    .filter((expense) => expense.categoriaId === categoryId)
    .reduce((sum, expense) => sum + Math.round(expense.valor * 100), 0);
  return cents / 100;
}

function createCategoryTotals(): void {
  const fragment = document.createDocumentFragment();

  categories.forEach((category, index) => {
    const item = document.createElement('li');
    item.className = 'category-item';

    const label = document.createElement('span');
    label.className = 'category-label';

    const dot = document.createElement('span');
    dot.className = `category-dot category-dot-${index}`;
    dot.setAttribute('aria-hidden', 'true');

    const name = document.createElement('span');
    name.textContent = category.nome;

    const amount = document.createElement('span');
    amount.className = 'category-amount';
    amount.dataset.categoryTotal = String(category.id);
    amount.textContent = currencyFormatter.format(0);

    label.append(dot, name);
    const summary = document.createElement('div');
    summary.className = 'category-summary-line';
    summary.append(label, amount);

    const budgetDetails = document.createElement('div');
    budgetDetails.className = 'budget-details';
    budgetDetails.dataset.budgetContainer = String(category.id);
    budgetDetails.hidden = true;

    item.append(summary, budgetDetails);
    fragment.append(item);
  });

  categoryTotals.replaceChildren(fragment);
  categoryCount.textContent = String(categories.length).padStart(2, '0');
}

function populateCategorySelect(): void {
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecione';
  const fragment = document.createDocumentFragment();
  fragment.append(placeholder);

  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = String(category.id);
    option.textContent = category.nome;
    fragment.append(option);
  });

  categorySelect.replaceChildren(fragment);
}

function createEmptyState(): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'empty-state';

  const title = document.createElement('strong');
  title.textContent = hasPeriodFilter()
    ? 'Nenhuma despesa neste período'
    : 'Nenhuma despesa por aqui';

  const description = document.createElement('span');
  description.textContent = hasPeriodFilter()
    ? periodMode.value === 'range'
      ? `Não há despesas entre ${periodStartInput.value} e ${periodEndInput.value}.`
      : 'Não há despesas registradas no mês selecionado.'
    : 'Adicione seu primeiro lançamento usando o formulário acima.';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'empty-action';
  addButton.dataset.emptyAction = 'add';
  addButton.textContent = 'Adicionar despesa';

  const previousButton = document.createElement('button');
  previousButton.type = 'button';
  previousButton.className = 'empty-action empty-action-secondary';
  previousButton.dataset.emptyAction = 'previous';
  previousButton.textContent = 'Ver mês anterior';

  const actions = document.createElement('div');
  actions.className = 'empty-actions';
  actions.append(addButton, previousButton);
  item.append(title, description, actions);
  return item;
}

function updateExpensePeriodSummary(): void {
  const range = selectedRange();
  const [year, month] = range.start.split('-').map(Number);
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
  expensePeriodLabel.textContent =
    periodMode.value === 'month'
      ? monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
      : `${formatDate(range.start)} a ${formatDate(range.end)}`;
}

function createExpenseItem(expense: Despesa): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'expense-item';

  const details = document.createElement('div');
  details.className = 'expense-details';

  const marker = document.createElement('span');
  marker.className = 'expense-marker';
  marker.setAttribute('aria-hidden', 'true');

  const text = document.createElement('div');
  text.className = 'expense-text';

  const title = document.createElement('strong');
  title.className = 'expense-name';
  title.textContent = expense.titulo;

  const category = document.createElement('span');
  category.className = 'expense-category';
  category.textContent = `${expense.categoria} · ${formatDate(expense.data)}`;

  const amount = document.createElement('span');
  amount.className = 'expense-value';
  amount.textContent = currencyFormatter.format(expense.valor);

  const actions = document.createElement('div');
  actions.className = 'expense-actions';

  const editButton = document.createElement('button');
  editButton.className = 'expense-action';
  editButton.type = 'button';
  editButton.dataset.action = 'edit';
  editButton.dataset.expenseId = expense.id;
  editButton.setAttribute('aria-label', `Editar ${expense.titulo}`);
  editButton.textContent = 'Editar';

  const deleteButton = document.createElement('button');
  deleteButton.className = 'expense-action expense-action-delete';
  deleteButton.type = 'button';
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.expenseId = expense.id;
  deleteButton.setAttribute('aria-label', `Excluir ${expense.titulo}`);
  deleteButton.textContent = 'Excluir';

  actions.append(editButton, deleteButton);
  text.append(title, category);
  details.append(marker, text);
  item.append(details, amount, actions);
  return item;
}

function createEmptyIncomeState(): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'empty-state';

  const title = document.createElement('strong');
  title.textContent = hasPeriodFilter()
    ? 'Nenhuma receita neste período'
    : 'Nenhuma receita por aqui';

  const description = document.createElement('span');
  description.textContent = hasPeriodFilter()
    ? periodMode.value === 'range'
      ? `Não há receitas entre ${periodStartInput.value} e ${periodEndInput.value}.`
      : 'Não há receitas registradas no mês selecionado.'
    : 'Adicione sua primeira receita usando o formulário acima.';

  item.append(title, description);
  return item;
}

function createIncomeItem(income: Receita): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'expense-item';

  const details = document.createElement('div');
  details.className = 'expense-details';

  const marker = document.createElement('span');
  marker.className = 'expense-marker income-marker';
  marker.setAttribute('aria-hidden', 'true');

  const text = document.createElement('div');
  text.className = 'expense-text';

  const title = document.createElement('strong');
  title.className = 'expense-name';
  title.textContent = income.titulo;

  const date = document.createElement('span');
  date.className = 'expense-category';
  date.textContent = formatDate(income.data);

  const amount = document.createElement('span');
  amount.className = 'expense-value income-value';
  amount.textContent = currencyFormatter.format(income.valor);

  const actions = document.createElement('div');
  actions.className = 'expense-actions';

  const editButton = document.createElement('button');
  editButton.className = 'expense-action';
  editButton.type = 'button';
  editButton.dataset.incomeAction = 'edit';
  editButton.dataset.incomeId = income.id;
  editButton.setAttribute('aria-label', `Editar receita ${income.titulo}`);
  editButton.textContent = 'Editar';

  const deleteButton = document.createElement('button');
  deleteButton.className = 'expense-action expense-action-delete';
  deleteButton.type = 'button';
  deleteButton.dataset.incomeAction = 'delete';
  deleteButton.dataset.incomeId = income.id;
  deleteButton.setAttribute('aria-label', `Excluir receita ${income.titulo}`);
  deleteButton.textContent = 'Excluir';

  actions.append(editButton, deleteButton);
  text.append(title, date);
  details.append(marker, text);
  item.append(details, amount, actions);
  return item;
}

function renderIncomeList(): void {
  incomeCount.textContent = `${incomes.length} ${
    incomes.length === 1 ? 'item' : 'itens'
  }`;

  if (incomes.length === 0) {
    incomeList.replaceChildren(createEmptyIncomeState());
    return;
  }

  const fragment = document.createDocumentFragment();
  incomes.forEach((income) => fragment.append(createIncomeItem(income)));
  incomeList.replaceChildren(fragment);
}

function renderBudgets(): void {
  categories.forEach((category) => {
    const container = categoryTotals.querySelector<HTMLDivElement>(
      `[data-budget-container="${category.id}"]`,
    );
    if (!container) {
      return;
    }

    if (!selectedMonth()) {
      container.hidden = true;
      container.replaceChildren();
      return;
    }

    container.hidden = false;
    const budget = budgets.find((item) => item.categoriaId === category.id);
    const spent = totalForCategory(category.id);
    const fragment = document.createDocumentFragment();
    const controls = document.createElement('div');
    controls.className = 'budget-actions';

    if (editingBudgetCategoryId === category.id) {
      const label = document.createElement('label');
      label.htmlFor = `budget-input-${category.id}`;
      label.className = 'budget-message';
      label.textContent = `Limite mensal de ${category.nome}`;

      const input = document.createElement('input');
      input.className = 'budget-input';
      input.id = `budget-input-${category.id}`;
      input.type = 'number';
      input.min = '0.01';
      input.max = '99999999.99';
      input.step = '0.01';
      input.inputMode = 'decimal';
      input.value = budget ? String(budget.limite) : '';

      const saveButton = document.createElement('button');
      saveButton.className = 'budget-action';
      saveButton.type = 'button';
      saveButton.dataset.budgetAction = 'save';
      saveButton.dataset.categoryId = String(category.id);
      saveButton.textContent = 'Salvar';

      const cancelButton = document.createElement('button');
      cancelButton.className = 'budget-action';
      cancelButton.type = 'button';
      cancelButton.dataset.budgetAction = 'cancel';
      cancelButton.dataset.categoryId = String(category.id);
      cancelButton.textContent = 'Cancelar';

      controls.append(saveButton, cancelButton);
      fragment.append(label, input, controls);
      container.replaceChildren(fragment);
      return;
    }

    if (!budget) {
      const notice = document.createElement('span');
      notice.className = 'budget-message';
      notice.textContent = 'Sem limite definido';
      fragment.append(notice);

      const setButton = document.createElement('button');
      setButton.className = 'budget-action';
      setButton.type = 'button';
      setButton.dataset.budgetAction = 'edit';
      setButton.dataset.categoryId = String(category.id);
      setButton.textContent = 'Definir limite';
      controls.append(setButton);
    } else {
      const percentage = (spent / budget.limite) * 100;
      const summary = document.createElement('span');
      summary.className = 'budget-message';
      summary.textContent = `${currencyFormatter.format(spent)} de ${currencyFormatter.format(budget.limite)}`;

      const progress = document.createElement('progress');
      progress.className =
        spent > budget.limite
          ? 'budget-progress budget-progress-over'
          : 'budget-progress';
      progress.max = 100;
      progress.value = Math.min(percentage, 100);
      progress.setAttribute(
        'aria-label',
        `Gasto de ${currencyFormatter.format(spent)} sobre orçamento de ${currencyFormatter.format(budget.limite)} para ${category.nome}`,
      );

      const status = document.createElement('span');
      status.className =
        spent > budget.limite ? 'budget-message budget-warning' : 'budget-message';
      status.textContent =
        spent > budget.limite
          ? `Limite excedido em ${currencyFormatter.format(spent - budget.limite)}`
          : `${Math.round(percentage)}% do limite utilizado`;

      const editButton = document.createElement('button');
      editButton.className = 'budget-action';
      editButton.type = 'button';
      editButton.dataset.budgetAction = 'edit';
      editButton.dataset.categoryId = String(category.id);
      editButton.textContent = 'Editar';

      const removeButton = document.createElement('button');
      removeButton.className = 'budget-action budget-action-delete';
      removeButton.type = 'button';
      removeButton.dataset.budgetAction = 'delete';
      removeButton.dataset.categoryId = String(category.id);
      removeButton.textContent = 'Remover';

      fragment.append(summary, progress, status);
      controls.append(editButton, removeButton);
    }

    fragment.append(controls);
    container.replaceChildren(fragment);
  });
}

function render(): void {
  const totalCents = expenses.reduce(
    (sum, expense) => sum + Math.round(expense.valor * 100),
    0,
  );
  totalAmount.textContent = currencyFormatter.format(totalCents / 100);
  const incomeCents = incomes.reduce(
    (sum, income) => sum + Math.round(income.valor * 100),
    0,
  );
  incomeTotalAmount.textContent = currencyFormatter.format(incomeCents / 100);
  const balanceCents = incomeCents - totalCents;
  balanceAmount.textContent = currencyFormatter.format(balanceCents / 100);
  balanceAmount.classList.toggle('balance-negative', balanceCents < 0);
  balanceCaption.textContent =
    balanceCents < 0
      ? 'As despesas superam as receitas neste período.'
      : 'Receitas menos despesas do período';

  categories.forEach((category) => {
    const amount = categoryTotals.querySelector<HTMLElement>(
      `[data-category-total="${category.id}"]`,
    );

    if (amount) {
      amount.textContent = currencyFormatter.format(totalForCategory(category.id));
    }
  });
  renderBudgets();

  expenseCount.textContent = expenses.length === 0
    ? 'Nenhuma despesa'
    : `${expenses.length} ${expenses.length === 1 ? 'despesa' : 'despesas'} · ${currencyFormatter.format(totalCents / 100)}`;
  updateExpensePeriodSummary();

  if (expenses.length === 0) {
    expenseList.replaceChildren(createEmptyState());
  } else {
    const fragment = document.createDocumentFragment();
    expenses.forEach((expense) => fragment.append(createExpenseItem(expense)));
    expenseList.replaceChildren(fragment);
  }

  renderIncomeList();
}

function destroyMonthlyChart(): void {
  monthlyChart?.destroy();
  monthlyChart = null;
}

function monthlyLabel(month: string): string {
  const [year, monthNumber] = month.split('-');
  const monthNames = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  return `${monthNames[Number(monthNumber) - 1]}/${year.slice(-2)}`;
}

function renderMonthlyTable(summary: ResumoMensal[]): void {
  const rows = summary.map((item) => {
    const row = document.createElement('tr');
    const month = document.createElement('th');
    month.scope = 'row';
    month.textContent = monthlyLabel(item.mes);

    const income = document.createElement('td');
    income.textContent = currencyFormatter.format(item.receitas);
    const expense = document.createElement('td');
    expense.textContent = currencyFormatter.format(item.despesas);
    const balance = document.createElement('td');
    balance.textContent = currencyFormatter.format(item.saldo);

    row.append(month, income, expense, balance);
    return row;
  });
  chartTableBody.replaceChildren(...rows);
}

function renderMonthlyChart(summary: ResumoMensal[]): void {
  destroyMonthlyChart();
  chartCanvasContainer.hidden = false;
  const labels = summary.map((item) => monthlyLabel(item.mes));

  monthlyChart = new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Receitas',
          data: summary.map((item) => item.receitas),
          backgroundColor: '#24866b',
          borderColor: '#176650',
          borderWidth: 1,
          borderRadius: 3,
        },
        {
          type: 'bar',
          label: 'Despesas',
          data: summary.map((item) => item.despesas),
          backgroundColor: '#e0a04b',
          borderColor: '#a96c1e',
          borderWidth: 1,
          borderRadius: 3,
        },
        {
          type: 'line',
          label: 'Saldo',
          data: summary.map((item) => item.saldo),
          borderColor: '#4957a8',
          backgroundColor: '#4957a8',
          borderDash: [6, 3],
          pointStyle: 'rectRot',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { usePointStyle: true, boxWidth: 10, padding: 18 },
        },
        tooltip: {
          callbacks: {
            label: (context) =>
              `${context.dataset.label}: ${currencyFormatter.format(
                Number(context.raw),
              )}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            autoSkip: true,
            maxTicksLimit: window.innerWidth <= 520 ? 6 : 12,
            maxRotation: 0,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => currencyFormatter.format(Number(value)),
          },
        },
      },
    },
  });
}

function showChartsLoading(): void {
  chartStatus.textContent = 'Carregando resumo mensal...';
  chartStatus.hidden = false;
  chartStatus.className = 'chart-status chart-status-loading';
  chartCanvasContainer.hidden = true;
  chartTablePanel.hidden = true;
  chartEmptyState.hidden = true;
  destroyMonthlyChart();
}

async function loadMonthlyChart(): Promise<void> {
  if (!chartsTabActive) {
    return;
  }

  const months = Number(chartMonthCount.value);
  const today = localToday();
  const endMonth = today.slice(0, 7);
  const key = `${endMonth}:${months}`;
  if (monthlySummary && monthlySummaryKey === key) {
    chartStatus.hidden = true;
    chartEmptyState.hidden = true;
    chartTablePanel.hidden = false;
    renderMonthlyTable(monthlySummary);
    if (
      monthlySummary.some((item) => item.receitas !== 0 || item.despesas !== 0)
    ) {
      renderMonthlyChart(monthlySummary);
    } else {
      chartCanvasContainer.hidden = true;
      destroyMonthlyChart();
      chartEmptyState.hidden = false;
    }
    return;
  }

  const sequence = ++chartLoadSequence;
  showChartsLoading();

  try {
    const query = new URLSearchParams({
      ate: endMonth,
      meses: String(months),
    });
    const result = await requestApi<unknown>(
      `/resumo/mensal?${query.toString()}`,
    );
    if (
      !Array.isArray(result) ||
      !result.every(isMonthlySummary) ||
      result.length !== months
    ) {
      throw new Error('A API retornou um resumo mensal em formato inválido.');
    }

    if (sequence !== chartLoadSequence || !chartsTabActive) {
      return;
    }

    monthlySummary = result;
    monthlySummaryKey = key;
    chartStatus.hidden = true;
    renderMonthlyTable(result);
    chartTablePanel.hidden = false;

    if (result.some((item) => item.receitas !== 0 || item.despesas !== 0)) {
      chartEmptyState.hidden = true;
      renderMonthlyChart(result);
    } else {
      chartCanvasContainer.hidden = true;
      chartEmptyState.hidden = false;
      destroyMonthlyChart();
    }
  } catch (error) {
    if (sequence !== chartLoadSequence) {
      return;
    }
    chartStatus.textContent =
      error instanceof Error
        ? `Não foi possível carregar os gráficos: ${error.message}`
        : 'Não foi possível carregar os gráficos. Tente novamente.';
    chartStatus.hidden = false;
    chartStatus.className = 'chart-status chart-status-error';
    chartCanvasContainer.hidden = true;
    chartTablePanel.hidden = true;
    chartEmptyState.hidden = true;
    destroyMonthlyChart();
  }
}

function showDashboardTab(): void {
  chartsTabActive = false;
  chartLoadSequence += 1;
  destroyMonthlyChart();
  dashboardView.hidden = false;
  chartsView.hidden = true;
  dashboardTab.classList.add('is-active');
  chartsTab.classList.remove('is-active');
  dashboardTab.setAttribute('aria-selected', 'true');
  chartsTab.setAttribute('aria-selected', 'false');
  dashboardTab.removeAttribute('tabindex');
  chartsTab.tabIndex = -1;
}

function showChartsTab(): void {
  chartsTabActive = true;
  dashboardView.hidden = true;
  chartsView.hidden = false;
  dashboardTab.classList.remove('is-active');
  chartsTab.classList.add('is-active');
  dashboardTab.setAttribute('aria-selected', 'false');
  chartsTab.setAttribute('aria-selected', 'true');
  dashboardTab.tabIndex = -1;
  chartsTab.removeAttribute('tabindex');
  void loadMonthlyChart();
}

function showError(message: string): void {
  formError.textContent = message;
  formError.hidden = false;
}

function clearError(): void {
  formError.textContent = '';
  formError.hidden = true;
}

function showIncomeError(message: string): void {
  incomeFormError.textContent = message;
  incomeFormError.hidden = false;
}

function clearIncomeError(): void {
  incomeFormError.textContent = '';
  incomeFormError.hidden = true;
}

function setAuthError(message: string): void {
  authError.textContent = message;
  authError.hidden = false;
}

function clearAuthError(): void {
  authError.textContent = '';
  authError.hidden = true;
}

function setAuthMode(mode: 'login' | 'register' | 'reset'): void {
  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  loginForm.hidden = !isLogin;
  registerForm.hidden = !isRegister;
  resetRequestForm.hidden = mode !== 'reset';
  forgotPasswordButton.hidden = !isLogin;
  authTitle.textContent = isLogin ? 'Acesse sua conta' : isRegister ? 'Crie sua conta' : 'Redefina sua senha';
  authSwitchLabel.textContent = isLogin
    ? 'Ainda não tem uma conta?'
    : 'Voltar para o login?';
  authSwitchButton.textContent = isLogin ? 'Criar conta' : 'Entrar';
  clearAuthError();
}

function showLogin(): void {
  chartsTabActive = false;
  chartLoadSequence += 1;
  destroyMonthlyChart();
  appShell.hidden = true;
  authView.hidden = false;
  setAuthMode('login');
}

function showPanel(user: Usuario): void {
  if (!isUser(user)) {
    setAuthError('A API retornou os dados da conta em formato inválido.');
    return;
  }

  authView.hidden = true;
  appShell.hidden = false;
  showDashboardTab();
  userName.textContent = user.nome;
  clearAuthError();
  void loadData();
}

authSwitchButton.addEventListener('click', () => {
  setAuthMode(
    resetRequestForm.hidden ? 'register' : 'login',
  );
});

forgotPasswordButton.addEventListener('click', () => {
  setAuthMode('reset');
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAuthError();
  const formData = new FormData(loginForm);
  const email = String(formData.get('email') || '');
  const senha = String(formData.get('senha') || '');
  const button = getElement<HTMLButtonElement>('#login-submit');
  button.disabled = true;

  try {
    const user = await requestApi<unknown>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });

    if (!isUser(user)) {
      throw new Error('A API retornou os dados da conta em formato inválido.');
    }

    loginForm.reset();
    showPanel(user);
  } catch (error) {
    if (error instanceof ApiResponseError && error.status === 404) {
      const registerEmail = getElement<HTMLInputElement>('#register-email');
      registerEmail.value = email;
      setAuthMode('register');
    }
    setAuthError(
      error instanceof Error
        ? error.message
        : 'Não foi possível entrar. Tente novamente.',
    );
  } finally {
    button.disabled = false;
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAuthError();
  const formData = new FormData(registerForm);
  const nome = String(formData.get('nome') || '');
  const email = String(formData.get('email') || '');
  const senha = String(formData.get('senha') || '');
  if (isPredictableNumericSequence(senha)) {
    setAuthError(predictablePasswordMessage);
    return;
  }
  const button = getElement<HTMLButtonElement>('#register-submit');
  button.disabled = true;

  try {
    const user = await requestApi<unknown>('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha }),
    });

    if (!isUser(user)) {
      throw new Error('A API retornou os dados da conta em formato inválido.');
    }
    registerForm.reset();
    showPanel(user);
  } catch (error) {
    setAuthError(
      error instanceof Error
        ? error.message
        : 'Não foi possível criar a conta. Tente novamente.',
    );
  } finally {
    button.disabled = false;
  }
});

resetRequestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAuthError();
  const formData = new FormData(resetRequestForm);
  const email = String(formData.get('email') || '');
  const senha = String(formData.get('senha') || '');
  const button = getElement<HTMLButtonElement>('#reset-request-submit');
  button.disabled = true;
  try {
    const result = await requestApi<{ mensagem: string }>('/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    resetRequestForm.reset();
    setAuthMode('login');
    setAuthError(result.mensagem);
  } catch (error) {
    setAuthError(error instanceof Error ? error.message : 'Não foi possível redefinir a senha. Tente novamente.');
  } finally {
    button.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    await requestApi<{ status: string }>('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    showLogin();
  } catch (error) {
    setApiStatus(
      error instanceof Error
        ? `Não foi possível sair da conta: ${error.message}`
        : 'Não foi possível sair da conta. Tente novamente.',
      'error',
    );
  } finally {
    logoutButton.disabled = false;
  }
});

logoutAllButton.addEventListener('click', async () => {
  logoutAllButton.disabled = true;
  try {
    await requestApi<{ status: string }>('/auth/logout-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    showLogin();
  } catch (error) {
    setApiStatus(
      error instanceof Error
        ? `Não foi possível sair dos dispositivos: ${error.message}`
        : 'Não foi possível sair dos dispositivos.',
      'error',
    );
  } finally {
    logoutAllButton.disabled = false;
  }
});

exportAccountButton.addEventListener('click', async () => {
  exportAccountButton.disabled = true;
  try {
    const data = await requestApi<unknown>('/auth/me/export');
    const printWindow = window.open('', '_blank');
    if (!printWindow) throw new Error('Permita a abertura de novas abas para imprimir seus dados.');
    const title = printWindow.document.createElement('h1');
    title.textContent = 'Exportação dos meus dados';
    const content = printWindow.document.createElement('pre');
    content.textContent = JSON.stringify(data, null, 2);
    printWindow.document.body.append(title, content);
    printWindow.document.title = 'Meus dados';
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    setApiStatus(
      error instanceof Error ? `Não foi possível exportar: ${error.message}` : 'Não foi possível exportar os dados.',
      'error',
    );
  } finally {
    exportAccountButton.disabled = false;
  }
});

deleteAccountButton.addEventListener('click', async () => {
  const senha = window.prompt('Digite sua senha para excluir permanentemente a conta.');
  if (senha === null) return;
  deleteAccountButton.disabled = true;
  try {
    await requestApi<{ status: string }>('/auth/me', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha }),
    });
    showLogin();
  } catch (error) {
    setApiStatus(
      error instanceof Error ? `Não foi possível excluir a conta: ${error.message}` : 'Não foi possível excluir a conta.',
      'error',
    );
  } finally {
    deleteAccountButton.disabled = false;
  }
});

categoryTotals.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const action = target.dataset.budgetAction;
  const categoryId = Number(target.dataset.categoryId);
  const category = categories.find((item) => item.id === categoryId);

  if (!category || !action) {
    return;
  }

  const existing = budgets.find((item) => item.categoriaId === categoryId);

  if (action === 'edit') {
    editingBudgetCategoryId = categoryId;
    renderBudgets();
    categoryTotals
      .querySelector<HTMLInputElement>(`#budget-input-${categoryId}`)
      ?.focus();
    return;
  }

  if (action === 'cancel') {
    editingBudgetCategoryId = null;
    renderBudgets();
    return;
  }

  if (action === 'save') {
    const limitInput = categoryTotals.querySelector<HTMLInputElement>(
      `#budget-input-${categoryId}`,
    );
    const limite = limitInput?.valueAsNumber;
    if (
      typeof limite !== 'number' ||
      !Number.isFinite(limite) ||
      limite <= 0 ||
      limite > 99999999.99 ||
      Number(limite.toFixed(2)) !== limite
    ) {
      setApiStatus('Informe um limite positivo com até duas casas decimais.', 'error');
      limitInput?.focus();
      return;
    }

    target.disabled = true;
    setApiStatus('Salvando orçamento...', 'loading');
    try {
      const saved = await requestApi<unknown>(
        `/orcamentos/${categoryId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limite }),
        },
      );

      if (!isBudget(saved) || saved.categoriaId !== categoryId) {
        throw new Error('A API retornou um orçamento em formato inválido.');
      }

      budgets = [
        ...budgets.filter((item) => item.categoriaId !== categoryId),
        saved,
      ];
      editingBudgetCategoryId = null;
      renderBudgets();
      setApiStatus('', 'success');
    } catch (error) {
      target.disabled = false;
      setApiStatus(
        error instanceof Error
          ? `Não foi possível salvar o orçamento: ${error.message}`
          : 'Não foi possível salvar o orçamento. Tente novamente.',
        'error',
      );
    }
    return;
  }

  if (action !== 'delete' || !existing) {
    return;
  }

  if (!window.confirm(`Deseja remover o limite de ${category.nome}?`)) {
    return;
  }

  target.disabled = true;
  setApiStatus('Removendo orçamento...', 'loading');
  try {
    await requestApi<unknown>(`/orcamentos/${categoryId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    budgets = budgets.filter((item) => item.categoriaId !== categoryId);
    renderBudgets();
    setApiStatus('', 'success');
  } catch (error) {
    target.disabled = false;
    setApiStatus(
      error instanceof Error
        ? `Não foi possível remover o orçamento: ${error.message}`
        : 'Não foi possível remover o orçamento. Tente novamente.',
      'error',
    );
  }
});

function setAddButtonLabel(button: HTMLButtonElement, label: string): void {
  button.replaceChildren();
  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '+';
  button.append(icon, document.createTextNode(label));
}

function stopEditing(): void {
  editingExpenseId = null;
  expenseForm.reset();
  setDateValue(dateInput, localToday());
  formTitle.textContent = 'Adicionar despesa';
  formDescription.textContent = 'Preencha os dados do novo lançamento.';
  setAddButtonLabel(submitButton, 'Adicionar despesa');
  cancelEditButton.hidden = true;
  clearError();
}

function startEditing(expense: Despesa): void {
  editingExpenseId = expense.id;
  titleInput.value = expense.titulo;
  amountInput.value = String(expense.valor);
  setDateValue(dateInput, expense.data);
  categorySelect.value = String(expense.categoriaId);
  formTitle.textContent = 'Editar despesa';
  formDescription.textContent = 'Altere os dados do lançamento selecionado.';
  submitButton.textContent = 'Salvar alterações';
  cancelEditButton.hidden = false;
  clearError();
  expenseForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  titleInput.focus();
}

function stopEditingIncome(): void {
  editingIncomeId = null;
  incomeForm.reset();
  setDateValue(incomeDateInput, localToday());
  incomeFormTitle.textContent = 'Adicionar receita';
  incomeFormDescription.textContent = 'Preencha os dados da nova receita.';
  setAddButtonLabel(incomeSubmitButton, 'Adicionar receita');
  cancelIncomeEditButton.hidden = true;
  clearIncomeError();
}

function startEditingIncome(income: Receita): void {
  editingIncomeId = income.id;
  incomeTitleInput.value = income.titulo;
  incomeAmountInput.value = String(income.valor);
  setDateValue(incomeDateInput, income.data);
  incomeFormTitle.textContent = 'Editar receita';
  incomeFormDescription.textContent = 'Altere os dados da receita selecionada.';
  incomeSubmitButton.textContent = 'Salvar alterações';
  cancelIncomeEditButton.hidden = false;
  clearIncomeError();
  incomeForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  incomeTitleInput.focus();
}

cancelEditButton.addEventListener('click', stopEditing);
cancelIncomeEditButton.addEventListener('click', stopEditingIncome);

const currentMonth = localToday().slice(0, 7);
yearInput.value = currentMonth.slice(0, 4);
monthSelect.value = currentMonth.slice(5, 7);
setDateValue(periodStartInput, `${localToday().slice(0, 7)}-01`);
setDateValue(periodEndInput, localToday());
updatePeriodControls();
setDateValue(incomeDateInput, localToday());
periodMode.addEventListener('change', () => {
  updatePeriodControls();
  reloadForPeriodChange();
});

dashboardTab.addEventListener('click', showDashboardTab);
chartsTab.addEventListener('click', showChartsTab);
chartMonthCount.addEventListener('change', () => {
  if (chartsTabActive) {
    void loadMonthlyChart();
  }
});

for (const input of [
  monthSelect,
  yearInput,
  periodStartInput,
  periodEndInput,
]) {
  input.addEventListener('change', () => {
    reloadForPeriodChange();
  });
}

periodPreviousButton.addEventListener('click', () => shiftSelectedMonth(-1));
periodNextButton.addEventListener('click', () => shiftSelectedMonth(1));
document.querySelectorAll<HTMLButtonElement>('[data-period-shortcut]').forEach((button) => {
  button.addEventListener('click', () => {
    const today = new Date();
    const shortcut = button.dataset.periodShortcut;
    if (shortcut === 'custom') {
      periodMode.value = 'range';
    } else if (shortcut === 'current' || shortcut === 'previous') {
      periodMode.value = 'month';
      const monthOffset = shortcut === 'previous' ? -1 : 0;
      const date = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
      yearInput.value = String(date.getFullYear());
      monthSelect.value = String(date.getMonth() + 1).padStart(2, '0');
    } else {
      periodMode.value = 'range';
      const start = new Date(today);
      if (shortcut === '30days') start.setDate(start.getDate() - 29);
      else start.setMonth(0, 1);
      setDateValue(periodStartInput, `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`);
      setDateValue(periodEndInput, localToday());
    }
    updatePeriodControls();
    reloadForPeriodChange();
  });
});

expenseList.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const action = target.dataset.emptyAction;
  if (action === 'add') {
    titleInput.focus();
  } else if (action === 'previous' && periodMode.value === 'month') {
    const previous = new Date(Number(yearInput.value), Number(monthSelect.value) - 2, 1);
    yearInput.value = String(previous.getFullYear());
    monthSelect.value = String(previous.getMonth() + 1).padStart(2, '0');
    reloadForPeriodChange();
  }
});

expenseList.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const id = target.dataset.expenseId;
  const action = target.dataset.action;
  const expense = expenses.find((item) => item.id === id);

  if (!id || !expense) {
    return;
  }

  if (action === 'edit') {
    startEditing(expense);
    return;
  }

  if (action !== 'delete' || !window.confirm(`Deseja excluir "${expense.titulo}"?`)) {
    return;
  }

  target.disabled = true;
  setApiStatus('Excluindo lançamento...', 'loading');

  try {
    await requestApi<{ id: string }>(`/despesas/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (editingExpenseId === id) {
      stopEditing();
    }
    await loadData();
  } catch (error) {
    target.disabled = false;
    setApiStatus(
      error instanceof Error
        ? `Não foi possível excluir o lançamento: ${error.message}`
        : 'Não foi possível excluir o lançamento. Tente novamente.',
      'error',
    );
  }
});

incomeList.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const id = target.dataset.incomeId;
  const action = target.dataset.incomeAction;
  const income = incomes.find((item) => item.id === id);
  if (!id || !income) {
    return;
  }

  if (action === 'edit') {
    startEditingIncome(income);
    return;
  }

  if (action !== 'delete' || !window.confirm(`Deseja excluir a receita "${income.titulo}"?`)) {
    return;
  }

  target.disabled = true;
  setApiStatus('Excluindo receita...', 'loading');
  try {
    await requestApi<{ id: string }>(`/receitas/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (editingIncomeId === id) {
      stopEditingIncome();
    }
    await loadData();
  } catch (error) {
    target.disabled = false;
    setApiStatus(
      error instanceof Error
        ? `Não foi possível excluir a receita: ${error.message}`
        : 'Não foi possível excluir a receita. Tente novamente.',
      'error',
    );
  }
});

incomeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearIncomeError();

  const titulo = incomeTitleInput.value.trim();
  const valor = incomeAmountInput.valueAsNumber;
  const data = getDateValue(incomeDateInput);

  if (!titulo || titulo.length > 120) {
    showIncomeError('Informe um título de até 120 caracteres.');
    incomeTitleInput.focus();
    return;
  }

  if (!isValidAmount(valor)) {
    showIncomeError('Informe um valor numérico maior que zero.');
    incomeAmountInput.focus();
    return;
  }

  if (!isValidDate(data)) {
    showIncomeError('Informe uma data válida para a receita.');
    incomeDateInput.focus();
    return;
  }

  const incomeId = editingIncomeId;
  incomeSubmitButton.disabled = true;
  cancelIncomeEditButton.disabled = true;
  incomeSubmitButton.textContent = 'Salvando...';
  setApiStatus(
    incomeId ? 'Salvando alterações da receita...' : 'Salvando receita...',
    'loading',
  );

  try {
    const result = await requestApi<unknown>(
      incomeId ? `/receitas/${encodeURIComponent(incomeId)}` : '/receitas',
      {
        method: incomeId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, valor, data }),
      },
    );

    if (!isIncome(result)) {
      throw new Error('A API retornou uma receita em formato inválido.');
    }

    if (incomeId) {
      stopEditingIncome();
    } else {
      incomeForm.reset();
      setDateValue(incomeDateInput, localToday());
    }
    clearIncomeError();
    await loadData();
    incomeTitleInput.focus();
  } catch (error) {
    setApiStatus(
      error instanceof Error
        ? `Não foi possível ${incomeId ? 'atualizar' : 'salvar'} a receita: ${error.message}`
        : `Não foi possível ${incomeId ? 'atualizar' : 'salvar'} a receita. Tente novamente.`,
      'error',
    );
  } finally {
    incomeSubmitButton.disabled = false;
    cancelIncomeEditButton.disabled = false;
    if (editingIncomeId) {
      incomeSubmitButton.textContent = 'Salvar alterações';
    } else {
      setAddButtonLabel(incomeSubmitButton, 'Adicionar receita');
    }
  }
});

expenseForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  const titulo = titleInput.value.trim();
  const valor = amountInput.valueAsNumber;
  const data = getDateValue(dateInput);
  const categoriaId = Number(categorySelect.value);

  if (!titulo) {
    showError('Informe um título para a despesa.');
    titleInput.focus();
    return;
  }

  if (titulo.length > 120) {
    showError('O título deve ter no máximo 120 caracteres.');
    titleInput.focus();
    return;
  }

  if (!isValidAmount(valor)) {
    showError('Informe um valor numérico maior que zero.');
    amountInput.focus();
    return;
  }

  if (!categories.some((category) => category.id === categoriaId)) {
    showError('Selecione uma categoria válida.');
    categorySelect.focus();
    return;
  }

  if (!isValidDate(data)) {
    showError('Informe uma data válida para a despesa.');
    dateInput.focus();
    return;
  }

  submitButton.disabled = true;
  const expenseId = editingExpenseId;
  cancelEditButton.disabled = true;
  submitButton.textContent = 'Salvando...';
  setApiStatus(
    expenseId ? 'Salvando alterações...' : 'Salvando despesa...',
    'loading',
  );

  try {
    const expense = await requestApi<unknown>(
      expenseId ? `/despesas/${encodeURIComponent(expenseId)}` : '/despesas',
      {
        method: expenseId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, valor, data, categoriaId }),
      },
    );

    if (!isExpense(expense)) {
      throw new Error('A API retornou uma despesa em formato inválido.');
    }

    if (expenseId) {
      stopEditing();
    } else {
      expenseForm.reset();
      setDateValue(dateInput, localToday());
    }
    clearError();
    await loadData();
    titleInput.focus();
  } catch (error) {
    setApiStatus(
      error instanceof Error
        ? `Não foi possível ${expenseId ? 'atualizar' : 'salvar'} a despesa: ${error.message}`
        : `Não foi possível ${expenseId ? 'atualizar' : 'salvar'} a despesa. Tente novamente.`,
      'error',
    );
  } finally {
    submitButton.disabled = false;
    cancelEditButton.disabled = false;
    if (editingExpenseId) {
      submitButton.textContent = 'Salvar alterações';
    } else {
      setAddButtonLabel(submitButton, 'Adicionar despesa');
    }
  }
});

setDateValue(dateInput, localToday());
setDateValue(incomeDateInput, localToday());

async function loadData(): Promise<void> {
  const sequence = ++loadSequence;
  dataAbortController?.abort();
  dataAbortController = new AbortController();
  const { signal } = dataAbortController;
  submitButton.disabled = true;
  incomeSubmitButton.disabled = true;
  setApiStatus('Carregando lançamentos...', 'loading');
  expenseList.replaceChildren();
  incomeList.replaceChildren();

  try {
    const categoryResult = await requestApi<unknown>('/categorias', { signal });
    if (!Array.isArray(categoryResult) || !categoryResult.every(isCategory)) {
      throw new Error('A API retornou uma lista de categorias em formato inválido.');
    }
    categories = categoryResult;
    populateCategorySelect();
    createCategoryTotals();

    const budgetResult = await requestApi<unknown>('/orcamentos', { signal });
    if (!Array.isArray(budgetResult) || !budgetResult.every(isBudget)) {
      throw new Error('A API retornou uma lista de orçamentos em formato inválido.');
    }
    budgets = budgetResult;

    const period = selectedPeriodQuery();
    const query = period ? `?${period.toString()}` : '';
    const path = `/despesas${query}`;
    const result = await requestApi<unknown>(path, { signal });

    if (!Array.isArray(result) || !result.every(isExpense)) {
      throw new Error('A API retornou uma lista de despesas em formato inválido.');
    }

    const incomePath = `/receitas${query}`;
    const incomeResult = await requestApi<unknown>(incomePath, { signal });

    if (!Array.isArray(incomeResult) || !incomeResult.every(isIncome)) {
      throw new Error('A API retornou uma lista de receitas em formato inválido.');
    }

    if (sequence !== loadSequence) {
      return;
    }

    expenses = result;
    incomes = incomeResult;
    render();
    setApiStatus('', 'success');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    if (sequence === loadSequence) {
      setApiStatus(
        error instanceof Error
          ? `Não foi possível carregar os lançamentos: ${error.message}`
          : 'Não foi possível carregar os lançamentos. Tente novamente.',
        'error',
      );
    }
  } finally {
    if (sequence === loadSequence) {
      submitButton.disabled = false;
      incomeSubmitButton.disabled = false;
    }
  }
}

async function loadCurrentUser(): Promise<void> {
  try {
    const user = await requestApi<unknown>('/auth/me');
    if (!isUser(user)) {
      throw new Error('A API retornou os dados da sessão em formato inválido.');
    }
    showPanel(user);
  } catch (error) {
    if (error instanceof ApiResponseError && error.status === 401) {
      showLogin();
      return;
    }

    showLogin();
    setAuthError(
      error instanceof Error
        ? `Não foi possível verificar a sessão: ${error.message}`
        : 'Não foi possível verificar a sessão. Tente novamente.',
    );
  }
}

void loadCurrentUser();
