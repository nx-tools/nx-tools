import * as fs from 'node:fs';
import * as path from 'node:path';
import { getPosixName } from './get-input';
import { getInputList } from './get-input-list';

describe('getInputList', () => {
  it('single line correctly', async () => {
    await setInput('foo', 'bar');
    const res = getInputList('foo');
    expect(res).toEqual(['bar']);
  });

  it('single line correctly - using fallback', async () => {
    await setInput('foo', 'bar');
    const res = getInputList('unexisting-foo', { fallback: ['value'] });
    expect(res).toEqual(['value']);
  });

  it('single line correctly - empty array without fallback', async () => {
    await setInput('foo', 'bar');
    const res = getInputList('unexisting-foo');
    expect(res).toEqual([]);
  });

  it('fallback value correctly', async () => {
    await setInput('foo', 'bar');
    const res = getInputList('none-value', { fallback: ['this-is-fallback'] });
    expect(res).toEqual(['this-is-fallback']);
  });

  it('multiline correctly', async () => {
    setInput('foo', 'bar\nbaz');
    const res = getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('empty lines correctly', async () => {
    setInput('foo', 'bar\n\nbaz');
    const res = getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('comma correctly', async () => {
    setInput('foo', 'bar,baz');
    const res = getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('empty result correctly', async () => {
    setInput('foo', 'bar,baz,');
    const res = getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('different new lines correctly', async () => {
    setInput('foo', 'bar\r\nbaz');
    const res = getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('different new lines and comma correctly', async () => {
    setInput('foo', 'bar\r\nbaz,bat');
    const res = getInputList('foo');
    expect(res).toEqual(['bar', 'baz', 'bat']);
  });

  it('multiline and ignoring comma correctly', async () => {
    setInput('cache-from', 'user/app:cache\ntype=local,src=path/to/dir');
    const res = getInputList('cache-from', { ignoreComma: true });
    expect(res).toEqual(['user/app:cache', 'type=local,src=path/to/dir']);
  });

  it('multiline and ignoring comment correctly', async () => {
    setInput('labels', 'foo=bar\nbar=qux#baz');
    const res = getInputList('labels');
    expect(res).toEqual(['foo=bar', 'bar=qux#baz']);
  });

  it('multiline with comment', async () => {
    setInput('labels', 'foo=bar\nbar=qux#baz');
    const res = getInputList('labels', { comment: '#' });
    expect(res).toEqual(['foo=bar', 'bar=qux']);
  });

  it('different new lines and ignoring comma correctly', async () => {
    setInput('cache-from', 'user/app:cache\r\ntype=local,src=path/to/dir');
    const res = getInputList('cache-from', { ignoreComma: true });
    expect(res).toEqual(['user/app:cache', 'type=local,src=path/to/dir']);
  });

  it('do not escape surrounding quotes', async () => {
    setInput('driver-opts', `"env.no_proxy=localhost,127.0.0.1,.mydomain"`);
    const res = getInputList('driver-opts', { ignoreComma: true, quote: false });
    expect(res).toEqual(['"env.no_proxy=localhost,127.0.0.1,.mydomain"']);
  });

  it('escape surrounding quotes', async () => {
    setInput('platforms', 'linux/amd64\n"linux/arm64,linux/arm/v7"');
    const res = getInputList('platforms');
    expect(res).toEqual(['linux/amd64', 'linux/arm64', 'linux/arm/v7']);
  });

  it('multiline values', async () => {
    setInput(
      'secrets',
      `GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789
"MYSECRET=aaaaaaaa
bbbbbbb
ccccccccc"
FOO=bar`
    );
    const res = getInputList('secrets', { ignoreComma: true });
    expect(res).toEqual([
      'GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789',
      `MYSECRET=aaaaaaaa
bbbbbbb
ccccccccc`,
      'FOO=bar',
    ]);
  });

  it('multiline values with empty lines', async () => {
    setInput(
      'secrets',
      `GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789
"MYSECRET=aaaaaaaa
bbbbbbb
ccccccccc"
FOO=bar
"EMPTYLINE=aaaa

bbbb
ccc"`
    );
    const res = getInputList('secrets', { ignoreComma: true });
    expect(res).toEqual([
      'GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789',
      `MYSECRET=aaaaaaaa
bbbbbbb
ccccccccc`,
      'FOO=bar',
      `EMPTYLINE=aaaa

bbbb
ccc`,
    ]);
  });

  it('multiline values without quotes', async () => {
    setInput(
      'secrets',
      `GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789
MYSECRET=aaaaaaaa
bbbbbbb
ccccccccc
FOO=bar`
    );
    const res = getInputList('secrets', { ignoreComma: true });
    expect(res).toEqual([
      'GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789',
      'MYSECRET=aaaaaaaa',
      'bbbbbbb',
      'ccccccccc',
      'FOO=bar',
    ]);
  });

  it('large multiline values', async () => {
    const pgp = fs.readFileSync(path.join(__dirname, '..', '..', 'fixtures', 'pgp.txt'), { encoding: 'utf-8' });
    setInput(
      'secrets',
      `"GPG_KEY=${pgp}"
FOO=bar`
    );
    const res = getInputList('secrets', { ignoreComma: true });
    expect(res).toEqual([`GPG_KEY=${pgp}`, 'FOO=bar']);
  });

  it('multiline values escape quotes', async () => {
    setInput(
      'secrets',
      `GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789
"MYSECRET=aaaaaaaa
bbbb""bbb
ccccccccc"
FOO=bar`
    );
    const res = getInputList('secrets', { ignoreComma: true });
    expect(res).toEqual([
      'GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789',
      `MYSECRET=aaaaaaaa
bbbb"bbb
ccccccccc`,
      'FOO=bar',
    ]);
  });

  it('keep quotes', async () => {
    const output = `type=image,"name=ghcr.io/nginxinc/nginx-unprivileged,docker.io/nginxinc/nginx-unprivileged",push-by-digest=true,name-canonical=true,push=true`;
    setInput('outputs', output);
    expect(getInputList('outputs', { ignoreComma: true, quote: false })).toEqual([output]);
  });

  describe('prefix', () => {
    it('getInputList should use return prefixed value if prefixed input exists', async () => {
      await setInput('foo', 'bar');
      await setInput('prefixed-foo', 'prefixed-bar');

      const res = getInputList('foo', { prefix: 'prefixed' });
      expect(res).toEqual(['prefixed-bar']);
    });

    it('getInputList should use return unprefixed value if prefixed input is missing', async () => {
      await setInput('abc', 'bar,xyz');
      expect(getInputList('abc', { prefix: 'prefixed' })).toEqual(['bar', 'xyz']);
      expect(getInputList('abc')).toEqual(['bar', 'xyz']);
    });
  });
});

function setInput(name: string, value: string): void {
  process.env[getPosixName(name)] = value;
}
