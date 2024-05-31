import { vi } from 'vitest';
import { interpolate } from './interpolate';

describe('String interpolation', () => {
  beforeAll(() => {
    vi.stubEnv('TAG1', 'main');
    vi.stubEnv('TAG2', '1.0.0');
    vi.stubEnv('SUFFIX', '-beta.1');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  test.each([
    [
      'docker build --tag nx-docker/node:$TAG1 --tag nx-docker/node:$TAG2',
      'docker build --tag nx-docker/node:main --tag nx-docker/node:1.0.0',
    ],
    [
      'docker build --tag nx-docker/node:$TAG1 --tag nx-docker/node:$T3',
      'docker build --tag nx-docker/node:main --tag nx-docker/node:$T3',
    ],
    [
      'docker build --tag nx-docker/node:$TAG1 --tag nx-docker/node:$TAG2$SUFFIX',
      'docker build --tag nx-docker/node:main --tag nx-docker/node:1.0.0-beta.1',
    ],
  ])('given command "%s", should return "%s"', (command: string, expected: string) => {
    expect(interpolate(command)).toEqual(expected);
  });

  it('should expand ${HOME}', () => {
    expect(interpolate('${HOME}')).toEqual(process.env['HOME']);
  });

  it('should expand $HOME', () => {
    expect(interpolate('$HOME')).toEqual(process.env['HOME']);
  });

  it('should not expand', () => {
    const value = 'HOME';
    expect(interpolate(value)).toEqual(value);
  });
});
