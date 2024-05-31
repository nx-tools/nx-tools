import { logger as l } from '@nx/devkit';
import * as os from 'node:os';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const chalk = require('chalk');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ci = require('ci-info');

const escapeData = (s: any): string => {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
};

/**
 * Gets whether Debug is on or not
 */
export function isDebug(): boolean {
  return process.env['RUNNER_DEBUG'] === '1' || process.env['RUNNER_DEBUG'] === 'true';
}

/**
 * Begin an output group.
 *
 * Output until the next `groupEnd` will be foldable in this group
 *
 * @param name The name of the output group
 */
function startGroup(name: string): void {
  if (ci.GITHUB_ACTIONS) {
    return console.info(`::group::${escapeData(name)}${os.EOL}`);
  }

  console.info(`${os.EOL}${chalk.cyan('>')} ${chalk.inverse(chalk.bold(chalk.cyan(` ${name} `)))}${os.EOL}`);
}

/**
 * End an output group.
 */
function endGroup(name: string): void {
  if (ci.GITHUB_ACTIONS) {
    return l.info(`::endgroup::${os.EOL}`);
  }
}

/**
 * Wrap an asynchronous function call in a group.
 *
 * Returns the same type as the function itself.
 *
 * @param name The name of the group
 * @param fn The function to wrap in the group
 */
async function group<T>(name: string, fn: () => Promise<T>): Promise<T> {
  startGroup(name);

  let result: T;

  try {
    result = await fn();
  } finally {
    endGroup(name);
  }

  return result;
}

export const logger = { ...l, startGroup, endGroup, group };
