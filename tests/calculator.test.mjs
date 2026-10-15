import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInstallment, calculateQuote, getPlanStatus, isPlanAvailable, validateAmounts } from '../js/calculator.js';
import { CUSTOMER_TYPES, DEMO_META, MODELS, PLANS } from '../js/demo-data.js';

const asOf = DEMO_META.updatedAt;
const initialPlan = PLANS.find((plan) => plan.id === 'fiat-demo-inicial');
const input = {
  price: 32000000, downPayment: 12800000, modelId: 'cronos',
  customerType: 'individual', plan: initialPlan, months: 24, asOf,
};
const quote = (overrides = {}) => calculateQuote({ ...input, ...overrides });

test('cotización normal: capital, coeficiente, gastos y suma nominal consistentes', () => {
  const result = quote();
  assert.equal(result.ok, true);
  assert.equal(result.requested, 19200000);
  assert.equal(result.eligible, 19200000);
  assert.equal(result.installment, 1109760);
  assert.equal(result.expenses, 480000);
  assert.equal(result.totalInstallments, 26634240);
  assert.equal(result.gap, 0);
  assert.equal(result.method, 'coefficient');
});

test('LTV calculado siempre sobre el precio de lista', () => {
  const result = quote({ price: 20000000, downPayment: 1000000 });
  assert.equal(result.ok, true);
  assert.equal(result.eligible, 14000000);
  assert.equal(result.gap, 5000000);
  assert.equal(result.requiredDownPayment, 6000000);
  assert.deepEqual(result.cappedBy, ['ltv']);
});

test('tope de monto y anticipo adicional', () => {
  const result = quote({ price: 60000000, downPayment: 30000000 });
  assert.equal(result.eligible, 20000000);
  assert.equal(result.gap, 10000000);
  assert.equal(result.requiredDownPayment, 40000000);
  assert.deepEqual(result.cappedBy, ['maxAmount']);
});

test('topes coincidentes y redondeo conservador del capital', () => {
  const plan = structuredClone(initialPlan);
  const term = plan.terms.find((item) => item.months === input.months);
  term.maxLtvPct = 50;
  term.maxAmount = 10000000;
  assert.deepEqual(quote({ plan, price: 20000000, downPayment: 1000000 }).cappedBy, ['ltv', 'maxAmount']);
  const result = quote({ plan, price: 3, downPayment: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.eligible, 1);
  assert.ok(result.eligible <= 1.5);
  assert.equal(quote({ plan, price: 0.5, downPayment: 0 }).ok, false);
});

test('TNA cero sin coeficiente: capital dividido por meses', () => {
  const plan = PLANS.find((item) => item.id === 'fiat-demo-cero');
  const result = quote({ plan, months: 12, downPayment: 22000000 });
  assert.equal(result.method, 'zero');
  assert.equal(result.installment, 833333);
  assert.equal(result.totalInstallments, 9999996);
  assert.equal(result.expenses, 300000);
});

test('sistema francés y prioridad de coeficiente explícito', () => {
  const plan = PLANS.find((item) => item.id === 'banco-uno-flex');
  const term = plan.terms.find((item) => item.months === 36);
  const result = quote({ plan, months: term.months });
  const rate = term.tna / 100 / 12;
  const power = (1 + rate) ** term.months;
  const reference = Math.round(result.eligible * rate * power / (power - 1));
  assert.equal(result.method, 'french');
  assert.equal(result.installment, reference);
  assert.equal(calculateInstallment(1000, { months: 10, tna: 0, installmentCoefficient: 0.2 }), 200);
});

test('rechaza precios y anticipos inválidos, incluidos anticipo igual al precio y no finitos', () => {
  for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    assert.ok(quote({ price }).errors.price);
  }
  for (const downPayment of [-1, 32000001, 32000000, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.ok(quote({ downPayment }).errors.downPayment);
  }
  assert.deepEqual(validateAmounts(100, 0), {});
  assert.equal(quote({ downPayment: 0 }).ok, true);
});

test('vigencia inclusiva, fechas inválidas, planes futuros y vencidos', () => {
  assert.equal(getPlanStatus(initialPlan, initialPlan.validFrom), 'active');
  assert.equal(getPlanStatus(initialPlan, initialPlan.validTo), 'active');
  assert.equal(getPlanStatus(initialPlan, '2026-09-30'), 'upcoming');
  assert.equal(getPlanStatus(initialPlan, '2028-01-01'), 'expired');
  assert.equal(getPlanStatus({ ...initialPlan, validFrom: '2026-02-30' }, asOf), 'invalid');
  assert.equal(getPlanStatus({ ...initialPlan, validFrom: '2028-01-01' }, asOf), 'invalid');
  assert.equal(getPlanStatus(null, asOf), 'invalid');
  assert.equal(quote({ asOf: '2028-01-01' }).ok, false);
  assert.equal(quote({ plan: PLANS.find((item) => item.id === 'demo-archivo'), months: 12 }).ok, false);
  assert.equal(quote({ asOf: '2026-09-30' }).ok, false);
});

test('compatibilidad de modelo y cliente; demo y moneda obligatorios', () => {
  const plan = PLANS.find((item) => item.id === 'banco-dos-trabajo');
  assert.equal(quote({ plan }).ok, false);
  assert.equal(quote({ plan, modelId: 'toro', customerType: 'business' }).ok, true);
  assert.equal(isPlanAvailable(plan, { ...input, modelId: 'toro', customerType: 'business' }), true);
  assert.equal(isPlanAvailable(plan, input), false);
  assert.equal(quote({ plan: { ...initialPlan, demo: false } }).ok, false);
  assert.equal(quote({ plan: { ...initialPlan, currency: 'USD' } }).ok, false);
  assert.equal(quote({ plan: undefined }).ok, false);
  assert.equal(quote({ months: 99 }).ok, false);
});

test('condiciones mal configuradas fallan de forma segura', () => {
  for (const terms of [undefined, null, {}, [null]]) {
    assert.equal(quote({ plan: { ...initialPlan, terms } }).ok, false);
  }
  for (const override of [
    { tna: -1 }, { cft: Number.NaN }, { maxLtvPct: 101 }, { maxLtvPct: 0 },
    { maxAmount: 0 }, { expensePct: -1 }, { installmentCoefficient: 0 },
    { installmentCoefficient: Number.POSITIVE_INFINITY },
  ]) {
    const plan = structuredClone(initialPlan);
    Object.assign(plan.terms.find((item) => item.months === input.months), override);
    assert.equal(quote({ plan }).ok, false);
  }
});

test('datos demo centralizados: IDs únicos, versiones compatibles y siete planes explícitos', () => {
  assert.equal(MODELS.length, 6);
  assert.ok(PLANS.length >= 6 && PLANS.length <= 8);
  assert.equal(new Set(PLANS.map((plan) => plan.id)).size, PLANS.length);
  const versionIds = MODELS.flatMap((model) => model.versions.map((version) => version.id));
  assert.equal(new Set(versionIds).size, versionIds.length);
  PLANS.forEach((plan) => {
    assert.equal(plan.demo, true);
    assert.equal(plan.currency, DEMO_META.currency);
    assert.ok(plan.modelIds.every((id) => MODELS.some((model) => model.id === id)));
    assert.ok(plan.customerTypes.every((id) => CUSTOMER_TYPES.some((type) => type.id === id)));
    assert.equal(new Set(plan.terms.map((term) => term.months)).size, plan.terms.length);
  });
});

test('invariantes en más de mil escenarios determinísticos: nunca se supera solicitado, LTV ni máximo', () => {
  let scenarios = 0;
  let seed = 20261015;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  PLANS.filter((plan) => getPlanStatus(plan, asOf) === 'active').forEach((plan) => {
    plan.terms.forEach((term) => {
      for (let index = 0; index < 100; index += 1) {
        const price = 1000000 + Math.floor(random() * 99000000);
        const downPayment = Math.floor(random() * price);
        const result = quote({ plan, months: term.months, price, downPayment, modelId: plan.modelIds[0], customerType: plan.customerTypes[0] });
        assert.equal(result.ok, true);
        assert.ok(result.eligible <= price - downPayment);
        assert.ok(result.eligible <= price * term.maxLtvPct / 100);
        assert.ok(result.eligible <= term.maxAmount);
        assert.equal(result.eligible + result.gap, result.requested);
        assert.equal(result.requiredDownPayment + result.eligible, result.price);
        assert.equal(result.installment * result.months, result.totalInstallments);
        for (const key of ['eligible', 'expenses', 'installment', 'totalInstallments', 'gap']) assert.ok(Number.isSafeInteger(result[key]));
        scenarios += 1;
      }
    });
  });
  assert.ok(scenarios > 1000);
});
