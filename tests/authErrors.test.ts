import test from 'node:test';
import assert from 'node:assert/strict';
import { checkNewPassword, translateAuthError } from '../lib/authErrors';

test('correo sin confirmar se detecta y se traduce', () => {
  const r = translateAuthError({ message: 'Email not confirmed' });
  assert.ok(r.unconfirmed);
  assert.match(r.text, /confirmaste tu correo/);
});

test('credenciales, límite de pedidos y link vencido', () => {
  assert.match(translateAuthError({ message: 'Invalid login credentials' }).text, /incorrectos/);
  assert.match(translateAuthError({ message: 'email rate limit exceeded' }).text, /Esperá/);
  assert.match(translateAuthError({ message: 'Auth session missing!' }).text, /venció/);
  assert.ok(!translateAuthError({ message: 'Invalid login credentials' }).unconfirmed);
});

test('mensaje desconocido se devuelve tal cual', () => {
  assert.equal(translateAuthError({ message: 'algo raro' }).text, 'algo raro');
  assert.equal(translateAuthError(undefined).text, 'Error de autenticación');
});

test('contraseña nueva: largo y coincidencia', () => {
  assert.ok(checkNewPassword('abc', 'abc'));
  assert.ok(checkNewPassword('abcdef', 'abcdeg'));
  assert.equal(checkNewPassword('abcdef', 'abcdef'), null);
});
