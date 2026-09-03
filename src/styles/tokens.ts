// Design tokens distilled from the eSource Builder design canvas
// (EsourcEngine — warm editorial palette, Instrument Sans + JetBrains Mono).
// Import these instead of hardcoding hex values in new/restyled screens.

export const color = {
  canvas: '#F7F6F3',
  surface: '#FFFFFF',
  border: '#E6E3DC',
  borderStrong: '#DCD8CF',
  borderHover: '#B9B3A6',
  divider: '#EFECE5',

  ink: '#17181A',
  inkSoft: '#5C584F',
  inkMuted: '#6E6A62',
  textSubtle: '#8A857B',
  textFaint: '#A29C90',
  textGhost: '#918B7F',

  sidebarBg: '#17100F',
  sidebarPanel: '#221614',
  sidebarPanelBorder: '#33211F',
  sidebarBorder: '#2B1D1B',
  sidebarHover: '#2A1A18',
  sidebarText: '#E7E4DE',
  sidebarTextDim: '#B3A29F',
  sidebarTextFaint: '#8C7875',
  sidebarTextGhost: '#7A6663',
  sidebarActiveBg: '#3A1F1D',
  sidebarActiveFg: '#FFE7E4',

  accent: '#BE4A46',
  accentHover: '#F08080',
  accentSoft: '#FDF1F1',
  accentSoftBorder: '#F1CFCE',
  accentDeep: '#9C3733',

  success: '#2F6B4F',
  successSoft: '#EAF2ED',
  successSoftBorder: '#D3E4D9',

  warning: '#E0716D',
  warningSoft: '#FCEAEA',
  warningSoftFg: '#973C38',

  danger: '#A02D24',
  dangerSoft: '#FBEDEB',

  chipBg: '#F1EFEA',
  chipFg: '#6E6A62',
  fieldBg: '#FBFAF7',
} as const;

export const font = {
  sans: "'Instrument Sans', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
