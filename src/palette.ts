// Colour is time: an RFC's colour is the year it was published.
// Dark is a night sky with stars; light is ink on the paper RFC 1 was typed on.

export type Theme = 'dark' | 'light';

type Stop = [year: number, rgb: [number, number, number]];

const ERAS: Record<Theme, Stop[]> = {
  dark: [
    [1969, [255, 190, 110]],
    [1980, [255, 145, 112]],
    [1990, [255, 112, 170]],
    [2000, [183, 140, 255]],
    [2010, [110, 195, 255]],
    [2020, [112, 240, 200]],
  ],
  light: [
    [1969, [164, 92, 28]],
    [1980, [178, 64, 52]],
    [1990, [150, 44, 112]],
    [2000, [92, 63, 168]],
    [2010, [31, 108, 168]],
    [2020, [18, 122, 98]],
  ],
};

export const FIRST_YEAR = 1969;
export const LAST_YEAR = 2026;

export function eraRgb(year: number | null | undefined, theme: Theme): [number, number, number] {
  const stops = ERAS[theme];
  if (year == null) return theme === 'dark' ? [200, 205, 220] : [110, 110, 120];
  if (year <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [y1, c1] = stops[i];
    if (year <= y1) {
      const [y0, c0] = stops[i - 1];
      const t = (year - y0) / (y1 - y0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * t)) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

export const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r},${g},${b},${a})`;

/** A CSS gradient of the eras, for the legend. */
export function eraGradient(theme: Theme): string {
  const span = LAST_YEAR - FIRST_YEAR;
  const parts = ERAS[theme].map(([y, c]) => `${rgba(c, 1)} ${(((y - FIRST_YEAR) / span) * 100).toFixed(1)}%`);
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}

export interface Surface {
  bg: string;
  ink: [number, number, number];
  obsolete: [number, number, number];
  /** How light adds up: stars glow on a dark sky, ink darkens on paper. */
  blend: GlobalCompositeOperation;
}

export const SURFACES: Record<Theme, Surface> = {
  dark: { bg: '#070a14', ink: [226, 232, 255], obsolete: [255, 98, 82], blend: 'lighter' },
  light: { bg: '#f3eee3', ink: [36, 38, 58], obsolete: [186, 52, 38], blend: 'multiply' },
};
