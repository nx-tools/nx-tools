import { asyncForEach, exec, getBooleanInput, getExecOutput, logger } from '@nx-tools/core';
import { ExecutorContext, names } from '@nx/devkit';
import * as handlebars from 'handlebars';
import { randomBytes } from 'node:crypto';
import { Inputs } from '../../context';
import { EngineAdapter } from '../engine-adapter';
import * as buildx from './buildx';
import * as docker from './docker';

export class Docker extends EngineAdapter {
  private standalone = true;
  private createdBuilder = false;
  private buildxVersion = '';

  getBuildxVersion() {
    return this.buildxVersion;
  }

  getCommand(args: string[]): { command: string; args: string[] } {
    return buildx.getCommand(args, this.standalone);
  }

  async initialize(inputs: Inputs, ctx?: ExecutorContext) {
    // standalone if docker cli not available
    this.standalone = !(await docker.isAvailable());

    if (!inputs.quiet) {
      await logger.group(`Docker info`, async () => {
        if (this.standalone) {
          logger.info('Docker info skipped in standalone mode');
        } else {
          await exec('docker', ['version'], {
            failOnStdErr: false,
          });
          await exec('docker', ['info'], {
            failOnStdErr: false,
          });
        }
      });
    }

    if (!(await buildx.isAvailable(this.standalone))) {
      throw new Error(
        `Docker buildx is required. See https://github.com/gperdomor/nx-tools to set up nx-container executor with buildx.`
      );
    }

    this.buildxVersion = await buildx.getVersion();

    if (!inputs.quiet) {
      await logger.group(`Buildx version`, async () => {
        const versionCmd = buildx.getCommand(['version'], this.standalone);
        await exec(versionCmd.command, versionCmd.args, {
          failOnStdErr: false,
        });
      });
    }

    this.createdBuilder = getBooleanInput('create-builder', {
      prefix: names(ctx?.projectName || '').constantName,
      fallback: 'false',
    });

    if (this.createdBuilder) {
      inputs.builder = inputs.builder || `${ctx?.projectName}-${randomBytes(24).toString('hex').substring(0, 6)}`;

      logger.info(`Creating builder ${inputs.builder}`);

      const command = buildx.getCommand(['create', `--name=${inputs.builder}`], this.standalone);
      await getExecOutput(command.command, command.args, {
        ignoreReturnCode: true,
      }).then((res) => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          throw new Error(`buildx failed with: ${res.stderr.match(/(.*)\s*$/)![0].trim()}`);
        }
      });
    }
  }

  async finalize(inputs: Inputs, _ctx?: ExecutorContext): Promise<void> {
    // startGroup(`Running post build steps`, GROUP_PREFIX);
    if (this.createdBuilder) {
      logger.info(`Removing builder ${this.createdBuilder}`);
      const command = buildx.getCommand(['rm', inputs.builder], this.standalone);
      await getExecOutput(command.command, command.args, {
        ignoreReturnCode: true,
      });
    }
  }

  async getImageID(): Promise<string | undefined> {
    return buildx.getImageID();
  }

  async getMetadata(): Promise<string | undefined> {
    return buildx.getMetadata();
  }

  async getDigest(metadata: string): Promise<string | undefined> {
    return buildx.getDigest(metadata);
  }

  async getArgs(inputs: Inputs, defaultContext: string): Promise<string[]> {
    const context = handlebars.compile(inputs.context)({ defaultContext });
    // prettier-ignore
    return [
        ...await this.getBuildArgs(inputs, defaultContext, context, this.getBuildxVersion()),
        ...await this.getCommonArgs(inputs, this.getBuildxVersion()),
        context
      ];
  }

  private async getBuildArgs(
    inputs: Inputs,
    defaultContext: string,
    context: string,
    buildxVersion: string
  ): Promise<Array<string>> {
    const args: Array<string> = ['build'];
    await asyncForEach(inputs.addHosts, async (addHost) => {
      args.push('--add-host', addHost);
    });
    if (inputs.allow.length > 0) {
      args.push('--allow', inputs.allow.join(','));
    }
    await asyncForEach(inputs.buildArgs, async (buildArg) => {
      args.push('--build-arg', buildArg);
    });
    if (buildx.satisfies(buildxVersion, '>=0.8.0')) {
      await asyncForEach(inputs.buildContexts, async (buildContext) => {
        args.push('--build-context', buildContext);
      });
    }
    await asyncForEach(inputs.cacheFrom, async (cacheFrom) => {
      args.push('--cache-from', cacheFrom);
    });
    await asyncForEach(inputs.cacheTo, async (cacheTo) => {
      args.push('--cache-to', cacheTo);
    });
    if (inputs.cgroupParent) {
      args.push('--cgroup-parent', inputs.cgroupParent);
    }
    if (inputs.file) {
      args.push('--file', inputs.file);
    }
    if (
      !buildx.isLocalOrTarExporter(inputs.outputs) &&
      (inputs.platforms.length == 0 || buildx.satisfies(buildxVersion, '>=0.4.2'))
    ) {
      args.push('--iidfile', await buildx.getImageIDFile());
    }
    await asyncForEach(inputs.labels, async (label) => {
      args.push('--label', label);
    });
    await asyncForEach(inputs.noCacheFilters, async (noCacheFilter) => {
      args.push('--no-cache-filter', noCacheFilter);
    });
    await asyncForEach(inputs.outputs, async (output) => {
      args.push('--output', output);
    });
    if (inputs.platforms.length > 0) {
      args.push('--platform', inputs.platforms.join(','));
    }
    if (inputs.provenance || inputs.provenance === 'false') {
      args.push('--provenance', inputs.provenance);
    }
    await asyncForEach(inputs.secrets, async (secret) => {
      try {
        args.push('--secret', await buildx.getSecretString(secret));
      } catch (err) {
        logger.warn(this.getErrorMessage(err));
      }
    });
    await asyncForEach(inputs.secretFiles, async (secretFile) => {
      try {
        args.push('--secret', await buildx.getSecretFile(secretFile));
      } catch (err) {
        logger.warn(this.getErrorMessage(err));
      }
    });
    if (inputs.githubToken && !buildx.hasGitAuthToken(inputs.secrets) && context.startsWith(defaultContext)) {
      args.push('--secret', await buildx.getSecretString(`GIT_AUTH_TOKEN=${inputs.githubToken}`));
    }
    if (inputs.shmSize) {
      args.push('--shm-size', inputs.shmSize);
    }
    await asyncForEach(inputs.ssh, async (ssh) => {
      args.push('--ssh', ssh);
    });
    await asyncForEach(inputs.tags, async (tag) => {
      inputs.registries && inputs.registries.length > 0
        ? inputs.registries.forEach((registry) => args.push('--tag', `${registry}/${tag}`))
        : args.push('--tag', tag);
    });
    if (inputs.target) {
      args.push('--target', inputs.target);
    }
    await asyncForEach(inputs.ulimit, async (ulimit) => {
      args.push('--ulimit', ulimit);
    });
    return args;
  }

  private async getCommonArgs(inputs: Inputs, buildxVersion: string): Promise<Array<string>> {
    const args: Array<string> = [];
    if (inputs.builder) {
      args.push('--builder', inputs.builder);
    }
    if (inputs.load) {
      args.push('--load');
    }
    if (buildx.satisfies(buildxVersion, '>=0.6.0')) {
      args.push('--metadata-file', await buildx.getMetadataFile());
    }
    if (inputs.network) {
      args.push('--network', inputs.network);
    }
    if (inputs.noCache) {
      args.push('--no-cache');
    }
    if (inputs.pull) {
      args.push('--pull');
    }
    if (inputs.push) {
      args.push('--push');
    }
    return args;
  }
}
