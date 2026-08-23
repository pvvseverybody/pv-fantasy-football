import test from 'node:test';
import assert from 'node:assert/strict';
import {withGameWriterGate} from '../lib/workbook-writer-gate.mjs';

test('game writer gate serializes writes for the same game', async () => {
  const events = [];
  let releaseFirst;
  const firstHold = new Promise(resolve => { releaseFirst = resolve; });
  let firstStarted;
  const firstReady = new Promise(resolve => { firstStarted = resolve; });

  const first = withGameWriterGate('2026-W0', async () => {
    events.push('first:start');
    firstStarted();
    await firstHold;
    events.push('first:end');
  });

  await firstReady;

  const second = withGameWriterGate('2026-W0', async () => {
    events.push('second:start');
    events.push('second:end');
  });

  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, ['first:start']);

  releaseFirst();
  await Promise.all([first, second]);

  assert.deepEqual(events, [
    'first:start',
    'first:end',
    'second:start',
    'second:end',
  ]);
});

test('game writer gate allows different games to proceed independently', async () => {
  let releaseFirst;
  const firstHold = new Promise(resolve => { releaseFirst = resolve; });
  let firstStarted;
  const firstReady = new Promise(resolve => { firstStarted = resolve; });
  let secondStarted = false;

  const first = withGameWriterGate('2026-W0', async () => {
    firstStarted();
    await firstHold;
  });

  await firstReady;

  const second = withGameWriterGate('2026-W1', async () => {
    secondStarted = true;
  });

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(secondStarted, true);

  releaseFirst();
  await Promise.all([first, second]);
});