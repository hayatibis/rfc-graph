# Design (6 Nov 2026)

Agreed with Hayati in chat.

## Intent

A toy that goes with an essay on hayatibis.dev about the history of RFCs and why reading them makes you better at the job. The essay carries the weight; this is the "I built this for fun" link.

## What it does

- Opens at RFC 1 with a short history of the series (RFC 1, RFC 3, RFC 8700 §3.1, quotes verbatim). RFC 1 refers to nothing, so the opening graph shows what refers to it.
- Enter an RFC number or click a star: its references are fetched live and the graph grows.
- The RFC's text is readable in the app next to the graph; every "RFC nnnn" in it opens that RFC and links it in.
- "Who cites it" is a button, never automatic beyond RFC 1 (RFC 1918 alone has 911 incoming records).
- The URL carries the open RFC, so a view can be shared.

## Look

Hayati asked for something visually striking and artistic rather than mechanical. Dark is a night sky: RFCs are stars, colour is the year (amber 1969 to mint 2020s), size follows page count, lines are soft arcs, light flows from cited to citing. Light is ink on the paper RFC 1 was typed on. Fraunces for titles, IBM Plex for text. Motion only under `prefers-reduced-motion: no-preference`.

## Calls made by Claude

- Vite + TypeScript, no framework; d3-force with a hand-written canvas renderer instead of a graph library, for control over glow and motion.
- English and Turkish UI.
- Static hosting; no server.

## Not in scope

Accounts, a server, full-text search (later, perhaps with rag-lab), Internet-Drafts.
