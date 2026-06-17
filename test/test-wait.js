const assert = require('assert');

describe('wait command', () => {
  let library;

  before(() => {
    library = new (require('../dist/index.js'))();
  });

  it('should complete successfully with 0ms wait', async () => {
    const result = await library.process({ _: ['wait'], time: 0 });
    assert.equal(result, true);
  });

  it('should accept time as second positional arg', async () => {
    const result = await library.process({ _: ['wait', '100'] });
    assert.equal(result, true);
  });

  it('should complete with a short wait', async function () {
    this.timeout(5000);
    const start = Date.now();
    const result = await library.process({ _: ['wait'], time: 200 });
    const elapsed = Date.now() - start;

    assert.equal(result, true);
    assert.ok(elapsed >= 150, `Should have waited at least 150ms, but only waited ${elapsed}ms`);
  });
});
