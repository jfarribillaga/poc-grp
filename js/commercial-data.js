/**
 * Única fuente de datos de la POC multimarca.
 * Promociones 0 km: tablas verificadas visualmente en las cuatro circulares locales.
 * Sólo los precios FIAT heredados son ilustrativos; no son precios oficiales.
 * No se distribuyen los PDFs, sus imágenes ni sus páginas de contactos.
 */
export const APP_META = {
  version: 2,
  updatedAt: '2026-10-15',
  circularLabel: 'Circular octubre 2026',
  currency: 'ARS',
  disclaimer: 'Herramienta de referencia interna basada en circulares comerciales con vigencia octubre de 2026. No constituye oferta, aprobación crediticia ni cotización vinculante. Verificar vigencia, elegibilidad, seguros, impuestos y condiciones con la entidad financiera antes de informar al cliente.',
  priceDisclaimer: 'Los precios de vehículos que aparezcan precargados son ilustrativos y editables. Las cuotas no incluyen seguro automotor.',
  uvaWarning: 'Cuota inicial de referencia. El capital y las cuotas se ajustan por UVA. La POC no proyecta la evolución futura de la UVA.',
  comparisonDisclaimer: 'Comparación orientativa. La conveniencia depende de requisitos, vigencia, seguros, impuestos y condiciones no representadas en esta POC.',
  pendingTitle: 'Información comercial pendiente',
  pendingMessage: 'La marca ya está preparada en la POC, pero todavía no se cargaron sus modelos y condiciones de financiación. No se muestran tasas estimadas ni datos inventados.',
  scopeNote: 'Sólo promociones 0 km del canal TRAD. Quedan pendientes usados, ventas especiales, leasing y planes de ahorro; tampoco se cargaron taxi, remis ni Rent a Car.',
};

const VALIDITY = { validFrom: '2026-10-01', validTo: '2026-10-31' };
const sources = {
  fiat: { sourceLabel: 'Circular comercial FCA 016.26', sourceFile: '10-2026-Fiat_Circular_comercial_FCA.pdf', sourcePage: 3, riskPage: 8 },
  jeep: { sourceLabel: 'Circular comercial FCA 017.26', sourceFile: '10-2026-JeepRam_Circular_comercial_FCA.pdf', sourcePage: 3, riskPage: 8 },
  ram: { sourceLabel: 'Circular comercial FCA 017.26', sourceFile: '10-2026-JeepRam_Circular_comercial_FCA.pdf', sourcePage: 3, riskPage: 8 },
  peugeot: { sourceLabel: 'Circular comercial PSA 469.26', sourceFile: '10-2026-AP_Circular_comercial_PSA PEUGEOT.pdf', sourcePage: 3, riskPage: 9 },
  citroen: { sourceLabel: 'Circular comercial PSA 457.26', sourceFile: '10-2026-AC_Circular_comercial_PSA CITRO.pdf', sourcePage: 3, riskPage: 9 },
};

export const BRANDS = [
  { id: 'fiat', name: 'FIAT', status: 'active', logo: './assets/brands/fiat.png', ...sources.fiat, ...VALIDITY },
  { id: 'jeep', name: 'Jeep', status: 'active', logo: './assets/brands/jeep.png', ...sources.jeep, ...VALIDITY },
  { id: 'ram', name: 'RAM', status: 'active', logo: './assets/brands/ram.png', ...sources.ram, ...VALIDITY },
  { id: 'peugeot', name: 'Peugeot', status: 'active', logo: './assets/brands/peugeot.png', ...sources.peugeot, ...VALIDITY },
  { id: 'citroen', name: 'Citroën', status: 'active', logo: './assets/brands/citroen.png', ...sources.citroen, ...VALIDITY },
  { id: 'gm', name: 'GM / Chevrolet', status: 'pending', logo: './assets/brands/chevrolet.png' },
  { id: 'byd', name: 'BYD', status: 'pending', logo: null },
];

export const CUSTOMER_TYPES = [
  { id: 'individual', name: 'Persona física' },
  { id: 'business', name: 'Persona jurídica' },
];

const fiatModels = [
  {
    id: 'mobi', name: 'Mobi', category: 'Hatchback',
    versions: [{ id: 'mobi-trekking', name: 'Trekking 1.0 MT', price: 24000000 }],
  },
  {
    id: 'cronos', name: 'Cronos', category: 'Sedán',
    versions: [
      { id: 'cronos-drive', name: 'Drive Plus 1.3 MT', price: 32000000 },
      { id: 'cronos-precision', name: 'Precision 1.3 CVT', price: 36000000 },
    ],
  },
  {
    id: 'pulse', name: 'Pulse', category: 'SUV',
    versions: [
      { id: 'pulse-drive', name: 'Drive 1.3 MT', price: 35000000 },
      { id: 'pulse-audace', name: 'Audace 1.0T CVT', price: 40000000 },
    ],
  },
  {
    id: 'fastback', name: 'Fastback', category: 'SUV coupé',
    versions: [{ id: 'fastback-turbo', name: 'Turbo 270 AT6', price: 45000000 }],
  },
  {
    id: 'strada', name: 'Strada', category: 'Pick-up',
    versions: [
      { id: 'strada-freedom', name: 'Freedom 1.3 CD MT', price: 34000000 },
      { id: 'strada-volcano', name: 'Volcano 1.3 CD CVT', price: 39000000 },
    ],
  },
  {
    id: 'toro', name: 'Toro', category: 'Pick-up',
    versions: [
      { id: 'toro-freedom', name: 'Freedom 1.3T AT6 4x2', price: 52000000 },
      { id: 'toro-volcano', name: 'Volcano 2.2TD AT9 4x4', price: 62000000 },
    ],
  },
  { id: 'titano', name: 'Titano', category: 'Pick-up', price: null, versions: [] },
  { id: 'fiat-600', name: '600', category: 'Auto', price: null, versions: [] },
];

const rawModels = {
  fiat: fiatModels,
  jeep: [
    { id: 'renegade', name: 'Renegade', price: null, versions: [] },
    { id: 'compass', name: 'Compass', price: null, versions: [
      { id: 'compass-other', name: 'Otras versiones (sin especificar)', price: null },
      { id: 'compass-sport', name: 'Compass Sport', price: null },
    ] },
    { id: 'commander', name: 'Commander', price: null, versions: [] },
  ],
  ram: [
    { id: 'dakota', name: 'Dakota', price: null, versions: [] },
    { id: 'rampage', name: 'Rampage', price: null, versions: [] },
  ],
  peugeot: [
    { id: '208', name: '208', price: null, versions: [] },
    { id: '408', name: '408', price: null, versions: [] },
    { id: '3008', name: '3008', price: null, versions: [] },
    { id: '5008', name: '5008', price: null, versions: [] },
    { id: 'boxer', name: 'Boxer', price: null, versions: [] },
  ],
  citroen: [
    { id: 'c4', name: 'C4', price: null, versions: [] },
    { id: 'c5-aircross', name: 'C5 Aircross', price: null, versions: [] },
    { id: 'jumper', name: 'Jumper', price: null, versions: [] },
  ],
  gm: [],
  byd: [],
};

export const MODELS_BY_BRAND = Object.fromEntries(Object.entries(rawModels).map(([brandId, models]) => [
  brandId, models.map((model) => ({ ...model, brandId })),
]));

// Cada fila conserva el orden de la tabla: meses | TNA | aporte CE | cuota / $1.000 con IVA.
const terms = (rows) => rows.map(([months, tna, dealerContributionPct, installmentPerThousandWithVat]) => ({
  months, tna, dealerContributionPct, installmentPerThousandWithVat,
}));
const fca18 = [[18, 0, 11, 56.22], [24, 10.9, 11, 48.95], [36, 20.9, 11, 41.58]];
const fca24 = [[12, 0, 11, 84.33], [18, 8.9, 11, 61.76], [24, 17.9, 11, 53.48], [36, 25.9, 11, 45.05]];
const psaExpress = [[12, 0, 8, 83.33], [18, 0, 11, 55.56], [24, 9.9, 11, 47.83], [36, 19.9, 11, 40.60], [48, 24.9, 11, 37.46]];
const psa26 = [[12, 4.9, 10, 86.42], [18, 14.9, 10, 64.95], [24, 22.9, 10, 56.33], [36, 26.9, 10, 45.48], [48, 29.9, 10, 41.18], [60, 29.9, 10, 37.52]];
const psaUva = [[12, 0, 5, 83.33], [24, 0, 10, 41.67], [36, 7.9, 10, 32.67], [48, 11.9, 10, 28.37], [60, 13.9, 10, 25.65]];
const psaExpanded = [[12, 13.9, 8, 92.17], [18, 23.9, 8, 70.84], [24, 27.9, 8, 59.72], [36, 33.9, 8, 50.55], [48, 35.9, 8, 45.80], [60, 36.9, 8, 43.17]];

function campaign(brandId, id, name, maxAmount, rows, options = {}) {
  const brand = BRANDS.find((item) => item.id === brandId);
  return {
    id, brandId, entity: ['fiat', 'jeep', 'ram'].includes(brandId) ? 'FCA Compañía Financiera' : 'PSA Finance Argentina',
    name, dataStatus: 'commercial-circular', currency: 'ARS', isUva: false,
    customerTypes: CUSTOMER_TYPES.map((type) => type.id),
    modelIds: MODELS_BY_BRAND[brandId].map((model) => model.id),
    channel: 'TRAD', maxAmount, maxLtvPct: options.isUva ? 70 : 80,
    terms: terms(rows), ...VALIDITY,
    source: {
      circular: brand.sourceLabel, filename: brand.sourceFile, page: brand.sourcePage,
      ltvPage: brand.riskPage, validityLabel: 'Octubre de 2026 · 01/10/2026 al 31/10/2026',
    },
    notes: 'Promociones 0 km, canal TRAD. No incluye seguro automotor. Aporte CE: dato interno del concesionario, no es un gasto ni un anticipo del cliente.',
    ...options,
  };
}

function psaCampaigns(brandId, specialModelIds) {
  const regularModelIds = MODELS_BY_BRAND[brandId].filter((model) => !specialModelIds.includes(model.id)).map((model) => model.id);
  return [
    campaign(brandId, `${brandId}-express-18`, 'Tasa Express · Toda la gama', 18000000, psaExpress),
    campaign(brandId, `${brandId}-gama-26`, 'Promoción · Toda la gama', 26000000, psa26),
    campaign(brandId, `${brandId}-uva-26`, 'Prendario UVA · Toda la gama', 26000000, psaUva, { isUva: true }),
    campaign(brandId, `${brandId}-ampliada-36`, 'Línea ampliada · Tope general', 36000000, psaExpanded, {
      modelIds: regularModelIds, campaignGroupId: `${brandId}-ampliada`,
    }),
    campaign(brandId, `${brandId}-ampliada-45`, 'Línea ampliada · Modelos específicos', 45000000, psaExpanded, {
      modelIds: specialModelIds, campaignGroupId: `${brandId}-ampliada`,
    }),
  ];
}

export const PLANS_BY_BRAND = {
  fiat: [
    campaign('fiat', 'fiat-gama-18', 'Campaña FIAT Tasa Fija · Toda la gama · 18 M', 18000000, fca18),
    campaign('fiat', 'fiat-gama-24', 'Campaña FIAT Tasa Fija · Toda la gama · 24 M', 24000000, fca24),
    campaign('fiat', 'fiat-seleccion-28', 'Campaña FIAT Tasa Fija · Modelos específicos', 28000000,
      [[12, 0, 12, 84.33], [18, 0, 12, 56.22], [24, 5.9, 12, 45.80], [36, 18.9, 12, 40.21]],
      { modelIds: ['cronos', 'pulse', 'fastback', 'toro'] }),
    campaign('fiat', 'fiat-uva-30', 'Promo UVA FIAT · Toda la gama', 30000000,
      [[12, 0, 6, 84.33], [18, 0, 10, 56.22], [24, 0, 10, 42.17], [36, 0, 12, 28.11], [48, 5.9, 12, 24.71], [60, 9.9, 12, 23.11]],
      { isUva: true }),
    campaign('fiat', 'fiat-titano-35', 'Campaña TITANO', 35000000,
      [[12, 0, 10, 84.33], [18, 13.9, 10, 64.95], [24, 21.9, 10, 56.13], [36, 28.9, 10, 47.18], [48, 31.9, 10, 42.88], [60, 34.9, 10, 41.64]],
      { modelIds: ['titano'] }),
  ],
  jeep: [
    campaign('jeep', 'jeep-gama-18', 'Campaña Jeep Tasa Fija · Toda la gama · 18 M', 18000000, fca18),
    campaign('jeep', 'jeep-gama-24', 'Campaña Jeep Tasa Fija · Toda la gama · 24 M', 24000000, fca24),
    campaign('jeep', 'jeep-seleccion-28', 'Campaña Jeep Tasa Fija · Renegade, Compass y Commander', 28000000,
      [[12, 0, 12, 84.33], [18, 0, 12, 56.22], [24, 9.9, 12, 48.32], [36, 19.9, 12, 40.89]],
      { modelIds: ['renegade', 'compass', 'commander'] }),
    campaign('jeep', 'jeep-compass-sport-28', 'Compass Sport · Tasa Fija', 28000000,
      [[24, 0, 12, 42.17]], { modelIds: ['compass'], versionIds: ['compass-sport'] }),
    campaign('jeep', 'jeep-uva-30', 'Promo UVA Jeep · Toda la gama', 30000000,
      [[12, 0, 6, 84.33], [18, 0, 10, 56.22], [24, 0, 10, 42.17], [36, 5.9, 10, 31.73], [48, 9.9, 10, 27.28], [60, 12.9, 10, 25.14]],
      { isUva: true }),
  ],
  ram: [
    campaign('ram', 'ram-gama-20', 'Campaña RAM Tasa Fija · Toda la gama', 20000000,
      [[12, 0, 12, 84.33], [18, 11.9, 12, 63.67], [24, 19.9, 12, 54.80], [36, 26.9, 12, 45.76]]),
    campaign('ram', 'ram-seleccion-30', 'Dakota y Rampage · 30 M', 30000000,
      [[12, 7.9, 12, 89.31], [18, 18.9, 12, 68.18], [24, 24.9, 12, 58.14], [36, 29.9, 12, 47.90]],
      { modelIds: ['dakota', 'rampage'] }),
    campaign('ram', 'ram-seleccion-40', 'Dakota y Rampage · 40 M', 40000000,
      [[12, 11.9, 12, 91.87], [18, 20.9, 12, 69.49], [24, 25.9, 12, 58.81], [36, 31.9, 12, 49.35]],
      { modelIds: ['dakota', 'rampage'] }),
  ],
  peugeot: psaCampaigns('peugeot', ['boxer', '3008', '5008', '408']),
  citroen: psaCampaigns('citroen', ['jumper']),
  gm: [],
  byd: [],
};

export const DEFAULT_SELECTION = {
  brandId: 'fiat',
  customerType: 'individual',
  downPaymentPct: 40,
};

export const DEFAULTS_BY_BRAND = Object.fromEntries(BRANDS.map((brand) => {
  const models = MODELS_BY_BRAND[brand.id];
  const plans = PLANS_BY_BRAND[brand.id];
  return [brand.id, {
    modelId: models[0]?.id ?? '', versionId: models[0]?.versions[0]?.id ?? '',
    planId: plans[0]?.id ?? '', months: 24,
    comparison: plans.slice(0, 2).map((plan) => ({ planId: plan.id, months: 24 })),
  }];
}));
Object.assign(DEFAULTS_BY_BRAND.fiat, {
  modelId: 'cronos', versionId: 'cronos-drive', planId: 'fiat-gama-24',
  comparison: [{ planId: 'fiat-gama-24', months: 24 }, { planId: 'fiat-seleccion-28', months: 24 }],
});
