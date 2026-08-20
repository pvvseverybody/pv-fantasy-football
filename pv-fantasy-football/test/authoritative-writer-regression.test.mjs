import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('authoritative writer can use the first row when Google omits trailing blank rows',async()=>{
  const source=await readFile(
    new URL('../lib/authoritative-lineups.js',import.meta.url),
    'utf8'
  );

  assert.match(source,/if \(index === -1\) return data\.length \+ 4;/);
  assert.doesNotMatch(
    source,
    /if \(index === -1\) throw new Error\('Authoritative sheet has no available row\.'\);/
  );
});

test('Google Sheets batch updates use the colon action endpoint',async()=>{
  const source=await readFile(
    new URL('../lib/google-sheets.js',import.meta.url),
    'utf8'
  );

  assert.match(
    source,
    /path\.startsWith\('\?'\) \|\| path\.startsWith\(':'\)/
  );
  assert.match(source,/sheetsRequest\(':batchUpdate'/);
  assert.doesNotMatch(source,/sheetsRequest\('batchUpdate'/);
});