const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const BIN = path.join(__dirname, '..', 'bin', 'node-power-user');

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`);
  return result.stdout.trim();
}

describe('commands/sync (commit and push, end-to-end via bin)', function () {
  this.timeout(60000);

  let root;
  let clone;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'npu-sync-'));
    const remote = path.join(root, 'remote.git');
    clone = path.join(root, 'clone');

    git(root, ['init', '--bare', '-q', remote]);
    git(root, ['clone', '-q', remote, clone]);
    git(clone, ['config', 'user.name', 'npu test']);
    git(clone, ['config', 'user.email', 'npu@test.invalid']);
    fs.writeFileSync(path.join(clone, 'a.txt'), 'one\n');
    git(clone, ['add', '.']);
    git(clone, ['commit', '-q', '-m', 'init']);
    git(clone, ['push', '-q', '-u', 'origin', 'HEAD']);
    fs.writeFileSync(path.join(clone, 'a.txt'), 'two\n');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should commit a message holding shell characters exactly as typed, then push it', () => {
    const message = 'say "hi" to $HOME & %PATH% `id`';
    const result = spawnSync(process.execPath, [BIN, 'sync', '--message', message], {
      cwd: clone,
      encoding: 'utf8',
      timeout: 60000,
    });

    assert.strictEqual(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.strictEqual(git(clone, ['log', '-1', '--format=%B']), message);
    assert.strictEqual(git(clone, ['rev-parse', 'HEAD']), git(clone, ['rev-parse', '@{u}']));
  });
});
