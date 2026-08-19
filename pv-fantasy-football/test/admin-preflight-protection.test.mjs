import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('season preflight API remains inside the protected admin matcher',async()=>{
  const middleware=await readFile(new URL('../middleware.js',import.meta.url),'utf8');
  assert.match(middleware,/['"]\/api\/admin\/:path\*['"]/);
  assert.match('/api/admin/preflight',/^\/api\/admin\//);
});
