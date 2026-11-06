// The RFC's own text, with every "RFC nnnn" turned into a way into the graph.
import { findMentions } from './rfc';

/** Builds the text as DOM nodes (no innerHTML: the text is from the network). */
export function renderText(pre: HTMLElement, rfc: number, body: string) {
  pre.replaceChildren();
  let at = 0;
  const frag = document.createDocumentFragment();
  for (const m of findMentions(body)) {
    if (m.start > at) frag.append(body.slice(at, m.start));
    const word = body.slice(m.start, m.end);
    if (m.rfc === rfc) {
      frag.append(word);
    } else {
      const a = document.createElement('a');
      a.href = `?rfc=${m.rfc}`;
      a.dataset.rfc = String(m.rfc);
      a.className = 'mention';
      a.textContent = word;
      frag.append(a);
    }
    at = m.end;
  }
  frag.append(body.slice(at));
  pre.append(frag);
}

/** The RFCs a text names, other than itself, in the order they first appear. */
export function namedIn(rfc: number, body: string): number[] {
  return [...new Set(findMentions(body).map((m) => m.rfc))].filter((n) => n !== rfc);
}
