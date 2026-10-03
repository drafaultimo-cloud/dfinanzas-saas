import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCategories, isCoreCategory, validateNewCategory } from '../lib/categories';

test('valida rubros nuevos', () => {
  assert.deepEqual(validateNewCategory('  gastos  por tdf ', ['Otros']), { name: 'Gastos por tdf', existed: false });
  assert.ok('error' in validateNewCategory('a', []));
  assert.ok('error' in validateNewCategory('Por Clasificar', []));
  assert.ok('error' in validateNewCategory('cambio de moneda', []));
});

test('no duplica un rubro existente aunque cambien las mayúsculas', () => {
  assert.deepEqual(validateNewCategory('supermercado', ['Supermercado']), { name: 'Supermercado', existed: true });
});

test('arma la lista: base, propios y usados, con Otros al final', () => {
  const list = buildCategories(['Gastos por TDF'], [{ type: 'expense', category: 'Mascotas' }, { type: 'income', category: 'Ingreso' }]);
  assert.ok(list.includes('Gastos por TDF'));
  assert.ok(list.includes('Mascotas'));
  assert.ok(!list.includes('Ingreso'));
  assert.equal(list[list.length - 1], 'Otros');
  assert.equal(new Set(list.map(c => c.toLowerCase())).size, list.length);
});

test('los rubros que usa la app no se pueden renombrar', () => {
  assert.equal(isCoreCategory('Tarjeta de Crédito'), true);
  assert.equal(isCoreCategory('Mascotas'), false);
});
