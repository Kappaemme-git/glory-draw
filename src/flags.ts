// Mappa codici nazionale (FIFA / 3 lettere usate nel dataset) -> ISO 3166-1 alpha-2,
// usato per generare l'emoji bandiera. Le nazionali storiche o le subdivisioni UK
// hanno un'emoji esplicita perché non derivabile da un alpha-2 standard.

const ISO3_TO_ISO2: Record<string, string> = {
  DZA: 'DZ', AGO: 'AO', ARG: 'AR', AUS: 'AU', AUT: 'AT', BEL: 'BE', BOL: 'BO',
  BIH: 'BA', BRA: 'BR', BGR: 'BG', CMR: 'CM', CAN: 'CA', CHL: 'CL', CHN: 'CN',
  COL: 'CO', CRI: 'CR', HRV: 'HR', CZE: 'CZ', DNK: 'DK', ECU: 'EC', EGY: 'EG',
  SLV: 'SV', FRA: 'FR', GHA: 'GH', GRC: 'GR', HTI: 'HT', HND: 'HN', HUN: 'HU',
  ISL: 'IS', IRN: 'IR', IRQ: 'IQ', ISR: 'IL', ITA: 'IT', CIV: 'CI', JAM: 'JM',
  JPN: 'JP', KWT: 'KW', MEX: 'MX', MAR: 'MA', NLD: 'NL', NZL: 'NZ', NGA: 'NG',
  PRK: 'KP', NOR: 'NO', PAN: 'PA', PRY: 'PY', PER: 'PE', POL: 'PL', PRT: 'PT',
  QAT: 'QA', IRL: 'IE', ROU: 'RO', RUS: 'RU', SAU: 'SA', SEN: 'SN', SRB: 'RS',
  SVK: 'SK', SVN: 'SI', ZAF: 'ZA', KOR: 'KR', ESP: 'ES', SWE: 'SE', CHE: 'CH',
  TGO: 'TG', TTO: 'TT', TUN: 'TN', TUR: 'TR', UKR: 'UA', ARE: 'AE', USA: 'US',
  URY: 'UY', DEU: 'DE', COD: 'CD', NIR: 'GB',
};

// Emoji speciali: subdivisioni UK e nazionali non più esistenti.
const SPECIAL: Record<string, string> = {
  ENG: '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  SCO: '🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  WAL: '🏴\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}',
  CSK: '🇨🇿', // Cecoslovacchia
  DDR: '🇩🇪', // Germania Est
  SUN: '🇷🇺', // Unione Sovietica
  YUG: '🇷🇸', // Jugoslavia
  SCG: '🇷🇸', // Serbia e Montenegro
};

function emojiFromIso2(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export function flagFor(code: string): string {
  if (SPECIAL[code]) return SPECIAL[code];
  const iso2 = ISO3_TO_ISO2[code];
  return iso2 ? emojiFromIso2(iso2) : '⚽';
}
