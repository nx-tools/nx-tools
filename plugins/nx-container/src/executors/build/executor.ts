import { getExecOutput, getInput, getProjectRoot, interpolate, loadPackage, logger } from '@nx-tools/core';
import { names, PromiseExecutor } from '@nx/devkit';
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import * as context from './context';
import { EngineAdapter } from './engines/engine-adapter';
import { EngineFactory } from './engines/engine.factory';
import { BuildExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<BuildExecutorSchema> = async (options, ctx) => {
  const tmpDir = context.tmpDir();

  try {
    const defContext = context.defaultContext();
    const inputs: context.Inputs = await context.getInputs(
      defContext,
      {
        ...options,
        file: options.file || join(getProjectRoot(ctx), 'Dockerfile'),
      },
      ctx,
    );

    const prefix = names(ctx?.projectName || '').constantName;
    const provider = getInput('engine', { prefix, fallback: options.engine || 'docker' });

    const engine: EngineAdapter = EngineFactory.create(provider);
    await engine.initialize(inputs, ctx);

    if (options.metadata?.images) {
      const { getMetadata } = await loadPackage('@nx-tools/container-metadata', 'Nx Container Build Executor');
      const meta = await getMetadata({ ...options.metadata, quiet: options.quiet }, ctx);
      inputs.labels = meta.getLabels();
      inputs.tags = meta.getTags();
    }

    const args: string[] = await engine.getArgs(inputs, defContext);
    const buildCmd = engine.getCommand(args);

    await logger.group('Build', async () => {
      logger.verbose(`Build command: ${buildCmd.command} ${buildCmd.args.join(' ')}`);

      await getExecOutput(
        buildCmd.command,
        buildCmd.args.map((arg) => interpolate(arg)),
        {
          ignoreReturnCode: true,
        },
      ).then((res) => {
        logger.verbose(res.stdout);

        if (res.stderr.length > 0 && res.exitCode != 0) {
          throw new Error(`buildx failed with: ${res.stderr.match(/(.*)\s*$/)?.[0]?.trim() ?? 'unknown error'}`);
        }
      });

      await engine.finalize(inputs, ctx);
    });

    const imageID = await engine.getImageID();
    const metadata = await engine.getMetadata();
    const digest = await engine.getDigest(metadata);

    if (imageID) {
      await logger.group(`ImageID`, async () => {
        logger.info(imageID);
        context.setOutput('imageid', imageID, ctx);
      });
    }
    if (digest) {
      await logger.group(`Digest`, async () => {
        logger.info(digest);
        context.setOutput('digest', digest, ctx);
      });
    }
    if (metadata) {
      await logger.group(`Metadata`, async () => {
        logger.info(metadata);
        context.setOutput('metadata', metadata, ctx);
      });
    }
  } finally {
    await cleanup(tmpDir);
  }

  return { success: true };
};

async function cleanup(tmpDir: string): Promise<void> {
  if (tmpDir.length > 0 && existsSync(tmpDir)) {
    await logger.group(`Removing temp folder ${tmpDir}`, async () => {
      await rm(tmpDir, { recursive: true });
    });
  }
}

export default runExecutor;
