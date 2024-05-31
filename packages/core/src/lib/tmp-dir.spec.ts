import * as fs from 'node:fs';
import { vi } from 'vitest';
import { _tmpDir, tmpDir } from './tmp-dir';

vi.mock('node:fs', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:fs')>();
  return {
    ...mod,
    mkdtempSync: vi.fn((args) => mod.mkdtempSync(args)),
  };
});

describe('tmpDir', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debug should call console debug method', () => {
    expect(_tmpDir).toBeUndefined();

    const a = tmpDir();

    expect(_tmpDir).toBeDefined();

    expect(_tmpDir).toEqual(a);

    const b = tmpDir();

    expect(_tmpDir).toEqual(b);
    expect(a).toEqual(b);

    expect(a).toContain('nx-tools-');

    expect(fs.mkdtempSync).toHaveBeenCalledTimes(1);
  });
});
