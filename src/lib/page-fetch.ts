import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';

export class PageFetchError extends Error {}

export const fetchLimits = {
  redirects: 3,
  timeoutMs: 10_000,
  attemptMs: 5_000,
  bytes: 2_000_000,
};

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const)
  blocked.addSubnet(network, prefix, 'ipv6');

/** True only for globally routable unicast addresses. */
export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (!family) return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return isPublicAddress(mapped[1]);
  return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export type Resolver = (host: string) => Promise<{ address: string; family: number }[]>;
export type RawResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array>;
  cancel: () => void;
};
/** Connects to the already-checked address, so DNS cannot change between check and use. */
export type Getter = (url: URL, address: string, signal: AbortSignal) => Promise<RawResponse>;

const systemResolver: Resolver = (host) => lookup(host, { all: true, verbatim: true });

const httpsGet: Getter = (url, address, signal) =>
  new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'GET',
        signal,
        lookup: (_host, options, callback) => {
          const family = isIP(address);
          if (options && (options as { all?: boolean }).all)
            (callback as (e: null, a: { address: string; family: number }[]) => void)(null, [
              { address, family },
            ]);
          else callback(null, address, family);
        },
        headers: {
          'user-agent':
            'Mozilla/5.0 (compatible; FinePrintRuleImporter/0.1; +https://fineprint-kappa.vercel.app)',
          accept: 'text/html, text/plain;q=0.9',
          'accept-encoding': 'identity',
        },
      },
      (res) =>
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: res,
          cancel: () => res.destroy(),
        }),
    );
    req.on('error', reject);
    req.end();
  });

function header(headers: RawResponse['headers'], name: string) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

async function checkedAddress(url: URL, resolve: Resolver) {
  if (url.protocol !== 'https:') throw new PageFetchError('Use an https:// link.');
  if (url.username || url.password)
    throw new PageFetchError('Links with a username or password are not allowed.');
  if (url.port && url.port !== '443') throw new PageFetchError('Use a link on the standard port.');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || (!host.includes('.') && !isIP(host)))
    throw new PageFetchError('Use a public website, not a local address.');
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await resolve(host).catch(() => {
        throw new PageFetchError('That website could not be found.');
      });
  if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address)))
    throw new PageFetchError('That link points to a private or local network address.');
  return addresses.map((item) => item.address);
}

type Hop = { redirect: string } | { page: FetchedPage };

async function readHop(url: URL, response: RawResponse): Promise<Hop> {
  if (response.status >= 300 && response.status < 400) {
    response.cancel();
    const location = header(response.headers, 'location');
    if (!location) throw new PageFetchError('The page redirected without a destination.');
    return { redirect: location };
  }
  if (response.status < 200 || response.status >= 300) {
    response.cancel();
    throw new PageFetchError(`The page returned HTTP ${response.status}.`);
  }
  const contentType = (header(response.headers, 'content-type') ?? '').toLowerCase();
  if (!/^text\/(html|plain)\b/.test(contentType)) {
    response.cancel();
    throw new PageFetchError('The link must be an HTML or plain-text page.');
  }
  if (Number(header(response.headers, 'content-length') ?? 0) > fetchLimits.bytes) {
    response.cancel();
    throw new PageFetchError('The page is larger than 2 MB.');
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > fetchLimits.bytes) {
      response.cancel();
      throw new PageFetchError('The page is larger than 2 MB.');
    }
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const charset = /charset=([\w-]+)/.exec(contentType)?.[1] ?? 'utf-8';
  let body: string;
  try {
    body = new TextDecoder(charset).decode(bytes);
  } catch {
    body = new TextDecoder().decode(bytes);
  }
  return { page: { url: url.href, contentType, body } };
}

export type FetchedPage = { url: string; contentType: string; body: string };

/**
 * Fetches one public https page: every hop is resolved and checked, redirects are capped,
 * and only HTML or plain text within the size limit is read.
 */
export async function fetchPublicPage(
  raw: string,
  deps: { resolve?: Resolver; get?: Getter } = {},
): Promise<FetchedPage> {
  const resolve = deps.resolve ?? systemResolver;
  const get = deps.get ?? httpsGet;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PageFetchError('Enter a full link that starts with https://.');
  }
  const signal = AbortSignal.timeout(fetchLimits.timeoutMs);
  try {
    for (let hop = 0; ; hop++) {
      const addresses = await checkedAddress(url, resolve);
      let result: Hop | null = null;
      // Load-balanced hosts sometimes have one stalled address; try a second checked one.
      for (let attempt = 0; !result; attempt++) {
        const attemptSignal = AbortSignal.any([signal, AbortSignal.timeout(fetchLimits.attemptMs)]);
        try {
          result = await readHop(
            url,
            await get(url, addresses[attempt % addresses.length], attemptSignal),
          );
        } catch (error) {
          if (error instanceof PageFetchError || signal.aborted || attempt >= 1) throw error;
        }
      }
      if ('page' in result) return result.page;
      if (hop >= fetchLimits.redirects) throw new PageFetchError('The page redirected too often.');
      url = new URL(result.redirect, url);
    }
  } catch (error) {
    if (error instanceof PageFetchError) throw error;
    if (signal.aborted) throw new PageFetchError('The page took longer than 10 seconds.');
    throw new PageFetchError('The page could not be fetched.');
  }
}

const entities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  hellip: '...',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
};
function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const point =
        code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return point > 0 && point < 0x110000 ? String.fromCodePoint(point) : match;
    }
    return entities[code.toLowerCase()] ?? match;
  });
}

/** Reduces an HTML page to readable text with one block per line. */
export function htmlToText(html: string) {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(
      /<\/?(p|div|section|article|header|footer|main|aside|nav|li|ul|ol|h[1-6]|tr|table|dt|dd|blockquote|pre|details|summary)\b[^>]*>/gi,
      '\n',
    )
    .replace(/<[^>]+>/g, ' ');
  const lines = decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return {
    title: title ? decodeEntities(title).replace(/\s+/g, ' ').trim() : '',
    text: lines.join('\n'),
  };
}

export function pageText(page: FetchedPage) {
  return page.contentType.startsWith('text/plain')
    ? { title: '', text: page.body.replace(/\r\n/g, '\n').trim() }
    : htmlToText(page.body);
}
