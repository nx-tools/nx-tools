import { vi } from 'vitest';
import { loadPackage } from './load-package';

describe('loadPackage', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when package is available', () => {
    it('should import package', async () => {
      const module = await loadPackage('@nx/js', 'ctx');

      expect(module).toEqual(await import('@nx/js'));
    });

    it('should require package', async () => {
      const module = await loadPackage('@nx/js', 'ctx', () => require('@nx/js'));

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      expect(module).toEqual(require('@nx/js'));
    });

    it('should call process.exit if package not exists', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(vi.fn() as never);
      await loadPackage('not-existent-package', 'ctx');
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
