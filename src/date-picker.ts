import {
  formatIsoToPtBr,
  localToday,
  parsePtBrDateStrict,
  toIso,
} from './date-utils';

type DatePickerOptions = {
  optional?: boolean;
  getMin?: () => string | null;
  getMax?: () => string | null;
  onChange?: () => void;
};

const weekdays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const monthNameFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long' });

function button(label: string, className: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  return element;
}

function isoFromDate(date: Date): string {
  return toIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function getDateValue(input: HTMLInputElement): string {
  return input.dataset.iso ?? '';
}

export function setDateValue(input: HTMLInputElement, iso: string): void {
  input.dataset.iso = iso;
  input.value = formatIsoToPtBr(iso);
}

export class DatePicker {
  private readonly input: HTMLInputElement;
  private readonly options: DatePickerOptions;
  private readonly wrapper: HTMLElement;
  private readonly popup: HTMLElement;
  private readonly title: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly monthSelect: HTMLSelectElement;
  private readonly yearSelect: HTMLSelectElement;
  private readonly error: HTMLElement;
  private viewYear = new Date().getFullYear();
  private viewMonth = new Date().getMonth();
  private lastFocused: HTMLElement;

  constructor(input: HTMLInputElement, options: DatePickerOptions = {}) {
    this.input = input;
    this.options = options;
    this.wrapper = input.closest<HTMLElement>('[data-date-picker-wrapper]') ?? input.parentElement!;
    this.input.type = 'text';
    this.input.inputMode = 'numeric';
    this.input.placeholder = 'dd/mm/aaaa';
    this.input.autocomplete = 'off';
    this.input.setAttribute('aria-haspopup', 'dialog');
    this.input.setAttribute('aria-autocomplete', 'none');
    this.lastFocused = input;

    const buttonElement = this.wrapper.querySelector<HTMLButtonElement>('[data-date-picker-open]');
    buttonElement?.addEventListener('click', () => this.open());
    this.input.addEventListener('input', () => this.mask());
    this.input.addEventListener('blur', () => this.commitInput());
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === 'ArrowDown') {
        event.preventDefault();
        this.open();
      } else if (event.key === 'Escape') {
        this.close();
      }
    });

    this.error = document.createElement('span');
    this.error.className = 'date-picker-error';
    this.error.setAttribute('role', 'alert');
    this.wrapper.append(this.error);

    this.popup = document.createElement('div');
    this.popup.className = 'date-picker-popup';
    this.popup.setAttribute('role', 'dialog');
    this.popup.setAttribute('aria-label', 'Calendário em português');
    this.popup.hidden = true;
    this.popup.tabIndex = -1;

    const header = document.createElement('div');
    header.className = 'date-picker-header';
    const previous = button('‹', 'date-picker-nav');
    previous.setAttribute('aria-label', 'Mês anterior');
    previous.addEventListener('click', () => this.shiftMonth(-1));
    const next = button('›', 'date-picker-nav');
    next.setAttribute('aria-label', 'Próximo mês');
    next.addEventListener('click', () => this.shiftMonth(1));
    this.title = document.createElement('strong');
    this.title.className = 'date-picker-title';
    header.append(previous, this.title, next);

    const selectors = document.createElement('div');
    selectors.className = 'date-picker-selectors';
    this.monthSelect = document.createElement('select');
    this.monthSelect.setAttribute('aria-label', 'Selecionar mês');
    this.yearSelect = document.createElement('select');
    this.yearSelect.setAttribute('aria-label', 'Selecionar ano');
    for (let month = 0; month < 12; month += 1) {
      const option = document.createElement('option');
      option.value = String(month);
      option.textContent = monthNameFormatter.format(new Date(2020, month, 1));
      this.monthSelect.append(option);
    }
    for (let year = 2000; year <= 2100; year += 1) {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = String(year);
      this.yearSelect.append(option);
    }
    this.monthSelect.addEventListener('change', () => {
      this.viewMonth = Number(this.monthSelect.value);
      this.render();
    });
    this.yearSelect.addEventListener('change', () => {
      this.viewYear = Number(this.yearSelect.value);
      this.render();
    });
    selectors.append(this.monthSelect, this.yearSelect);

    this.grid = document.createElement('div');
    this.grid.className = 'date-picker-grid';
    this.grid.setAttribute('role', 'grid');
    this.grid.setAttribute('aria-label', 'Dias do mês');

    const footer = document.createElement('div');
    footer.className = 'date-picker-footer';
    const today = button('Hoje', 'date-picker-action');
    today.addEventListener('click', () => this.choose(localToday()));
    footer.append(today);
    if (options.optional) {
      const clear = button('Limpar', 'date-picker-action');
      clear.addEventListener('click', () => {
        this.input.value = '';
        delete this.input.dataset.iso;
        this.clearError();
        this.close();
        options.onChange?.();
      });
      footer.append(clear);
    }

    this.popup.append(header, selectors, this.grid, footer);
    this.wrapper.append(this.popup);
    this.commitInput();
  }

  open(): void {
    this.lastFocused = this.input;
    const value = getDateValue(this.input) || localToday();
    const [year, month] = value.split('-').map(Number);
    this.viewYear = year;
    this.viewMonth = month - 1;
    this.render();
    this.popup.hidden = false;
    this.popup.classList.toggle('date-picker-up', this.shouldOpenUp());
    this.input.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', this.handleOutside);
    const selected = this.grid.querySelector<HTMLButtonElement>('.date-picker-selected:not(:disabled)');
    (selected ?? this.grid.querySelector<HTMLButtonElement>('.date-picker-day:not(:disabled)'))?.focus();
  }

  close(): void {
    if (this.popup.hidden) return;
    this.popup.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', this.handleOutside);
    this.lastFocused.focus();
  }

  private readonly handleOutside = (event: PointerEvent): void => {
    if (!this.wrapper.contains(event.target as Node)) this.close();
  };

  private shouldOpenUp(): boolean {
    const rect = this.wrapper.getBoundingClientRect();
    return window.innerHeight - rect.bottom < 360 && rect.top > 360;
  }

  private mask(): void {
    const digits = this.input.value.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
    this.input.value = parts.join('/');
    delete this.input.dataset.iso;
    this.clearError();
  }

  private commitInput(): void {
    if (!this.input.value) {
      delete this.input.dataset.iso;
      this.clearError();
      return;
    }
    const iso = parsePtBrDateStrict(this.input.value);
    if (!iso) {
      this.showError();
      return;
    }
    setDateValue(this.input, iso);
    this.clearError();
  }

  private showError(): void {
    this.error.textContent = 'Data inválida. Use dd/mm/aaaa.';
    this.input.setAttribute('aria-invalid', 'true');
  }

  private clearError(): void {
    this.error.textContent = '';
    this.input.removeAttribute('aria-invalid');
  }

  private shiftMonth(amount: number): void {
    const date = new Date(this.viewYear, this.viewMonth + amount, 1);
    this.viewYear = date.getFullYear();
    this.viewMonth = date.getMonth();
    this.render();
  }

  private choose(iso: string): void {
    const min = this.options.getMin?.() ?? null;
    const max = this.options.getMax?.() ?? null;
    if ((min && iso < min) || (max && iso > max)) return;
    setDateValue(this.input, iso);
    this.clearError();
    this.options.onChange?.();
    this.close();
  }

  private render(): void {
    this.title.textContent = monthFormatter.format(new Date(this.viewYear, this.viewMonth, 1));
    this.monthSelect.value = String(this.viewMonth);
    this.yearSelect.value = String(this.viewYear);
    this.grid.replaceChildren();
    weekdays.forEach((weekday) => {
      const heading = document.createElement('span');
      heading.className = 'date-picker-weekday';
      heading.textContent = weekday;
      heading.setAttribute('role', 'columnheader');
      this.grid.append(heading);
    });

    const first = new Date(this.viewYear, this.viewMonth, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    const selected = getDateValue(this.input);
    const min = this.options.getMin?.() ?? null;
    const max = this.options.getMax?.() ?? null;
    for (let index = 0; index < 42; index += 1) {
      const dayOffset = index - startOffset + 1;
      const date = new Date(this.viewYear, this.viewMonth, dayOffset);
      const iso = isoFromDate(date);
      const day = button(String(date.getDate()), 'date-picker-day');
      day.setAttribute('role', 'gridcell');
      day.setAttribute('aria-label', formatIsoToPtBr(iso));
      day.setAttribute('tabindex', '-1');
      if (dayOffset < 1 || dayOffset > daysInMonth) day.classList.add('date-picker-other-month');
      if (iso === localToday()) day.classList.add('date-picker-today');
      if (iso === selected) {
        day.classList.add('date-picker-selected');
        day.setAttribute('aria-selected', 'true');
      }
      if ((min && iso < min) || (max && iso > max)) {
        day.disabled = true;
        day.classList.add('date-picker-disabled');
      }
      day.addEventListener('click', () => this.choose(iso));
      day.addEventListener('keydown', (event) => this.handleDayKey(event, iso));
      this.grid.append(day);
    }
  }

  private handleDayKey(event: KeyboardEvent, iso: string): void {
    const target = event.currentTarget as HTMLButtonElement;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.choose(iso);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      this.shiftMonth(event.key === 'PageUp' ? -1 : 1);
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const delta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -7 : 7;
      const buttons = Array.from(this.grid.querySelectorAll<HTMLButtonElement>('.date-picker-day'));
      const next = buttons[Math.max(0, buttons.indexOf(target) + delta)];
      next?.focus();
    }
  }
}

export function initializeDatePicker(
  input: HTMLInputElement,
  options: DatePickerOptions = {},
): DatePicker {
  return new DatePicker(input, options);
}
