import fs from 'fs';
import os from 'os';
import path from 'path';

describe('storage JSON', () => {
  const cwdOrig = process.cwd();
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hlbot-test-'));
    process.chdir(tmpDir);
  });

  afterAll(() => {
    process.chdir(cwdOrig);
  });

  test('loadState initializes file and saveState persists', () => {
    // import after chdir to ensure correct DATA_DIR resolution
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const storage = require('../src/storage') as typeof import('../src/storage');
    const s1 = storage.loadState();
    expect(Array.isArray(s1.addresses)).toBe(true);
    const filePath = path.join(tmpDir, 'data', 'tracked.json');
    expect(fs.existsSync(filePath)).toBe(true);

    s1.addresses.push('0x123');
    storage.saveState(s1);
    const s2 = storage.loadState();
    expect(s2.addresses).toContain('0x123');
  });
});

