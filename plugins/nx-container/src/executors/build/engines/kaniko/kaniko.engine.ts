import { asyncForEach, exec, logger } from '@nx-tools/core';
import { ExecutorContext } from '@nx/devkit';
import * as handlebars from 'handlebars';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Inputs } from '../../context';
import { EngineAdapter } from '../engine-adapter';
import * as kaniko from './kaniko';

export class Kaniko extends EngineAdapter {
  originalDirs: string[] = [];

  getCommand(args: string[]): { command: string; args: string[] } {
    return {
      command: '/kaniko/executor',
      args,
    };
  }

  async initialize(inputs: Inputs, _ctx?: ExecutorContext): Promise<void> {
    if (!(await kaniko.isAvailable())) {
      throw new Error(
        `Kaniko is required. See https://github.com/gperdomor/nx-tools to set up nx-container executor with kaniko.`
      );
    }

    if (!inputs.quiet) {
      await logger.group(`Kaniko info`, async () => {
        const cmd = kaniko.getCommand(['version']);
        await exec(cmd.command, cmd.args, {
          failOnStdErr: false,
        });
      });
    }

    this.originalDirs = await readdir('/kaniko');
  }

  async finalize(_inputs: Inputs, _ctx?: ExecutorContext): Promise<void> {
    const dir = await readdir('/kaniko');
    const toDelete = dir.filter((file) => !this.originalDirs.includes(file));

    await asyncForEach(toDelete, async (fileOrDir) => {
      await rm(join('/kaniko', fileOrDir), { force: true, recursive: true });
    });
  }

  async getImageID(): Promise<string | undefined> {
    return kaniko.getImageID();
  }

  async getMetadata(): Promise<string | undefined> {
    return kaniko.getMetadata();
  }

  async getDigest(metadata: string): Promise<string | undefined> {
    return kaniko.getDigest(metadata);
  }

  async getArgs(inputs: Inputs, defaultContext: string): Promise<string[]> {
    const context = handlebars.compile(inputs.context)({ defaultContext });
    // prettier-ignore
    return [
        ...await this.getBuildArgs(inputs/*, defaultContex, context, this.getBuildxVersion()*/),
        ...await this.getCommonArgs(inputs/*, this.getBuildxVersion()*/),
        `--context=${context}`
      ];
  }

  private async getBuildArgs(
    inputs: Inputs
    /*defaultContext: string,
    context: string,
    buildxVersion: string*/
  ): Promise<Array<string>> {
    const args: Array<string> = [];
    await asyncForEach(inputs.buildArgs, async (buildArg) => {
      args.push('--build-arg', buildArg);
    });
    await asyncForEach(inputs.cacheFrom, async (cacheFrom) => {
      args.push('--cache-repo', cacheFrom);
    });
    if (inputs.file) {
      args.push('--dockerfile', inputs.file);
    }
    await asyncForEach(inputs.labels, async (label) => {
      args.push('--label', label);
    });
    if (inputs.platforms.length > 0) {
      args.push('--customPlatform', inputs.platforms.join(','));
    }
    await asyncForEach(inputs.tags, async (tag) => {
      inputs.registries && inputs.registries.length > 0
        ? inputs.registries.forEach((registry) => args.push('--destination', `${registry}/${tag}`))
        : args.push('--destination', tag);
    });
    if (inputs.target) {
      args.push('--target', inputs.target);
    }
    return args;
  }

  private async getCommonArgs(inputs: Inputs /*, buildxVersion: string*/): Promise<Array<string>> {
    const args: Array<string> = [];
    if (!inputs.noCache) {
      args.push('--cache=true');
    }
    if (!inputs.push) {
      args.push('--no-push');
    }
    args.push('--use-new-run');
    return args;
  }
}
