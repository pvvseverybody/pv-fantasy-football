const writerGates = new Map();

export async function withGameWriterGate(gameId, work) {
  const key = String(gameId || '').trim();
  const previous = writerGates.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  writerGates.set(key, current);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (writerGates.get(key) === current) writerGates.delete(key);
  }
}