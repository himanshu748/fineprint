import { describe, expect, it, vi } from 'vitest';
import {
  fetchPublicPage,
  htmlToText,
  isPublicAddress,
  PageFetchError,
  type Getter,
} from '../src/lib/page-fetch';
import { htmlGetter, publicResolver, response, rulesHtml } from './import-fixtures';

describe('public address check', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fe80::1',
    'fd00::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
  ])('refuses %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it.each(['93.184.215.14', '151.101.1.140', '2606:4700::6810:84e5'])('allows %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
});

describe('safe page fetch', () => {
  it('reads a public HTML page and connects to the checked address', async () => {
    const get = vi.fn(htmlGetter());
    const page = await fetchPublicPage('https://example.devpost.com/rules', {
      resolve: publicResolver,
      get,
    });
    expect(page.url).toBe('https://example.devpost.com/rules');
    expect(get.mock.calls[0][1]).toBe('93.184.215.14');
  });

  it.each([
    ['http://example.com/rules', 'https://'],
    ['https://localhost/rules', 'local'],
    ['https://127.0.0.1/rules', 'private'],
    ['https://[::1]/rules', 'private'],
    ['https://169.254.169.254/latest/meta-data', 'private'],
    ['https://user:pass@example.com/', 'password'],
    ['https://example.com:8443/', 'standard port'],
    ['not a link', 'https://'],
  ])('refuses %s before connecting', async (url, message) => {
    const get = vi.fn(htmlGetter());
    await expect(fetchPublicPage(url, { resolve: publicResolver, get })).rejects.toThrow(message);
    expect(get).not.toHaveBeenCalled();
  });

  it('refuses a public name that resolves to a private address', async () => {
    const get = vi.fn(htmlGetter());
    await expect(
      fetchPublicPage('https://rebind.example/rules', {
        resolve: async () => [
          { address: '93.184.215.14', family: 4 },
          { address: '10.0.0.5', family: 4 },
        ],
        get,
      }),
    ).rejects.toThrow('private');
    expect(get).not.toHaveBeenCalled();
  });

  it('refuses a redirect to a private address', async () => {
    const hops: string[] = [];
    const get: Getter = async (url) => {
      hops.push(url.href);
      return response(302, { location: 'https://internal.example/admin' });
    };
    await expect(
      fetchPublicPage('https://example.devpost.com/rules', {
        resolve: async (host) =>
          host === 'internal.example'
            ? [{ address: '192.168.0.10', family: 4 }]
            : [{ address: '93.184.215.14', family: 4 }],
        get,
      }),
    ).rejects.toThrow('private');
    expect(hops).toEqual(['https://example.devpost.com/rules']);
  });

  it('refuses a redirect to plain http and more than three redirects', async () => {
    await expect(
      fetchPublicPage('https://example.com/', {
        resolve: publicResolver,
        get: async () => response(301, { location: 'http://example.com/' }),
      }),
    ).rejects.toThrow('https://');
    let count = 0;
    await expect(
      fetchPublicPage('https://example.com/', {
        resolve: publicResolver,
        get: async () => response(302, { location: `https://example.com/${++count}` }),
      }),
    ).rejects.toThrow('too often');
    expect(count).toBe(4);
  });

  it('refuses the wrong content type', async () => {
    const pdf = response(200, { 'content-type': 'application/pdf' }, '%PDF');
    await expect(
      fetchPublicPage('https://example.com/rules.pdf', {
        resolve: publicResolver,
        get: async () => pdf,
      }),
    ).rejects.toThrow('HTML or plain-text');
    expect(pdf.cancelled()).toBe(true);
  });

  it('refuses oversize pages by header and while streaming', async () => {
    await expect(
      fetchPublicPage('https://example.com/', {
        resolve: publicResolver,
        get: async () =>
          response(200, { 'content-type': 'text/html', 'content-length': '3000000' }),
      }),
    ).rejects.toThrow('2 MB');
    await expect(
      fetchPublicPage('https://example.com/', {
        resolve: publicResolver,
        get: async () => response(200, { 'content-type': 'text/html' }, 'x'.repeat(2_000_001)),
      }),
    ).rejects.toThrow('2 MB');
  });

  it('reports HTTP errors and unknown hosts as fetch errors', async () => {
    await expect(
      fetchPublicPage('https://example.com/', {
        resolve: publicResolver,
        get: async () => response(404, { 'content-type': 'text/html' }),
      }),
    ).rejects.toBeInstanceOf(PageFetchError);
    await expect(
      fetchPublicPage('https://missing.example/', {
        resolve: async () => {
          throw new Error('ENOTFOUND');
        },
        get: htmlGetter(),
      }),
    ).rejects.toThrow('could not be found');
  });
});

it('strips scripts and styles and keeps readable blocks', () => {
  const { title, text } = htmlToText(rulesHtml);
  expect(title).toBe('Example Hack · Rules');
  expect(text).not.toContain('window.secret');
  expect(text).not.toContain('color:red');
  expect(text).toContain('Teams may have up to four members.');
  expect(text).toContain('Be kind to the volunteers & mentors.');
});

it('retries a stalled address once on another checked address', async () => {
  const tried: string[] = [];
  const get: Getter = async (url, address) => {
    tried.push(address);
    if (address === '93.184.215.14') throw new Error('socket hang up');
    return response(200, { 'content-type': 'text/html' }, rulesHtml);
  };
  const page = await fetchPublicPage('https://example.com/rules', {
    resolve: async () => [
      { address: '93.184.215.14', family: 4 },
      { address: '151.101.1.140', family: 4 },
    ],
    get,
  });
  expect(page.body).toContain('Official Rules');
  expect(tried).toEqual(['93.184.215.14', '151.101.1.140']);
});
