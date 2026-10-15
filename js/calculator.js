/** Motor puro: no conoce el DOM, localStorage, modelos ni tasas de la demo. */
export const roundMoney = (amount) => Math.round(amount);

function dateKey(date) {
  if (typeof date === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const parsed = new Date(`${date}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
  }
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Vigencia inclusiva; se usa la fecha local del dispositivo, no la fecha de actualización. */
export function getPlanStatus(plan, asOf = new Date()) {
  const today = dateKey(asOf);
  const from = dateKey(plan?.validFrom);
  const to = dateKey(plan?.validTo);
  if (!today || !from || !to || from > to) return 'invalid';
  if (today < from) return 'upcoming';
  if (today > to) return 'expired';
  return 'active';
}

export function isPlanAvailable(plan, { modelId, customerType, asOf = new Date() }) {
  return plan?.demo === true
    && plan.currency === 'ARS'
    && getPlanStatus(plan, asOf) === 'active'
    && Array.isArray(plan.modelIds) && plan.modelIds.includes(modelId)
    && Array.isArray(plan.customerTypes) && plan.customerTypes.includes(customerType);
}

export function validateAmounts(price, downPayment) {
  const errors = {};
  if (!Number.isFinite(price) || price <= 0 || price > Number.MAX_SAFE_INTEGER) {
    errors.price = 'Ingresá un precio de lista mayor que cero y dentro de un rango válido.';
  }
  if (!Number.isFinite(downPayment) || downPayment < 0 || downPayment > Number.MAX_SAFE_INTEGER) {
    errors.downPayment = 'Ingresá un anticipo de cero o más pesos.';
  } else if (!errors.price && downPayment > price) {
    errors.downPayment = 'El anticipo no puede superar el precio de lista.';
  } else if (!errors.price && downPayment === price) {
    errors.downPayment = 'El anticipo debe ser menor al precio: el monto solicitado tiene que ser mayor que cero.';
  }
  return errors;
}

function validTerm(term) {
  return term && Number.isSafeInteger(term.months) && term.months > 0
    && Number.isFinite(term.tna) && term.tna >= 0
    && Number.isFinite(term.cft) && term.cft >= 0
    && Number.isFinite(term.maxLtvPct) && term.maxLtvPct > 0 && term.maxLtvPct <= 100
    && Number.isFinite(term.maxAmount) && term.maxAmount >= 1
    && Number.isFinite(term.expensePct) && term.expensePct >= 0
    && (term.installmentCoefficient == null
      || (Number.isFinite(term.installmentCoefficient) && term.installmentCoefficient > 0));
}

/**
 * Coeficiente explícito > sistema francés > capital / meses para TNA cero.
 * La forma con exponente negativo evita overflow en potencias positivas.
 */
export function calculateInstallment(principal, term) {
  if (term.installmentCoefficient != null) return principal * term.installmentCoefficient;
  const monthlyRate = term.tna / 100 / 12;
  if (monthlyRate === 0) return principal / term.months;
  const denominator = -Math.expm1(-term.months * Math.log1p(monthlyRate));
  return principal * monthlyRate / denominator;
}

export function calculateQuote({ price, downPayment, modelId, customerType, plan, months, asOf = new Date() }) {
  const errors = validateAmounts(price, downPayment);
  if (!modelId) errors.modelId = 'Seleccioná un modelo.';
  if (!customerType) errors.customerType = 'Seleccioná un tipo de cliente.';
  if (!plan) {
    errors.planId = 'Seleccioná un plan disponible.';
  } else if (plan.demo !== true || plan.currency !== 'ARS') {
    errors.planId = 'Sólo se habilitan planes demo en pesos argentinos.';
  } else if (getPlanStatus(plan, asOf) !== 'active') {
    errors.planId = 'Este plan está vencido, aún no está vigente o tiene fechas inválidas.';
  } else if (!isPlanAvailable(plan, { modelId, customerType, asOf })) {
    errors.planId = 'El plan no es compatible con el modelo o el tipo de cliente.';
  }
  const term = Array.isArray(plan?.terms) ? plan.terms.find((item) => item?.months === months) : undefined;
  if (!validTerm(term)) errors.months = 'Seleccioná un plazo con condiciones válidas.';
  if (Object.keys(errors).length) return { ok: false, errors };

  const requested = price - downPayment;
  const ltvLimit = price * term.maxLtvPct / 100;
  // Hacia abajo al aplicar los topes: redondear al más cercano podría exceder el LTV.
  const eligible = Math.floor(Math.min(requested, ltvLimit, term.maxAmount));
  if (eligible <= 0) {
    return { ok: false, errors: { downPayment: 'El monto elegible debe alcanzar al menos un peso.' } };
  }
  const rawInstallment = calculateInstallment(eligible, term);
  const rawExpenses = eligible * term.expensePct / 100;
  if (![rawInstallment, rawExpenses, rawInstallment * months].every(Number.isFinite)
    || Math.max(rawInstallment, rawExpenses, rawInstallment * months) > Number.MAX_SAFE_INTEGER) {
    return { ok: false, errors: { price: 'Los importes exceden el rango de cálculo seguro.' } };
  }
  const installment = roundMoney(rawInstallment);
  if (!Number.isSafeInteger(installment * months)) {
    return { ok: false, errors: { price: 'El total nominal excede el rango de cálculo seguro.' } };
  }
  const gap = roundMoney(requested - eligible);
  const cappedBy = [];
  if (requested > ltvLimit && ltvLimit <= term.maxAmount) cappedBy.push('ltv');
  if (requested > term.maxAmount && term.maxAmount <= ltvLimit) cappedBy.push('maxAmount');

  return {
    ok: true,
    price: roundMoney(price), downPayment: roundMoney(downPayment),
    requested: roundMoney(requested), eligible,
    ltvLimit: Math.floor(ltvLimit), maxAmount: Math.floor(term.maxAmount),
    expenses: roundMoney(rawExpenses), installment,
    // Total de las cuotas exhibidas, coherente con el redondeo a pesos de la UI.
    totalInstallments: installment * months,
    gap, requiredDownPayment: roundMoney(price - eligible),
    months, tna: term.tna, cft: term.cft, maxLtvPct: term.maxLtvPct,
    expensePct: term.expensePct, cappedBy,
    method: term.installmentCoefficient != null ? 'coefficient' : term.tna === 0 ? 'zero' : 'french',
    planId: plan.id, entity: plan.entity, planName: plan.name,
    modelId, customerType, calculatedOn: dateKey(asOf),
  };
}
