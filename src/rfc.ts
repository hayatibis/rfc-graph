// Pure functions over the public RFC sources: no fetching here, so they can be tested.

/** How one RFC points at another. `mention` is a plain "RFC nnnn" found in the text. */
export type EdgeKind = 'obs' | 'upd' | 'norm' | 'info' | 'ref' | 'mention';

/** Stronger kinds win when the same pair is related twice. */
export const KIND_RANK: Record<EdgeKind, number> = { obs: 6, upd: 5, norm: 4, info: 3, ref: 2, mention: 1 };

export function rfcNumberFrom(nameOrUri: string): number | null {
  const name = nameOrUri.split('/').filter(Boolean).pop() ?? '';
  const m = /^rfc(\d{1,5})$/i.exec(name);
  return m ? Number(m[1]) : null;
}

const RELATIONS: Record<string, EdgeKind> = {
  refnorm: 'norm',
  refinfo: 'info',
  refold: 'ref',
  refunk: 'ref',
  obs: 'obs',
  updates: 'upd',
};

export function relationKind(slugOrUri: string): EdgeKind | null {
  const slug = slugOrUri.split('/').filter(Boolean).pop() ?? '';
  return RELATIONS[slug] ?? null;
}

export interface Edge {
  other: number;
  kind: EdgeKind;
}

interface RelatedDocuments {
  meta: { total_count: number };
  objects: { relationship: string; source: string; target: string }[];
}

/**
 * Datatracker's relateddocument list, reduced to RFC-to-RFC edges.
 * `out`: the queried RFC is the source; `in`: it is the target.
 */
export function parseRelations(json: RelatedDocuments, direction: 'out' | 'in'): { total: number; edges: Edge[] } {
  const best = new Map<number, EdgeKind>();
  for (const o of json.objects) {
    const kind = relationKind(o.relationship);
    const other = rfcNumberFrom(direction === 'out' ? o.target : o.source);
    if (!kind || other === null) continue;
    const seen = best.get(other);
    if (!seen || KIND_RANK[kind] > KIND_RANK[seen]) best.set(other, kind);
  }
  return { total: json.meta.total_count, edges: [...best].map(([other, kind]) => ({ other, kind })) };
}

export interface Mention {
  rfc: number;
  start: number;
  end: number;
}

// "RFC 791", "RFC791", "RFC-0003", "RFC #5", "[RFC1918]". Not "RFCs 1034".
const MENTION = /\bRFC[ \t\-#]*0*(\d{1,5})\b/gi;

export function findMentions(text: string): Mention[] {
  const out: Mention[] = [];
  for (const m of text.matchAll(MENTION)) {
    const rfc = Number(m[1]);
    if (rfc > 0) out.push({ rfc, start: m.index, end: m.index + m[0].length });
  }
  return out;
}

export function yearOf(pubDate: string): number | null {
  const m = /(\d{4})/.exec(pubDate);
  return m ? Number(m[1]) : null;
}
