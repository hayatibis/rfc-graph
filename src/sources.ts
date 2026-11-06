// Fetching from the two public sources. Both send `access-control-allow-origin: *`,
// so the app needs no server of its own.
import { parseRelations, rfcNumberFrom, yearOf, type Edge } from './rfc';

const EDITOR = 'https://www.rfc-editor.org/rfc';
const TRACKER = 'https://datatracker.ietf.org/api/v1/doc/relateddocument/';

export interface Meta {
  rfc: number;
  title: string;
  authors: string[];
  date: string;
  year: number | null;
  status: string;
  pages: number;
  obsoletes: number[];
  obsoletedBy: number[];
  updates: number[];
  updatedBy: number[];
}

// A small queue so opening a busy RFC doesn't fire a hundred requests at once.
let active = 0;
const waiting: (() => void)[] = [];
async function limited<T>(job: () => Promise<T>): Promise<T> {
  if (active >= 6) await new Promise<void>((go) => waiting.push(go));
  active++;
  try {
    return await job();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

const cache = new Map<string, Promise<unknown>>();
function once<T>(key: string, job: () => Promise<T>): Promise<T> {
  let hit = cache.get(key) as Promise<T> | undefined;
  if (!hit) {
    hit = limited(job);
    cache.set(key, hit);
    hit.catch(() => cache.delete(key));
  }
  return hit;
}

// The Datatracker sits behind Cloudflare, and the first request of a page sometimes comes
// back without its CORS header; the next one is fine. So a failed fetch is tried again.
async function get(url: string, as: 'json' | 'text', tries = 3): Promise<any> {
  try {
    const res = await fetch(url);
    if (res.status === 404) throw Object.assign(new Error(`404 ${url}`), { final: true });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return as === 'json' ? await res.json() : await res.text();
  } catch (e) {
    if (tries <= 1 || (e as { final?: boolean }).final) throw e;
    await new Promise((r) => setTimeout(r, 400 * (4 - tries)));
    // A fresh URL, so the browser doesn't hand back the failed response from its cache.
    return get(`${url}${url.includes('?') ? '&' : '?'}try=${tries}`, as, tries - 1);
  }
}

const numbers = (list: string[] | undefined) =>
  (list ?? []).map((s) => rfcNumberFrom(s.toLowerCase())).filter((n): n is number => n !== null);

export function meta(rfc: number): Promise<Meta> {
  return once(`meta:${rfc}`, async () => {
    const j = await get(`${EDITOR}/rfc${rfc}.json`, 'json');
    return {
      rfc,
      title: String(j.title ?? '').trim(),
      authors: (j.authors ?? []) as string[],
      date: String(j.pub_date ?? ''),
      year: yearOf(String(j.pub_date ?? '')),
      status: String(j.status ?? ''),
      pages: Number(j.page_count) || 0,
      obsoletes: numbers(j.obsoletes),
      obsoletedBy: numbers(j.obsoleted_by),
      updates: numbers(j.updates),
      updatedBy: numbers(j.updated_by),
    };
  });
}

export function referencesOf(rfc: number): Promise<{ total: number; edges: Edge[] }> {
  return once(`out:${rfc}`, async () =>
    parseRelations(await get(`${TRACKER}?source__name=rfc${rfc}&format=json&limit=400`, 'json'), 'out'),
  );
}

export function citedBy(rfc: number, limit = 60): Promise<{ total: number; edges: Edge[] }> {
  return once(`in:${rfc}:${limit}`, async () =>
    parseRelations(await get(`${TRACKER}?target__name=rfc${rfc}&format=json&limit=${limit}`, 'json'), 'in'),
  );
}

export function text(rfc: number): Promise<string> {
  // Old RFCs carry form feeds between pages; the reader doesn't need them.
  return once(`txt:${rfc}`, async () => String(await get(`${EDITOR}/rfc${rfc}.txt`, 'text')).replace(/\f/g, '').replace(/^\s*\n/, ''));
}
