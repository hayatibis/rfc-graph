import { describe, expect, it } from 'vitest';
import { findMentions, parseRelations, relationKind, rfcNumberFrom, yearOf } from '../src/rfc';

describe('rfcNumberFrom', () => {
  it('reads RFC numbers from Datatracker names and URIs', () => {
    expect(rfcNumberFrom('rfc1466')).toBe(1466);
    expect(rfcNumberFrom('/api/v1/doc/document/rfc8700/')).toBe(8700);
  });
  it('ignores drafts and other documents', () => {
    expect(rfcNumberFrom('/api/v1/doc/document/draft-iab-fiftyyears/')).toBeNull();
    expect(rfcNumberFrom('bcp14')).toBeNull();
  });
});

describe('relationKind', () => {
  it('maps the reference and lifecycle relationships we draw', () => {
    expect(relationKind('/api/v1/name/docrelationshipname/refnorm/')).toBe('norm');
    expect(relationKind('refinfo')).toBe('info');
    expect(relationKind('refold')).toBe('ref');
    expect(relationKind('refunk')).toBe('ref');
    expect(relationKind('obs')).toBe('obs');
    expect(relationKind('updates')).toBe('upd');
  });
  it('drops relationships that are not references', () => {
    expect(relationKind('became_rfc')).toBeNull();
    expect(relationKind('tops')).toBeNull();
  });
});

const doc = (rel: string, source: string, target: string) => ({
  relationship: `/api/v1/name/docrelationshipname/${rel}/`,
  source: `/api/v1/doc/document/${source}/`,
  target: `/api/v1/doc/document/${target}/`,
});

describe('parseRelations', () => {
  it('keeps RFC targets of outgoing edges, one edge per pair, strongest kind wins', () => {
    const json = {
      meta: { total_count: 5 },
      objects: [
        doc('refinfo', 'rfc1918', 'rfc1466'),
        doc('obs', 'rfc1918', 'rfc1597'),
        doc('refinfo', 'rfc1918', 'rfc1597'),
        doc('refnorm', 'rfc1918', 'draft-foo-bar'),
        doc('became_rfc', 'rfc1918', 'rfc9999'),
      ],
    };
    expect(parseRelations(json, 'out')).toEqual({
      total: 5,
      edges: [
        { other: 1466, kind: 'info' },
        { other: 1597, kind: 'obs' },
      ],
    });
  });

  it('reads the source side for incoming edges', () => {
    const json = { meta: { total_count: 2 }, objects: [doc('refinfo', 'rfc8700', 'rfc1'), doc('refunk', 'draft-x', 'rfc1')] };
    expect(parseRelations(json, 'in')).toEqual({ total: 2, edges: [{ other: 8700, kind: 'info' }] });
  });
});

describe('findMentions', () => {
  it('finds the usual ways RFCs name each other', () => {
    const text = 'See RFC 791, [RFC1918] and RFC-0003; also RFC #5 and rfc 2119.';
    expect(findMentions(text).map((m) => m.rfc)).toEqual([791, 1918, 3, 5, 2119]);
  });
  it('gives exact offsets so the reader can link the words', () => {
    const text = 'per [RFC0001].';
    const [m] = findMentions(text);
    expect(text.slice(m.start, m.end)).toBe('RFC0001');
  });
  it('does not read "RFCs 1034" or a bare "Request for Comments: 1" as a mention', () => {
    expect(findMentions('RFCs 1034 and 1035. Request for Comments: 1')).toEqual([]);
  });
});

describe('yearOf', () => {
  it('reads the year from an RFC Editor pub_date', () => {
    expect(yearOf('April 1969')).toBe(1969);
    expect(yearOf('February 1996')).toBe(1996);
    expect(yearOf('')).toBeNull();
  });
});
