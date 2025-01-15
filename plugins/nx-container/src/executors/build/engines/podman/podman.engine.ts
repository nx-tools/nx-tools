import { asyncForEach, exec, getExecOutput, logger } from '@nx-tools/core';
import { ExecutorContext } from '@nx/devkit';
import * as handlebars from 'handlebars';
import { Inputs } from '../../context';
import { EngineAdapter } from '../engine-adapter';
import * as podman from './podman';

export class Podman extends EngineAdapter {
  private podmanVersion = '';

  getPodmanVersion() {
    return this.podmanVersion;
  }

  getCommand(args: string[]): { command: string; args: string[] } {
    return {
      command: 'podman',
      args,
    };
  }

  async initialize(inputs: Inputs, _ctx?: ExecutorContext): Promise<void> {
    if (!(await podman.isAvailable())) {
      throw new Error(
        `Podman is required. See https://github.com/gperdomor/nx-tools to set up nx-container executor with podman.`
      );
    }

    if (!inputs.quiet) {
      await logger.group(`Podman info`, async () => {
        await exec('podman', ['version'], {
          failOnStdErr: false,
        });
        await exec('podman', ['info'], {
          failOnStdErr: false,
        });
      });
    }

    this.podmanVersion = await podman.getVersion();

    if (!inputs.quiet) {
      await logger.group(`Podman version`, async () => {
        await exec('podman', ['version'], {
          failOnStdErr: false,
        });
      });
    }
  }

  async finalize(inputs: Inputs, _ctx?: ExecutorContext): Promise<void> {
    if (inputs.push) {
      await asyncForEach(inputs.tags, async (tag) => {
        const cmd = this.getCommand(['push', tag]);
        await getExecOutput(cmd.command, cmd.args, {
          ignoreReturnCode: true,
        }).then((res) => {
          if (res.stderr.length > 0 && res.exitCode != 0) {
            throw new Error(`podman failed with: ${res.stderr.match(/(.*)\s*$/)?.[0]?.trim() ?? 'unknown error'}`);
          }
        });
      });
    }
  }

  async getImageID(): Promise<string | undefined> {
    return podman.getImageID();
  }

  async getMetadata(): Promise<string | undefined> {
    return podman.getMetadata();
  }

  async getDigest(metadata: string): Promise<string | undefined> {
    return podman.getDigest(metadata);
  }

  async getArgs(inputs: Inputs, defaultContext: string): Promise<string[]> {
    const context = handlebars.compile(inputs.context)({ defaultContext });
    // prettier-ignore
    return [
        ...await this.getBuildArgs(inputs, defaultContext, context, this.getPodmanVersion()),
        ...await this.getCommonArgs(inputs, this.getPodmanVersion()),
        context
      ];
  }

  private async getBuildArgs(
    inputs: Inputs,
    defaultContext: string,
    context: string,
    podmanVersion: string
  ): Promise<Array<string>> {
    const args: Array<string> = ['build'];
    await asyncForEach(inputs.addHosts, async (addHost) => {
      args.push('--add-host', addHost);
    });
    await asyncForEach(inputs.buildArgs, async (buildArg) => {
      args.push('--build-arg', buildArg);
    });
    if (podman.satisfies(podmanVersion, '>=4.2.0')) {
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
      !podman.isLocalOrTarExporter(inputs.outputs) &&
      (inputs.platforms.length == 0 || podman.satisfies(podmanVersion, '>=3.1.0'))
    ) {
      args.push('--iidfile', await podman.getImageIDFile());
    }
    await asyncForEach(inputs.labels, async (label) => {
      args.push('--label', label);
    });
    await asyncForEach(inputs.outputs, async (output) => {
      args.push('--output', output);
    });
    if (inputs.platforms.length > 0) {
      args.push('--platform', inputs.platforms.join(','));
    }
    await asyncForEach(inputs.secrets, async (secret) => {
      try {
        args.push('--secret', await podman.getSecretString(secret));
      } catch (err) {
        logger.warn(this.getErrorMessage(err));
      }
    });
    await asyncForEach(inputs.secretFiles, async (secretFile) => {
      try {
        args.push('--secret', await podman.getSecretFile(secretFile));
      } catch (err) {
        logger.warn(this.getErrorMessage(err));
      }
    });
    if (inputs.githubToken && !podman.hasGitAuthToken(inputs.secrets) && context.startsWith(defaultContext)) {
      args.push('--secret', await podman.getSecretString(`GIT_AUTH_TOKEN=${inputs.githubToken}`));
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

  private async getCommonArgs(inputs: Inputs, _podmanVersion: string): Promise<Array<string>> {
    const args: Array<string> = [];
    if (inputs.load) {
      args.push('--load');
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
    return args;
  }
}
