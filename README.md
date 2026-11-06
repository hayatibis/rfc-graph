# rfc graph

Read an RFC with its whole reference graph in view.

**Live:** https://rfc-graph.hayatibis.dev

You open one RFC to check one thing. It points to another, which points to two more. This draws that graph while you read: each RFC is a star coloured by the year it came out, the lines are its references, and light runs from an RFC to the ones that build on it. It starts where the series started, at [RFC 1](https://www.rfc-editor.org/rfc/rfc1), 7 April 1969.

Made for fun, alongside an essay on [hayatibis.dev](https://hayatibis.dev) about what RFCs are and why reading them is worth it.

## What the lines mean

| Line | Source |
|---|---|
| normative / informative reference | IETF Datatracker `relateddocument` API (`refnorm`, `refinfo`; `refold` and `refunk` for older records) |
| obsoletes / updates | RFC Editor metadata (`rfcNNNN.json`), both directions |
| named in the text | a plain "RFC nnnn" in the document itself; the only edges most early RFCs have, since the Datatracker didn't record their references |

Only RFC-to-RFC edges are drawn; Internet-Drafts are left out. "Who cites it" shows the RFCs among the documents that refer to the open one, up to 60.

## How it works

No server. The browser fetches from `www.rfc-editor.org` and `datatracker.ietf.org`, which both send `access-control-allow-origin: *`. The Datatracker is behind Cloudflare and sometimes answers a page's first request without the CORS header, so failed requests are retried.

- `src/rfc.ts`: pure parsing (relationships, "RFC nnnn" mentions), unit-tested
- `src/sources.ts`: cached, rate-limited fetches
- `src/graph.ts`: d3-force layout drawn on a canvas
- `src/main.ts`: panels, reader, URL state (`?rfc=1918`)

Animation runs only when the reader hasn't asked for reduced motion. The list of RFCs you've read stays in your own browser (localStorage).

## Run it

```sh
npm install
npm run dev
npm test
npm run build
```

## Licence

MIT. RFC texts and metadata belong to the IETF Trust and the RFC Editor and are fetched live, not copied here.
