import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatIsoToPtBr,
  localToday,
  parsePtBrDateStrict,
  validateRange,
} from '../../src/date-utils';

test('interpreta datas brasileiras estritamente', () => {
  assert.equal(parsePtBrDateStrict('29/02/2028'), '2028-02-29');
  assert.equal(parsePtBrDateStrict('29/02/2026'), null);
  assert.equal(parsePtBrDateStrict('31/04/2026'), null);
  assert.equal(parsePtBrDateStrict('00/01/2026'), null);
  assert.equal(parsePtBrDateStrict('1/1/26'), null);
  assert.equal(parsePtBrDateStrict('texto aleatório'), null);
  assert.equal(parsePtBrDateStrict('01/01/1999'), null);
  assert.equal(parsePtBrDateStrict('01/01/2101'), null);
});

test('faz ida e volta entre ISO e pt-BR', () => {
  const iso = '2026-10-25';
  assert.equal(parsePtBrDateStrict(formatIsoToPtBr(iso)), iso);
});

test('usa o fuso local para obter o dia atual', () => {
  const lateMonth = new Date(2026, 9, 31, 23, 30);
  assert.equal(localToday(lateMonth), '2026-10-31');
});

test('valida limites inclusivos do intervalo', () => {
  assert.equal(validateRange({ start: '2026-01-01', end: '2027-01-01' }), null);
  assert.equal(validateRange({ start: '2026-01-01', end: '2027-01-02' }), 'O período máximo é de 366 dias.');
});
