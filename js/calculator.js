/** Motor puro: no conoce DOM, almacenamiento ni catálogo. Recibe la marca, el modelo y el plan. */
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
  if (plan?.status === 'pending') return 'pending';
  const today = dateKey(asOf);
  const from = dateKey(plan?.validFrom);
  const to = dateKey(plan?.validTo);
  if (!today || !from || !to || from > to) return 'invalid';
  if (today < from) return 'upcoming';
  if (today > to) return 'expired';
  return 'active';
}

export function isPlanCompatible(plan, { brandId, modelId, versionId = '', customerType }) {
  return plan?.dataStatus === 'commercial-circular'
    && Boolean(brandId) && plan.brandId === brandId
    && plan.currency === 'ARS'
    && Array.isArray(plan.modelIds) && plan.modelIds.includes(modelId)
    && Array.isArray(plan.customerTypes) && plan.customerTypes.includes(customerType)
    && (plan.versionIds === undefined || (Array.isArray(plan.versionIds) && plan.versionIds.includes(versionId)));
}

export function isPlanAvailable(plan, selection) {
  return isPlanCompatible(plan, selection) && getPlanStatus(plan, selection.asOf ?? new Date()) === 'active';
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
    && Number.isFinite(term.dealerContributionPct) && term.dealerContributionPct >= 0 && term.dealerContributionPct <= 100
    && Number.isFinite(term.installmentPerThousandWithVat) && term.installmentPerThousandWithVat > 0;
}

/** Coeficiente de la circular, incluso con TNA cero. No hay fallback financiero ni proyección UVA. */
export function calculateInstallment(principal, term) {
  return principal / 1000 * term.installmentPerThousandWithVat;
}

export function calculateQuote({ price, downPayment, brandId, modelId, versionId = '', model, customerType, plan, months, asOf = new Date() }) {
  const errors = validateAmounts(price, downPayment);
  if (!brandId) errors.brandId = 'Seleccioná una marca.';
  if (!modelId || !model || model.id !== modelId || model.brandId !== brandId || !Array.isArray(model.versions)) {
    errors.modelId = 'Seleccioná un modelo de la marca activa.';
  } else if ((model.versions.length && !model.versions.some((version) => version.id === versionId))
    || (!model.versions.length && versionId)) {
    errors.versionId = 'Seleccioná una versión compatible con el modelo.';
  }
  if (!customerType) errors.customerType = 'Seleccioná un tipo de cliente.';
  if (!plan) {
    errors.planId = 'Seleccioná un plan disponible.';
  } else if (plan.dataStatus !== 'commercial-circular' || plan.currency !== 'ARS') {
    errors.planId = 'Se requiere un plan de una circular comercial en pesos argentinos.';
  } else if (plan.brandId !== brandId) {
    errors.planId = 'No se permiten planes de otra marca.';
  } else if (getPlanStatus(plan, asOf) !== 'active') {
    errors.planId = 'La circular está vencida, aún no está vigente o tiene fechas inválidas. Se necesita una circular vigente.';
  } else if (!isPlanCompatible(plan, { brandId, modelId, versionId, customerType })) {
    errors.planId = 'El plan no es compatible con el modelo, la versión o el tipo de cliente.';
  } else if (!Number.isFinite(plan.maxLtvPct) || plan.maxLtvPct <= 0 || plan.maxLtvPct > 100
    || !Number.isFinite(plan.maxAmount) || plan.maxAmount < 1 || plan.maxAmount > Number.MAX_SAFE_INTEGER
    || typeof plan.isUva !== 'boolean' || !plan.source?.circular || !plan.source?.filename
    || !Number.isSafeInteger(plan.source?.page) || plan.source.page < 1) {
    errors.planId = 'El plan no tiene topes o metadatos de fuente válidos.';
  }
  const term = Array.isArray(plan?.terms) ? plan.terms.find((item) => item?.months === months) : undefined;
  if (!validTerm(term)) errors.months = 'Seleccioná un plazo con condiciones válidas.';
  if (Object.keys(errors).length) return { ok: false, errors };

  const requested = price - downPayment;
  const ltvLimit = price * plan.maxLtvPct / 100;
  // Hacia abajo al aplicar los topes: redondear al más cercano podría exceder el LTV.
  const eligible = Math.floor(Math.min(requested, ltvLimit, plan.maxAmount));
  if (eligible <= 0) {
    return { ok: false, errors: { downPayment: 'El monto elegible debe alcanzar al menos un peso.' } };
  }
  const rawInstallment = calculateInstallment(eligible, term);
  if (![rawInstallment, rawInstallment * months].every(Number.isFinite)
    || Math.max(rawInstallment, rawInstallment * months) > Number.MAX_SAFE_INTEGER) {
    return { ok: false, errors: { price: 'Los importes exceden el rango de cálculo seguro.' } };
  }
  const installment = roundMoney(rawInstallment);
  if (!Number.isSafeInteger(installment * months)) {
    return { ok: false, errors: { price: 'El total nominal excede el rango de cálculo seguro.' } };
  }
  const gap = roundMoney(requested - eligible);
  const cappedBy = [];
  if (requested > ltvLimit && ltvLimit <= plan.maxAmount) cappedBy.push('ltv');
  if (requested > plan.maxAmount && plan.maxAmount <= ltvLimit) cappedBy.push('maxAmount');

  return {
    ok: true,
    price: roundMoney(price), downPayment: roundMoney(downPayment),
    requested: roundMoney(requested), eligible,
    ltvLimit: Math.floor(ltvLimit), maxAmount: Math.floor(plan.maxAmount), installment,
    // Total de las cuotas exhibidas, coherente con el redondeo a pesos de la UI.
    totalInstallments: installment * months,
    gap, requiredDownPayment: roundMoney(price - eligible),
    months, tna: term.tna, cft: null, maxLtvPct: plan.maxLtvPct,
    dealerContributionPct: term.dealerContributionPct,
    installmentPerThousandWithVat: term.installmentPerThousandWithVat,
    cappedBy, isUva: plan.isUva, method: 'circular-per-thousand',
    planId: plan.id, entity: plan.entity, planName: plan.name,
    brandId, modelId, versionId, customerType, channel: plan.channel,
    source: { ...plan.source }, validFrom: plan.validFrom, validTo: plan.validTo,
    calculatedOn: dateKey(asOf),
  };
}
