import test from 'node:test';
import assert from 'node:assert/strict';
import { fxDirectionFromDescription, fxLabel, isCashWithdrawal, isFxDescription, needsFxFix, needsOwnTransferFix } from '../lib/fx';

test('reconoce la compra de moneda extranjera del BNA', () => {
  assert.equal(isFxDescription('DEB.CPRA.VTA.M.E.LINK'), true);
  assert.equal(isFxDescription('CRE.CPRA.VTA.M.E'), true);
  assert.equal(isFxDescription('Compra de dólares'), true);
  assert.equal(isFxDescription('Venta de moneda extranjera'), true);
});

test('no confunde compras comunes con cambio de moneda', () => {
  assert.equal(isFxDescription('[USD] GOOGLE YOUTUBE - cuota 01'), false);
  assert.equal(isFxDescription('Netflix USD'), false);
  assert.equal(isFxDescription('Pago con QR'), false);
  assert.equal(isFxDescription(''), false);
});

test('el código del banco define el sentido', () => {
  assert.equal(fxDirectionFromDescription('DEB.CPRA.VTA.M.E.LINK'), 'out');
  assert.equal(fxDirectionFromDescription('CRE.CPRA.VTA.M.E'), 'in');
  assert.equal(fxDirectionFromDescription('Pago con QR'), null);
});

test('etiqueta compra/venta según moneda y sentido', () => {
  assert.equal(fxLabel({ type: 'expense', currency: 'ARS' }), 'Compra de dólares');
  assert.equal(fxLabel({ type: 'income', currency: 'ARS' }), 'Venta de dólares');
  assert.equal(fxLabel({ type: 'income', currency: 'USD' }), 'Compra de dólares');
});

test('detecta movimientos guardados como gasto que son cambio de moneda', () => {
  assert.equal(needsFxFix({ operation_type: 'purchase', description: 'DEB.CPRA.VTA.M.E.LINK', category: 'Otros' }), true);
  assert.equal(needsFxFix({ operation_type: 'transfer', description: 'DEB.CPRA.VTA.M.E.LINK', category: 'Cambio de moneda' }), false);
});

test('retiro de efectivo no es un gasto', () => {
  assert.equal(isCashWithdrawal('Retiro de dinero La Anonima'), true);
  assert.equal(isCashWithdrawal('Retiro de dinero La Anónima'), true);
  assert.equal(isCashWithdrawal('Extracción en cajero automático'), true);
  assert.equal(isCashWithdrawal('MERPAGO*RETIRO'), false);
  assert.equal(isCashWithdrawal('Pago con QR'), false);
  assert.equal(needsOwnTransferFix({ type: 'expense', operation_type: 'purchase', category: 'Transferencia propia', description: 'x' }), true);
  assert.equal(needsOwnTransferFix({ type: 'expense', operation_type: 'transfer', category: 'Transferencia propia', description: 'x' }), false);
});
