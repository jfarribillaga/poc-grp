/**
 * Única fuente de modelos, precios, planes y valores iniciales de la POC.
 * TODOS los precios y las condiciones financieras son inventados.
 * Los nombres de versiones son referencias ilustrativas, no un catálogo vigente.
 */
export const DEMO_META = {
  version: 1,
  updatedAt: '2026-10-15',
  currency: 'ARS',
  disclaimer: 'Simulación ilustrativa con datos ficticios. No constituye oferta, aprobación crediticia ni cotización vinculante. Los importes definitivos dependen de las condiciones vigentes y de la evaluación de la entidad financiera.',
  comparisonDisclaimer: 'Comparación orientativa. La conveniencia depende de requisitos, vigencia, seguros, impuestos y condiciones no representadas en esta POC.',
};

export const CUSTOMER_TYPES = [
  { id: 'individual', name: 'Persona física' },
  { id: 'business', name: 'Persona jurídica' },
];

export const MODELS = [
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
];

const allModelIds = MODELS.map((model) => model.id);
const bothCustomerTypes = CUSTOMER_TYPES.map((type) => type.id);

export const PLANS = [
  {
    id: 'fiat-demo-inicial', demo: true, entity: 'FIAT Financiera Demo',
    name: 'Impulso inicial · Demo', currency: 'ARS',
    customerTypes: [...bothCustomerTypes], modelIds: [...allModelIds],
    terms: [
      { months: 18, tna: 32, cft: 48.8, maxLtvPct: 70, maxAmount: 20000000, expensePct: 2.5, installmentCoefficient: 0.071 },
      { months: 24, tna: 36, cft: 54.6, maxLtvPct: 70, maxAmount: 20000000, expensePct: 2.5, installmentCoefficient: 0.0578 },
    ],
    validFrom: '2026-10-01', validTo: '2027-12-31',
    notes: 'Entidad y condiciones ficticias. La cuota se estima con un coeficiente ilustrativo. No representa a una financiera real.',
  },
  {
    id: 'fiat-demo-cero', demo: true, entity: 'FIAT Financiera Demo',
    name: 'Escenario tasa cero · Demo', currency: 'ARS',
    customerTypes: ['individual'], modelIds: ['mobi', 'cronos', 'pulse', 'fastback'],
    terms: [
      { months: 12, tna: 0, cft: 9.5, maxLtvPct: 50, maxAmount: 12000000, expensePct: 3, installmentCoefficient: null },
      { months: 18, tna: 0, cft: 11, maxLtvPct: 50, maxAmount: 10000000, expensePct: 3.5, installmentCoefficient: null },
    ],
    validFrom: '2026-10-01', validTo: '2027-12-31',
    notes: 'Ejercicio ficticio de TNA cero: capital dividido por meses. Los gastos se muestran aparte y el CFT no se recalcula.',
  },
  {
    id: 'banco-uno-flex', demo: true, entity: 'Banco Demo Uno',
    name: 'Cuota flexible · Demo', currency: 'ARS',
    customerTypes: [...bothCustomerTypes], modelIds: [...allModelIds],
    terms: [
      { months: 24, tna: 49, cft: 70.2, maxLtvPct: 75, maxAmount: 26000000, expensePct: 2, installmentCoefficient: null },
      { months: 36, tna: 53, cft: 76.4, maxLtvPct: 75, maxAmount: 26000000, expensePct: 2, installmentCoefficient: null },
      { months: 48, tna: 57, cft: 82.8, maxLtvPct: 70, maxAmount: 24000000, expensePct: 2.5, installmentCoefficient: null },
    ],
    validFrom: '2026-10-01', validTo: '2027-12-31',
    notes: 'Banco inexistente. Cuota fija calculada por sistema francés con TNA mensual. No incluye seguros ni impuestos.',
  },
  {
    id: 'banco-uno-amplio', demo: true, entity: 'Banco Demo Uno',
    name: 'Mayor cobertura · Demo', currency: 'ARS',
    customerTypes: [...bothCustomerTypes], modelIds: [...allModelIds],
    terms: [
      { months: 36, tna: 59, cft: 86.1, maxLtvPct: 80, maxAmount: 35000000, expensePct: 3, installmentCoefficient: null },
      { months: 48, tna: 63, cft: 92.5, maxLtvPct: 80, maxAmount: 35000000, expensePct: 3, installmentCoefficient: null },
    ],
    validFrom: '2026-10-01', validTo: '2027-12-31',
    notes: 'Escenario ficticio para explorar un LTV mayor. Una mayor financiación no implica mayor conveniencia.',
  },
  {
    id: 'banco-dos-acotado', demo: true, entity: 'Banco Demo Dos',
    name: 'Capital acotado · Demo', currency: 'ARS',
    customerTypes: [...bothCustomerTypes], modelIds: [...allModelIds],
    terms: [
      { months: 12, tna: 25, cft: 39.5, maxLtvPct: 65, maxAmount: 8000000, expensePct: 1.5, installmentCoefficient: null },
      { months: 24, tna: 31, cft: 47.2, maxLtvPct: 65, maxAmount: 8000000, expensePct: 1.5, installmentCoefficient: null },
    ],
    validFrom: '2026-10-01', validTo: '2027-12-31',
    notes: 'Banco y tasas ficticias. El tope reducido permite demostrar la diferencia que queda fuera de la financiación.',
  },
  {
    id: 'banco-dos-trabajo', demo: true, entity: 'Banco Demo Dos',
    name: 'Vehículo de trabajo · Demo', currency: 'ARS',
    customerTypes: ['business'], modelIds: ['strada', 'toro'],
    terms: [
      { months: 24, tna: 42, cft: 62.8, maxLtvPct: 80, maxAmount: 45000000, expensePct: 2, installmentCoefficient: 0.063 },
      { months: 36, tna: 46, cft: 68.2, maxLtvPct: 80, maxAmount: 45000000, expensePct: 2, installmentCoefficient: null },
    ],
    validFrom: '2026-10-01', validTo: '2027-12-31',
    notes: 'Exclusivo en esta demostración para personas jurídicas y las pick-ups indicadas. Condiciones inventadas.',
  },
  {
    id: 'demo-archivo', demo: true, entity: 'Banco Demo Dos',
    name: 'Ejemplo vencido · Demo', currency: 'ARS',
    customerTypes: [...bothCustomerTypes], modelIds: [...allModelIds],
    terms: [
      { months: 12, tna: 20, cft: 33, maxLtvPct: 60, maxAmount: 6000000, expensePct: 2, installmentCoefficient: null },
    ],
    validFrom: '2026-01-01', validTo: '2026-09-30',
    notes: 'Se conserva a propósito como ejemplo de vigencia vencida. No puede cotizarse ni compararse.',
  },
];

export const DEFAULT_SELECTION = {
  modelId: 'cronos',
  versionId: 'cronos-drive',
  customerType: 'individual',
  planId: 'fiat-demo-inicial',
  months: 24,
  downPaymentPct: 40,
  comparison: [
    { planId: 'fiat-demo-inicial', months: 24 },
    { planId: 'banco-uno-flex', months: 36 },
  ],
};
