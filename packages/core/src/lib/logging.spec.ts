import * as chalk from 'chalk';
import * as os from 'node:os';
import { vi } from 'vitest';
import { isDebug, logger } from './logging';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ci = require('ci-info');

describe('Logging', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => true);
    vi.spyOn(console, 'error').mockImplementation(() => true);
    vi.spyOn(console, 'info').mockImplementation(() => true);
    vi.spyOn(console, 'log').mockImplementation(() => true);
    vi.spyOn(console, 'warn').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('debug should call console debug method', () => {
    logger.debug('this is a debug message');
    expect(console.debug).toHaveBeenCalledWith('this is a debug message');
  });

  it('error should call console error method', () => {
    logger.error('this is a error message');
    expect(console.error).toHaveBeenNthCalledWith(1, chalk.bold(chalk.red('this is a error message')));

    const error = new Error('this is a error message');
    logger.error(error);
    expect(console.error).toHaveBeenNthCalledWith(2, chalk.bold(chalk.red(error.stack)));
  });

  it('fatal should call console error method', () => {
    logger.fatal('this is a fatal message');
    expect(console.error).toHaveBeenNthCalledWith(1, 'this is a fatal message');
  });

  it('info should call console info method', () => {
    logger.info('this is a info message');
    expect(console.info).toHaveBeenCalledWith('this is a info message');
  });

  it('log should call console log method', () => {
    logger.log('this is a log message');
    expect(console.log).toHaveBeenCalledWith('this is a log message');
  });

  it('warn should call console warn method', () => {
    logger.warn('this is a warning message');
    expect(console.warn).toHaveBeenCalledWith(chalk.bold(chalk.yellow('this is a warning message')));
  });

  describe('startGroup', () => {
    it('should use github action syntaxt in Github Actions', () => {
      vi.spyOn(ci, 'GITHUB_ACTIONS', 'get').mockReturnValue(true);

      logger.startGroup('this is a group message');
      expect(console.info).toHaveBeenCalledWith(`::group::this is a group message${os.EOL}`);
    });

    it('should use fallback systaxt', () => {
      vi.spyOn(ci, 'GITHUB_ACTIONS', 'get').mockReturnValue(false);

      logger.startGroup('this is a group message');
      expect(console.info).toHaveBeenCalledWith(
        `\n${chalk.cyan('>')} ${chalk.inverse(chalk.bold(chalk.cyan(` this is a group message `)))}\n`
      );
    });
  });

  describe('endGroup', () => {
    it('should use github action syntaxt in Github Actions', () => {
      vi.spyOn(ci, 'GITHUB_ACTIONS', 'get').mockReturnValue(true);

      logger.endGroup('this is a group message');
      expect(console.info).toHaveBeenCalledWith(`::endgroup::${os.EOL}`);
    });

    it('should use fallback systaxt', () => {
      vi.spyOn(ci, 'GITHUB_ACTIONS', 'get').mockReturnValue(false);

      logger.endGroup('this is a group message');
      expect(console.info).not.toHaveBeenCalled();
    });
  });

  describe('group wraps an async call in a group', () => {
    it('Github Actions', async () => {
      vi.spyOn(ci, 'GITHUB_ACTIONS', 'get').mockReturnValue(true);

      const result = await logger.group('mygroup', async () => {
        console.info('in my group\n');
        return true;
      });

      expect(result).toBe(true);
      assertWriteCalls([`::group::mygroup${os.EOL}`, 'in my group\n', `::endgroup::${os.EOL}`]);
    });
  });

  describe('isDebug', () => {
    it('shoudl return true if RUNNER_DEBUG=1', async () => {
      vi.stubEnv('RUNNER_DEBUG', '1');

      expect(process.env['RUNNER_DEBUG']).toBe('1');
      expect(isDebug()).toBeTruthy();
    });

    it('shoudl return true if RUNNER_DEBUG=true', async () => {
      vi.stubEnv('RUNNER_DEBUG', 'true');

      expect(process.env['RUNNER_DEBUG']).toBe('true');
      expect(isDebug()).toBeTruthy();
    });

    it('shoudl return true if RUNNER_DEBUG=0', async () => {
      vi.stubEnv('RUNNER_DEBUG', '0');

      expect(process.env['RUNNER_DEBUG']).toBe('0');
      expect(isDebug()).toBeFalsy();
    });

    it('shoudl return true if RUNNER_DEBUG=false', async () => {
      vi.stubEnv('RUNNER_DEBUG', 'false');

      expect(process.env['RUNNER_DEBUG']).toBe('false');
      expect(isDebug()).toBeFalsy();
    });

    it('shoudl return true if RUNNER_DEBUG is not defined', async () => {
      expect(process.env['RUNNER_DEBUG']).toBeUndefined();
      expect(isDebug()).toBeFalsy();
    });
  });
});

function assertWriteCalls(calls: string[]): void {
  expect(console.info).toHaveBeenCalledTimes(calls.length);

  for (let i = 0; i < calls.length; i++) {
    expect(console.info).toHaveBeenNthCalledWith(i + 1, calls[i]);
  }
}
