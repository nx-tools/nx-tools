import * as core from '@nx-tools/core';
import { ExecutorContext, names } from '@nx/devkit';
import { parse } from 'csv-parse/sync';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as tmp from 'tmp';
import { BuildExecutorSchema } from './schema';

let _defaultContext: string, _tmpDir: string;

export interface Inputs {
  quiet: boolean;
  addHosts: string[];
  allow: string[];
  buildArgs: string[];
  buildContexts: string[];
  builder: string;
  cacheFrom: string[];
  cacheTo: string[];
  cgroupParent: string;
  context: string;
  file: string;
  githubToken: string;
  labels: string[];
  load: boolean;
  network: string;
  noCache: boolean;
  noCacheFilters: string[];
  outputs: string[];
  platforms: string[];
  provenance: string;
  pull: boolean;
  push: boolean;
  registries: string[];
  secretFiles: string[];
  secrets: string[];
  shmSize: string;
  ssh: string[];
  tags: string[];
  target: string;
  ulimit: string[];
}

export function defaultContext(): string {
  if (!_defaultContext) {
    _defaultContext = '.';
  }
  return _defaultContext;
}

export function tmpDir(): string {
  if (!_tmpDir) {
    _tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docker-build-push-')).split(path.sep).join(path.posix.sep);
  }
  return _tmpDir;
}

export function tmpNameSync(options?: tmp.TmpNameOptions): string {
  return tmp.tmpNameSync(options);
}

export async function getInputs(
  defaultContext: string,
  options: BuildExecutorSchema,
  ctx?: ExecutorContext
): Promise<Inputs> {
  const prefix = names(ctx?.projectName || '').constantName;

  return {
    quiet: core.getBooleanInput('quiet', { prefix, fallback: `${options.quiet || false}` }),
    addHosts: await getInputList('add-hosts', prefix, options['add-hosts']),
    allow: await getInputList('allow', prefix, options.allow),
    buildArgs: await getInputList('build-args', prefix, options['build-args'], true),
    buildContexts: await getInputList('build-contexts', prefix, options['build-contexts'], true),
    builder: core.getInput('builder', { prefix, fallback: options.builder }),
    cacheFrom: await getInputList('cache-from', prefix, [options['cache-from'] ?? []].flat(), true),
    cacheTo: await getInputList('cache-to', prefix, [options['cache-to'] ?? []].flat(), true),
    cgroupParent: core.getInput('cgroup-parent', { prefix, fallback: options['cgroup-parent'] }),
    context: core.getInput('context', { prefix, fallback: options.context || defaultContext }),
    file: core.getInput('file', { prefix, fallback: options.file }),
    githubToken: core.getInput('github-token'),
    labels: await getInputList('labels', prefix, options.labels, true),
    load: core.getBooleanInput('load', { fallback: `${options.load || false}` }),
    network: core.getInput('network', { prefix, fallback: options.network }),
    noCache: core.getBooleanInput('no-cache', { fallback: `${options['no-cache'] || false}` }),
    noCacheFilters: await getInputList('no-cache-filters', prefix, options['no-cache-filters']),
    outputs: await getInputList('outputs', prefix, options.outputs, true),
    platforms: await getInputList('platforms', prefix, options.platforms),
    provenance: core.getInput('provenance'),
    pull: core.getBooleanInput('pull', { fallback: `${options.pull || false}` }),
    push: core.getBooleanInput('push', { fallback: `${options.push || false}` }),
    registries: await getInputList('registries', prefix, options.registries, true),
    secretFiles: await getInputList('secret-files', prefix, options['secret-files'], true),
    secrets: await getInputList('secrets', prefix, options.secrets, true),
    shmSize: core.getInput('shm-size', { prefix, fallback: options['shm-size'] }),
    ssh: await getInputList('ssh', prefix, options.ssh),
    tags: await getInputList('tags', prefix, options.tags),
    target: core.getInput('target', { prefix, fallback: options.target }),
    ulimit: await getInputList('ulimit', prefix, options.ulimit, true),
  };
}

export async function getInputList(
  name: string,
  prefix: string,
  fallback?: string[],
  ignoreComma?: boolean
): Promise<string[]> {
  const res: Array<string> = [];

  const items = core.getInput(name, { prefix });
  if (items == '') {
    return fallback ?? res;
  }

  const records = await parse(items, {
    columns: false,
    relaxQuotes: true,
    relaxColumnCount: true,
    // skipLinesWithEmptyValues: true,
    skipEmptyLines: true,
  });

  for (const record of records as Array<string[]>) {
    if (record.length == 1) {
      res.push(record[0]);
      continue;
    } else if (!ignoreComma) {
      res.push(...record);
      continue;
    }
    res.push(record.join(','));
  }

  return res.filter((item) => item).map((pat) => pat.trim());
}

export function setOutput(name: string, value: string, ctx: ExecutorContext): void {
  if (ctx?.projectName) {
    const outputDir = `${ctx?.root}/node_modules/.cache/nx-container/${ctx.projectName}`;
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(`${outputDir}/${name}`, value);
  }
}
