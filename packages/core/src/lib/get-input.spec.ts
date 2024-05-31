import * as path from 'node:path';
import { vi } from 'vitest';
import { getBooleanInput, getInput, getMultilineInput, getPosixName } from './get-input';

describe('getPosixName', () => {
  test.each([
    ['my var', 'INPUT_MY_VAR'],
    ['allow', 'INPUT_ALLOW'],
    ['build-args', 'INPUT_BUILD_ARGS'],
    ['builder', 'INPUT_BUILDER'],
    ['cache_from', 'INPUT_CACHE_FROM'],
    ['no-Cache', 'INPUT_NO_CACHE'],
    ['engine', 'INPUT_ENGINE'],
    ['ENGINE', 'INPUT_ENGINE'],
  ])('given %s, should return %s', (name: string, expected: string) => {
    expect(getPosixName(name)).toEqual(expected);
  });
});

describe('getInputs', () => {
  beforeAll(() => {
    vi.stubEnv('my var', '');
    vi.stubEnv('special char var \r\n];', '');
    vi.stubEnv('my var2', '');
    vi.stubEnv('my secret', '');
    vi.stubEnv('special char secret \r\n];', '');
    vi.stubEnv('my secret2', '');
    vi.stubEnv('PATH', `path1${path.delimiter}path2`), vi.stubEnv('INPUT_PREFIXED_MY_INPUT', 'prefixed-val');
    vi.stubEnv('INPUT_MY_INPUT', 'val');
    vi.stubEnv('INPUT_MY_OTHER_INPUT', 'other-val');
    vi.stubEnv('INPUT_MISSING', '');
    vi.stubEnv('INPUT_SPECIAL_CHARS_\'\t"\\', '\'\t"\\ response ');
    vi.stubEnv('INPUT_MULTIPLE_SPACES_VARIABLE', 'I have multiple spaces');
    vi.stubEnv('INPUT_BOOLEAN_INPUT', 'true');
    vi.stubEnv('INPUT_BOOLEAN_INPUT_TRUE1', 'true');
    vi.stubEnv('INPUT_BOOLEAN_INPUT_TRUE2', 'True');
    vi.stubEnv('INPUT_BOOLEAN_INPUT_TRUE3', 'TRUE');
    vi.stubEnv('INPUT_BOOLEAN_INPUT_FALSE1', 'false');
    vi.stubEnv('INPUT_BOOLEAN_INPUT_FALSE2', 'False');
    vi.stubEnv('INPUT_BOOLEAN_INPUT_FALSE3', 'FALSE');
    vi.stubEnv('INPUT_WRONG_BOOLEAN_INPUT', 'wrong');
    vi.stubEnv('INPUT_WITH_TRAILING_WHITESPACE', '  some val  ');
    vi.stubEnv('INPUT_MY_INPUT_LIST', 'val1\nval2\nval3');
    vi.stubEnv('INPUT_LIST_WITH_TRAILING_WHITESPACE', '  val1  \n  val2  \n  ');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  describe('getInput', () => {
    it('getInput gets non-required input', () => {
      expect(getInput('my input')).toBe('val');
    });

    it('getInput gets required input', () => {
      expect(getInput('my input', { required: true })).toBe('val');
    });

    it('getInput throws on missing required input', () => {
      expect(() => getInput('missing', { required: true })).toThrow('Input required and not supplied: missing');
    });

    it('getInput does not throw on missing non-required input', () => {
      expect(getInput('missing', { required: false })).toBe('');
    });

    it('getInput is case insensitive', () => {
      expect(getInput('My InPuT')).toBe('val');
    });

    it('getInput handles multiple spaces', () => {
      expect(getInput('multiple spaces variable')).toBe('I have multiple spaces');
    });

    it('getInput trims whitespace by default', () => {
      expect(getInput('with trailing whitespace')).toBe('some val');
    });

    it('getInput trims whitespace when option is explicitly true', () => {
      expect(getInput('with trailing whitespace', { trimWhitespace: true })).toBe('some val');
    });

    it('getInput does not trim whitespace when option is false', () => {
      expect(getInput('with trailing whitespace', { trimWhitespace: false })).toBe('  some val  ');
    });

    it('getInput should use no prefixed input if prefixed input is missing', () => {
      expect(getInput('my_other_input', { prefix: 'prefixed' })).toBe('other-val');
    });

    it('getInput should use fallback value on missing input', () => {
      expect(getInput('no existent input', { fallback: 'fallback-value' })).toBe('fallback-value');
    });

    describe('fallback', () => {
      it('getInput should use return real value if input exists', () => {
        expect(getInput('my input', { fallback: 'fallback-1' })).toEqual('val');
        expect(getInput('my other input', { fallback: 'fallback-2' })).toEqual('other-val');
      });

      it('getInput should use fallback value on missing input', () => {
        expect(getInput('x 1', { fallback: 'fallback-1' })).toEqual('fallback-1');
        expect(getInput('y 2', { fallback: 'fallback-2' })).toEqual('fallback-2');
        expect(getInput('z 3', { fallback: 'fallback-3' })).toEqual('fallback-3');
      });
    });

    describe('prefix', () => {
      it('getInput should use return prefixed value if prefixed input exists', () => {
        expect(getInput('my input', { prefix: 'prefixed' })).toBe('prefixed-val');
        expect(getInput('my input')).toBe('val');
      });

      it('getInput should use return unprefixed value if prefixed input is missing', () => {
        expect(getInput('my other input', { prefix: 'prefixed' })).toBe('other-val');
        expect(getInput('my other input')).toBe('other-val');
      });
    });

    it('getInput should use return empty string if no value is founded and no fallback provided', () => {
      expect(getInput('non-existing-variable', { prefix: 'prefixed' })).toBe('');
      expect(getInput('non-existing-variable')).toBe('');
    });
  });

  describe('getBooleanInput', () => {
    it('getBooleanInput gets non-required boolean input', () => {
      expect(getBooleanInput('boolean input')).toBe(true);
    });

    it('getBooleanInput gets required input', () => {
      expect(getBooleanInput('boolean input', { required: true })).toBe(true);
    });

    it('getBooleanInput handles boolean input', () => {
      expect(getBooleanInput('boolean input true1')).toBe(true);
      expect(getBooleanInput('boolean input true2')).toBe(true);
      expect(getBooleanInput('boolean input true3')).toBe(true);
      expect(getBooleanInput('boolean input false1')).toBe(false);
      expect(getBooleanInput('boolean input false2')).toBe(false);
      expect(getBooleanInput('boolean input false3')).toBe(false);
    });

    it('getBooleanInput handles wrong boolean input', () => {
      expect(() => getBooleanInput('wrong boolean input')).toThrow(
        'Input does not meet YAML 1.2 "Core Schema" specification: wrong boolean input\n' +
          `Support boolean input list: \`true | True | TRUE | false | False | FALSE\``
      );
    });
  });

  describe('getMultilineInput', () => {
    it('getMultilineInput works', () => {
      expect(getMultilineInput('my input list')).toEqual(['val1', 'val2', 'val3']);
    });

    it('getMultilineInput trims whitespace by default', () => {
      expect(getMultilineInput('list with trailing whitespace')).toEqual(['val1', 'val2']);
    });

    it('getMultilineInput trims whitespace when option is explicitly true', () => {
      expect(
        getMultilineInput('list with trailing whitespace', {
          trimWhitespace: true,
        })
      ).toEqual(['val1', 'val2']);
    });

    it('getMultilineInput does not trim whitespace when option is false', () => {
      expect(
        getMultilineInput('list with trailing whitespace', {
          trimWhitespace: false,
        })
      ).toEqual(['  val1  ', '  val2  ', '  ']);
    });
  });
});
