import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInstallment, calculateQuote, getPlanStatus, isPlanAvailable, validateAmounts } from '../js/calculator.js';
import { APP_META, BRANDS, CUSTOMER_TYPES, MODELS_BY_BRAND, PLANS_BY_BRAND } from '../js/commercial-data.js';

const asOf = '2026-10-15';
const allPlans = Object.values(PLANS_BY_BRAND).flat();
const planById = (id) => allPlans.find((plan) => plan.id === id);
const initialPlan = planById('fiat-gama-24');

function selection(plan, overrides = {}) {
  const model = MODELS_BY_BRAND[plan.brandId].find((item) => item.id === (overrides.modelId ?? plan.modelIds[0]));
  return {
    brandId: plan.brandId, modelId: model?.id, model,
    versionId: plan.versionIds?.[0] ?? model?.versions[0]?.id ?? '',
    customerType: 'individual', plan, months: plan.terms[0].months,
    price: 20000000, downPayment: 10000000, asOf, ...overrides,
  };
}
const quote = (overrides = {}) => calculateQuote(selection(initialPlan, overrides));

test('cuotas obligatorias por $1.000: 84,33 / 56,22 / 47,83, con redondeo final', () => {
  assert.equal(quote().installment, 843300);
  assert.equal(calculateQuote(selection(planById('fiat-gama-18'))).installment, 562200);
  assert.equal(calculateQuote(selection(planById('peugeot-express-18'), { months: 24 })).installment, 478300);
  const result = quote();
  assert.equal(result.eligible, 10000000);
  assert.equal(result.gap, 0);
  assert.equal(result.totalInstallments, result.installment * result.months);
  assert.equal(result.method, 'circular-per-thousand');
  assert.equal(calculateInstallment(10000000, { installmentPerThousandWithVat: 84.33 }), 843300);
});

test('aporte CE no modifica cuota, anticipo, capital ni diferencia; CFT no se inventa', () => {
  const result = quote();
  for (const dealerContributionPct of [0, 8, 12, 99]) {
    const plan = structuredClone(initialPlan);
    plan.terms[0].dealerContributionPct = dealerContributionPct;
    const modified = quote({ plan });
    assert.equal(modified.dealerContributionPct, dealerContributionPct);
    for (const key of ['installment', 'eligible', 'downPayment', 'gap', 'requiredDownPayment', 'totalInstallments']) assert.equal(modified[key], result[key]);
    assert.equal(modified.cft, null);
    assert.equal(modified.expenses, undefined);
    assert.equal(modified.expensePct, undefined);
  }
});

test('coeficiente tiene prioridad sobre TNA, incluso con tasa cero; nunca usa un fallback', () => {
  const plan = structuredClone(initialPlan);
  plan.terms[0].tna = 99;
  assert.equal(quote({ plan }).installment, 843300);
  delete plan.terms[0].installmentPerThousandWithVat;
  assert.equal(quote({ plan }).ok, false);
});

test('LTV de pesos: 80% siempre sobre precio de lista, con aviso de anticipo adicional', () => {
  const result = quote({ price: 20000000, downPayment: 1000000 });
  assert.equal(result.ok, true);
  assert.equal(result.eligible, 16000000);
  assert.equal(result.gap, 3000000);
  assert.equal(result.requiredDownPayment, 4000000);
  assert.deepEqual(result.cappedBy, ['ltv']);
});

test('tope promocional de monto y anticipos: no se reemplaza por el máximo general de riesgos', () => {
  const result = quote({ price: 60000000, downPayment: 30000000 });
  assert.equal(result.eligible, 24000000);
  assert.equal(result.gap, 6000000);
  assert.equal(result.requiredDownPayment, 36000000);
  assert.deepEqual(result.cappedBy, ['maxAmount']);
});

test('topes coincidentes y redondeo conservador del capital', () => {
  const plan = { ...initialPlan, maxLtvPct: 50, maxAmount: 10000000 };
  assert.deepEqual(quote({ plan, downPayment: 1000000 }).cappedBy, ['ltv', 'maxAmount']);
  const result = quote({ plan, price: 3, downPayment: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.eligible, 1);
  assert.ok(result.eligible <= 1.5);
  assert.equal(quote({ plan, price: 0.5, downPayment: 0 }).ok, false);
});

test('UVA por marca: LTV 70%, cuota inicial por coeficiente, sin proyección del capital', () => {
  for (const brandId of ['fiat', 'jeep', 'peugeot', 'citroen']) {
    const plan = PLANS_BY_BRAND[brandId].find((item) => item.isUva);
    const result = calculateQuote(selection(plan, { downPayment: 0 }));
    assert.equal(result.ok, true);
    assert.equal(result.isUva, true);
    assert.equal(result.maxLtvPct, 70);
    assert.equal(result.eligible, 14000000);
    assert.equal(result.installment, Math.round(result.eligible / 1000 * plan.terms[0].installmentPerThousandWithVat));
    assert.equal(result.totalInstallments, result.installment * result.months);
  }
  assert.ok(PLANS_BY_BRAND.ram.every((plan) => plan.isUva === false));
});

test('Jeep y RAM nunca comparten planes al cotizar o al resolver alternativas', () => {
  const jeepPlan = planById('jeep-gama-24');
  const ramPlan = planById('ram-gama-20');
  const jeep = selection(jeepPlan);
  assert.equal(isPlanAvailable(jeepPlan, jeep), true);
  assert.equal(isPlanAvailable(ramPlan, jeep), false);
  assert.equal(calculateQuote({ ...jeep, plan: ramPlan }).ok, false);
  assert.equal(calculateQuote({ ...selection(ramPlan), plan: jeepPlan }).ok, false);
  assert.equal(quote({ brandId: 'jeep' }).ok, false);
});

test('Compass Sport: sólo esa versión, sólo a 24 meses; Renegade y Commander no acceden', () => {
  const plan = planById('jeep-compass-sport-28');
  const sport = selection(plan);
  assert.equal(calculateQuote(sport).installment, 421700);
  assert.equal(isPlanAvailable(plan, sport), true);
  assert.equal(calculateQuote({ ...sport, versionId: 'compass-other' }).ok, false);
  assert.equal(calculateQuote({ ...sport, versionId: '' }).ok, false);
  assert.equal(calculateQuote({ ...sport, months: 12 }).ok, false);
  for (const modelId of ['renegade', 'commander']) {
    const model = MODELS_BY_BRAND.jeep.find((item) => item.id === modelId);
    assert.equal(calculateQuote({ ...sport, modelId, model, versionId: '' }).ok, false);
  }
});

test('Peugeot: tope general 36 M y especial 45 M sólo para Boxer, 3008, 5008 y 408', () => {
  const general = planById('peugeot-ampliada-36');
  const special = planById('peugeot-ampliada-45');
  const amounts = { price: 100000000, downPayment: 0 };
  assert.equal(calculateQuote(selection(general, amounts)).eligible, 36000000);
  assert.equal(calculateQuote({ ...selection(general, amounts), plan: special }).ok, false);
  for (const modelId of ['boxer', '3008', '5008', '408']) {
    const result = calculateQuote(selection(special, { ...amounts, modelId }));
    assert.equal(result.eligible, 45000000);
  }
});

test('Citroën: 45 M sólo para Jumper; C4 y C5 Aircross conservan 36 M', () => {
  const general = planById('citroen-ampliada-36');
  const special = planById('citroen-ampliada-45');
  const amounts = { price: 100000000, downPayment: 0 };
  assert.equal(calculateQuote(selection(special, amounts)).eligible, 45000000);
  for (const modelId of ['c4', 'c5-aircross']) {
    const input = selection(general, { ...amounts, modelId });
    assert.equal(calculateQuote(input).eligible, 36000000);
    assert.equal(calculateQuote({ ...input, plan: special }).ok, false);
  }
});

test('modelos sin versiones o precio precargado admiten únicamente precios manuales válidos', () => {
  for (const [brandId, modelId] of [['fiat', 'titano'], ['fiat', 'fiat-600'], ['ram', 'dakota'], ['citroen', 'jumper']]) {
    const model = MODELS_BY_BRAND[brandId].find((item) => item.id === modelId);
    assert.equal(model.price, null);
    assert.deepEqual(model.versions, []);
    const plan = PLANS_BY_BRAND[brandId].find((item) => item.modelIds.includes(modelId));
    const input = selection(plan, { modelId });
    assert.equal(calculateQuote({ ...input, price: Number.NaN }).ok, false);
    assert.equal(calculateQuote(input).ok, true);
    assert.equal(calculateQuote({ ...input, versionId: 'version-inventada' }).ok, false);
  }
});

test('GM / Chevrolet y BYD pendientes: sin modelos, precios, tasas ni planes', () => {
  for (const brandId of ['gm', 'byd']) {
    const brand = BRANDS.find((item) => item.id === brandId);
    assert.equal(getPlanStatus(brand, asOf), 'pending');
    assert.deepEqual(MODELS_BY_BRAND[brandId], []);
    assert.deepEqual(PLANS_BY_BRAND[brandId], []);
    assert.equal(brand.sourceFile, undefined);
    assert.equal(quote({ brandId, modelId: '', model: undefined, plan: undefined }).ok, false);
  }
  assert.equal(BRANDS.find((brand) => brand.id === 'byd').logo, null);
});

test('rechaza precios y anticipos inválidos, incluidos anticipo igual al precio y no finitos', () => {
  for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) assert.ok(quote({ price }).errors.price);
  for (const downPayment of [-1, 20000001, 20000000, Number.NaN, Number.POSITIVE_INFINITY]) assert.ok(quote({ downPayment }).errors.downPayment);
  assert.deepEqual(validateAmounts(100, 0), {});
  assert.equal(quote({ downPayment: 0 }).ok, true);
});

test('vigencia real e inclusiva de octubre: próxima, activa al 15/10 y vencida desde 01/11', () => {
  for (const plan of allPlans) {
    assert.equal(plan.validFrom, '2026-10-01');
    assert.equal(plan.validTo, '2026-10-31');
    assert.equal(getPlanStatus(plan, '2026-09-30'), 'upcoming');
    for (const date of ['2026-10-01', asOf, '2026-10-31']) {
      assert.equal(getPlanStatus(plan, date), 'active');
      assert.equal(calculateQuote(selection(plan, { asOf: date })).ok, true);
    }
    assert.equal(getPlanStatus(plan, '2026-11-01'), 'expired');
    assert.equal(calculateQuote(selection(plan, { asOf: '2026-11-01' })).ok, false);
    assert.equal(calculateQuote(selection(plan, { asOf: '2026-09-30' })).ok, false);
  }
  assert.equal(getPlanStatus({ ...initialPlan, validFrom: '2026-02-30' }, asOf), 'invalid');
  assert.equal(getPlanStatus({ ...initialPlan, validFrom: '2028-01-01' }, asOf), 'invalid');
  assert.equal(getPlanStatus(null, asOf), 'invalid');
});

test('rechaza planes demo antiguos, monedas no admitidas y modelos/clientes/plazos incompatibles', () => {
  assert.equal(quote({ plan: { ...initialPlan, dataStatus: 'demo', demo: true } }).ok, false);
  assert.equal(quote({ plan: { ...initialPlan, currency: 'USD' } }).ok, false);
  assert.equal(quote({ customerType: 'desconocido' }).ok, false);
  assert.equal(quote({ modelId: 'modelo-inexistente' }).ok, false);
  assert.equal(quote({ model: undefined }).ok, false);
  assert.equal(quote({ plan: undefined }).ok, false);
  assert.equal(quote({ months: 99 }).ok, false);
});

test('condiciones o fuentes mal configuradas fallan sin lanzar excepciones', () => {
  for (const terms of [undefined, null, {}, [null]]) assert.equal(quote({ plan: { ...initialPlan, terms } }).ok, false);
  for (const override of [{ maxLtvPct: 101 }, { maxLtvPct: 0 }, { maxAmount: 0 }, { isUva: undefined }, { source: null }]) {
    assert.equal(quote({ plan: { ...initialPlan, ...override } }).ok, false);
  }
  for (const override of [{ tna: -1 }, { dealerContributionPct: -1 }, { installmentPerThousandWithVat: 0 }, { installmentPerThousandWithVat: Number.NaN }]) {
    const plan = structuredClone(initialPlan);
    Object.assign(plan.terms[0], override);
    assert.equal(quote({ plan }).ok, false);
  }
});

test('datos y fuentes centralizados: 23 planes, 109 plazos, IDs y referencias válidos', () => {
  assert.equal(BRANDS.length, 7);
  assert.equal(allPlans.length, 23);
  assert.equal(allPlans.reduce((count, plan) => count + plan.terms.length, 0), 109);
  assert.equal(new Set(allPlans.map((plan) => plan.id)).size, allPlans.length);
  assert.deepEqual(Object.values(PLANS_BY_BRAND).map((plans) => plans.length), [5, 5, 3, 5, 5, 0, 0]);
  for (const brand of BRANDS.filter((item) => item.status === 'active')) {
    const models = MODELS_BY_BRAND[brand.id];
    assert.equal(new Set(models.map((model) => model.id)).size, models.length);
    for (const plan of PLANS_BY_BRAND[brand.id]) {
      assert.equal(plan.brandId, brand.id);
      assert.equal(plan.dataStatus, 'commercial-circular');
      assert.equal(plan.currency, APP_META.currency);
      assert.equal(plan.channel, 'TRAD');
      assert.equal(plan.maxLtvPct, plan.isUva ? 70 : 80);
      assert.equal(plan.source.circular, brand.sourceLabel);
      assert.equal(plan.source.filename, brand.sourceFile);
      assert.equal(plan.source.page, 3);
      assert.equal(plan.source.ltvPage, brand.riskPage);
      assert.ok(plan.modelIds.every((id) => models.some((model) => model.id === id)));
      assert.ok(plan.customerTypes.every((id) => CUSTOMER_TYPES.some((type) => type.id === id)));
      assert.equal(new Set(plan.terms.map((term) => term.months)).size, plan.terms.length);
      if (plan.versionIds) assert.ok(plan.versionIds.every((id) => models.flatMap((model) => model.versions).some((version) => version.id === id)));
      for (const term of plan.terms) {
        assert.equal(term.cft, undefined);
        assert.equal(term.expensePct, undefined);
        assert.equal(term.installmentCoefficient, undefined);
      }
    }
  }
});

test('10.900 escenarios determinísticos: solicitado, LTV y máximo nunca se superan', () => {
  let scenarios = 0;
  let seed = 20261015;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  allPlans.forEach((plan) => {
    plan.terms.forEach((term) => {
      for (let index = 0; index < 100; index += 1) {
        const price = 1000000 + Math.floor(random() * 99000000);
        const downPayment = Math.floor(random() * price);
        const result = calculateQuote(selection(plan, { months: term.months, price, downPayment }));
        assert.equal(result.ok, true);
        assert.ok(result.eligible <= price - downPayment);
        assert.ok(result.eligible <= price * plan.maxLtvPct / 100);
        assert.ok(result.eligible <= plan.maxAmount);
        assert.equal(result.eligible + result.gap, result.requested);
        assert.equal(result.requiredDownPayment + result.eligible, result.price);
        assert.equal(result.installment * result.months, result.totalInstallments);
        assert.equal(result.installment, Math.round(result.eligible / 1000 * term.installmentPerThousandWithVat));
        for (const key of ['eligible', 'installment', 'totalInstallments', 'gap']) assert.ok(Number.isSafeInteger(result[key]));
        scenarios += 1;
      }
    });
  });
  assert.equal(scenarios, 10900);
});
