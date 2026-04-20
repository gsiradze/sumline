export const colors = {
  paper50: 0xfdfbf6,
  paper100: 0xfaf6f0,
  paper200: 0xf2ece0,
  paper300: 0xe7dfcf,
  paper400: 0xd4c9b3,
  rule200: 0xe2d8c3,
  rule300: 0xc9bda3,
  ink900: 0x2a2722,
  ink700: 0x4a453c,
  ink500: 0x726b5e,
  ink400: 0x8e8675,
  ink300: 0xa79f8b,
  inkFill900: 0x1f2a3a,
  inkFill800: 0x263348,
  inkFill700: 0x334158,
  sage700: 0x4e6b4a,
  sage600: 0x5e7f59,
  sage500: 0x7b9875,
  sage300: 0xb7cab0,
  sage100: 0xe3eade,
  clay700: 0x8e3a20,
  clay600: 0xa84a2a,
  clay500: 0xc46a47,
  clay300: 0xe3ae94,
  clay100: 0xf3dccf,
  ochre700: 0x8b6b1e,
  ochre600: 0xa9842b,
  ochre500: 0xc39a3e,
  ochre300: 0xe3c783,
  ochre100: 0xf3e5be,
} as const;

export const hex = {
  ink900: '#2a2722',
  ink700: '#4a453c',
  ink500: '#726b5e',
  paper100: '#faf6f0',
  sage700: '#4e6b4a',
  clay700: '#8e3a20',
} as const;

export const layout = {
  canvasWidth: 500,
  canvasHeight: 620,
  cellSize: 58,
  cellGap: 8,
  cellRadius: 6,
  clueGutter: 38,
  clueFontSize: 22,
  gridOriginY: 120,
} as const;

export const motion = {
  nudgeMs: 120,
  flipMs: 280,
  liftMs: 340,
  fadeMs: 450,
} as const;
