import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeAdmin, parseBasicAuthorization} from '../lib/admin-auth.mjs';

const basic = (username, password) => `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

test('admin authentication fails closed when configuration is absent', () => {
  assert.deepEqual(authorizeAdmin(basic('ops', 'secret'), {}), {authorized: false, configured: false});
});

test('admin authentication accepts only the exact server-side credentials', () => {
  const environment = {PV_ADMIN_USERNAME: 'ops', PV_ADMIN_PASSWORD: 'long-secret'};
  assert.equal(authorizeAdmin(basic('ops', 'long-secret'), environment).authorized, true);
  assert.equal(authorizeAdmin(basic('ops', 'wrong'), environment).authorized, false);
  assert.equal(authorizeAdmin(basic('other', 'long-secret'), environment).authorized, false);
});

test('malformed basic authorization is rejected', () => {
  assert.equal(parseBasicAuthorization('Bearer token'), null);
  assert.equal(parseBasicAuthorization('Basic !!!'), null);
});
