const assert = require('assert');

describe('lib/npx-args (raw argv parsing for npu npx)', () => {
  let npxArgs;

  before(() => {
    npxArgs = require('../dist/lib/npx-args');
  });

  describe('parseNpxArgs()', () => {
    it('should pass trailing flags through to the child command', () => {
      const result = npxArgs.parseNpxArgs(['npx', 'mgr', 'test', '--extended']);
      assert.deepStrictEqual(result.childArgs, ['mgr', 'test', '--extended']);
      assert.strictEqual(result.force, false);
    });

    it('should treat --force BEFORE the npx token as npu\'s own flag', () => {
      const result = npxArgs.parseNpxArgs(['--force', 'npx', 'mgr', 'test']);
      assert.deepStrictEqual(result.childArgs, ['mgr', 'test']);
      assert.strictEqual(result.force, true);
    });

    it('should leave trailing --force with the child (e.g. rimraf --force)', () => {
      const result = npxArgs.parseNpxArgs(['npx', 'rimraf', 'dist', '--force']);
      assert.deepStrictEqual(result.childArgs, ['rimraf', 'dist', '--force']);
      assert.strictEqual(result.force, false);
    });

    it('should ignore other npu-owned prefix flags like --cwd', () => {
      const result = npxArgs.parseNpxArgs(['--cwd', '/tmp/x', 'npx', 'foo']);
      assert.deepStrictEqual(result.childArgs, ['foo']);
      assert.strictEqual(result.force, false);
    });

    it('should support the --npx flag alias as the command token', () => {
      const result = npxArgs.parseNpxArgs(['--npx', 'mgr', 'test']);
      assert.deepStrictEqual(result.childArgs, ['mgr', 'test']);
    });

    it('should return empty childArgs when nothing follows npx', () => {
      const result = npxArgs.parseNpxArgs(['npx']);
      assert.deepStrictEqual(result.childArgs, []);
    });

    it('should return empty childArgs when no npx token exists', () => {
      const result = npxArgs.parseNpxArgs(['install', 'lodash']);
      assert.deepStrictEqual(result.childArgs, []);
    });
  });

  describe('parsePassthroughArgs()', () => {
    it('should support custom token sets (install aliases)', () => {
      const tokens = ['install', 'i', '--install', '-i'];
      assert.deepStrictEqual(
        npxArgs.parsePassthroughArgs(['i', 'lodash', '--legacy-peer-deps'], tokens),
        { childArgs: ['lodash', '--legacy-peer-deps'], force: false }
      );
      assert.deepStrictEqual(
        npxArgs.parsePassthroughArgs(['--force', 'install', 'lodash', '-D'], tokens),
        { childArgs: ['lodash', '-D'], force: true }
      );
      assert.deepStrictEqual(
        npxArgs.parsePassthroughArgs(['-i', 'lodash'], tokens),
        { childArgs: ['lodash'], force: false }
      );
    });

    it('should support the npm passthrough token', () => {
      assert.deepStrictEqual(
        npxArgs.parsePassthroughArgs(['npm', 'create', 'vite', 'my-app'], ['npm']),
        { childArgs: ['create', 'vite', 'my-app'], force: false }
      );
    });
  });

  describe('forcesDownload()', () => {
    it('should flag --package= (npx downloads that package regardless of local bins)', () => {
      assert.strictEqual(npxArgs.forcesDownload(['--package=vite', 'vite']), true);
    });

    it('should flag --package and -p', () => {
      assert.strictEqual(npxArgs.forcesDownload(['--package', 'vite', 'vite']), true);
      assert.strictEqual(npxArgs.forcesDownload(['-p', 'vite', 'vite']), true);
    });

    it('should not flag ordinary commands', () => {
      assert.strictEqual(npxArgs.forcesDownload(['mgr', 'test', '--extended']), false);
    });
  });

  describe('firstPositional()', () => {
    it('should return the first non-flag token (the binary name)', () => {
      assert.strictEqual(npxArgs.firstPositional(['mgr', 'test']), 'mgr');
    });

    it('should skip leading flags', () => {
      assert.strictEqual(npxArgs.firstPositional(['--yes', 'create-vite', 'app']), 'create-vite');
    });

    it('should return null when there are no positionals', () => {
      assert.strictEqual(npxArgs.firstPositional(['--help']), null);
    });
  });

  describe('buildCommand()', () => {
    it('should leave simple args unquoted', () => {
      assert.strictEqual(npxArgs.buildCommand(['mgr', 'test']), 'npx mgr test');
    });

    it('should quote args containing spaces or shell metacharacters', () => {
      assert.strictEqual(
        npxArgs.buildCommand(['node', '-e', 'console.log(1 + 1)']),
        `npx node -e 'console.log(1 + 1)'`
      );
    });

    it('should escape embedded single quotes', () => {
      assert.strictEqual(
        npxArgs.buildCommand(['echo', `it's`]),
        `npx echo 'it'\\''s'`
      );
    });
  });
});
