const assert = require('assert');
const path = require('path');
const jetpack = require('fs-jetpack');

describe('CLI routing', () => {
  // Re-implement resolveCommand from cli.js so we can unit test it
  // without requiring the full CLI module (which captures cwd at load time)
  const ALIASES = {
    bump: ['-b', '--bump'],
    clean: ['-c', '--clean'],
    global: ['-g', '--global'],
    audit: ['--audit'],
    install: ['-i', '--install', 'i'],
    open: ['--open', 'repo', '--repo'],
    outdated: ['-o', 'out', '--outdated', '-u', '--update', 'up', 'update'],
    packages: ['-p', 'pack', '--packages'],
    version: ['-v', '--version'],
    sync: ['-s', '--sync', 'push', '--push'],
  };

  function resolveCommand(options) {
    if (options._.length > 0) {
      const command = options._[0];
      for (const [key, aliases] of Object.entries(ALIASES)) {
        if (command === key || aliases.includes(command)) {
          return key;
        }
      }
      return command;
    }
    for (const [key, aliases] of Object.entries(ALIASES)) {
      for (const alias of aliases) {
        if (options[alias.replace(/^-+/, '')]) {
          return key;
        }
      }
    }
    return 'version';
  }

  describe('positional command resolution', () => {
    it('should resolve "outdated" to outdated', () => {
      assert.equal(resolveCommand({ _: ['outdated'] }), 'outdated');
    });

    it('should resolve "out" alias to outdated', () => {
      assert.equal(resolveCommand({ _: ['out'] }), 'outdated');
    });

    it('should resolve "up" alias to outdated', () => {
      assert.equal(resolveCommand({ _: ['up'] }), 'outdated');
    });

    it('should resolve "update" alias to outdated', () => {
      assert.equal(resolveCommand({ _: ['update'] }), 'outdated');
    });

    it('should resolve "bump" to bump', () => {
      assert.equal(resolveCommand({ _: ['bump'] }), 'bump');
    });

    it('should resolve "clean" to clean', () => {
      assert.equal(resolveCommand({ _: ['clean'] }), 'clean');
    });

    it('should resolve "i" alias to install', () => {
      assert.equal(resolveCommand({ _: ['i'] }), 'install');
    });

    it('should resolve "install" to install', () => {
      assert.equal(resolveCommand({ _: ['install'] }), 'install');
    });

    it('should resolve "repo" alias to open', () => {
      assert.equal(resolveCommand({ _: ['repo'] }), 'open');
    });

    it('should resolve "pack" alias to packages', () => {
      assert.equal(resolveCommand({ _: ['pack'] }), 'packages');
    });

    it('should resolve "push" alias to sync', () => {
      assert.equal(resolveCommand({ _: ['push'] }), 'sync');
    });

    it('should resolve "npx" to npx', () => {
      assert.equal(resolveCommand({ _: ['npx'] }), 'npx');
    });

    it('should pass through unknown commands', () => {
      assert.equal(resolveCommand({ _: ['unknown-command'] }), 'unknown-command');
    });
  });

  describe('flag-based command resolution', () => {
    it('should resolve -v flag to version', () => {
      assert.equal(resolveCommand({ _: [], v: true }), 'version');
    });

    it('should resolve -o flag to outdated', () => {
      assert.equal(resolveCommand({ _: [], o: true }), 'outdated');
    });

    it('should resolve -b flag to bump', () => {
      assert.equal(resolveCommand({ _: [], b: true }), 'bump');
    });

    it('should resolve -c flag to clean', () => {
      assert.equal(resolveCommand({ _: [], c: true }), 'clean');
    });

    it('should resolve -g flag to global', () => {
      assert.equal(resolveCommand({ _: [], g: true }), 'global');
    });

    it('should resolve -i flag to install', () => {
      assert.equal(resolveCommand({ _: [], i: true }), 'install');
    });

    it('should resolve -p flag to packages', () => {
      assert.equal(resolveCommand({ _: [], p: true }), 'packages');
    });

    it('should resolve -s flag to sync', () => {
      assert.equal(resolveCommand({ _: [], s: true }), 'sync');
    });

    it('should resolve -u flag to outdated', () => {
      assert.equal(resolveCommand({ _: [], u: true }), 'outdated');
    });
  });

  describe('default command', () => {
    it('should default to version when no args or flags', () => {
      assert.equal(resolveCommand({ _: [] }), 'version');
    });
  });

  describe('command files exist', () => {
    const commandDir = path.join(__dirname, '..', 'dist', 'commands');

    for (const command of Object.keys(ALIASES)) {
      it(`should have a file for "${command}" command`, () => {
        const filePath = path.join(commandDir, `${command}.js`);
        assert.ok(jetpack.exists(filePath), `Missing command file: ${filePath}`);
      });
    }
  });
});
