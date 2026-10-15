import { APP_META, BRANDS, CUSTOMER_TYPES, DEFAULT_SELECTION, DEFAULTS_BY_BRAND, MODELS_BY_BRAND, PLANS_BY_BRAND } from './commercial-data.js';
import { calculateQuote, getPlanStatus, isPlanAvailable, validateAmounts } from './calculator.js';

const STORAGE_KEY = 'grp-finance-poc:v2';
const LEGACY_STORAGE_KEY = 'grp-finance-poc:v1';
const $ = (selector) => document.querySelector(selector);
const moneyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: APP_META.currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const coefficientFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: APP_META.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integerFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const money = (value) => moneyFormatter.format(value);
const percent = (value) => `${percentFormatter.format(value)} %`;
const formatDate = (value) => value ? dateFormatter.format(new Date(`${value}T12:00:00`)) : 'No informado';
const customerName = (id) => CUSTOMER_TYPES.find((type) => type.id === id)?.name ?? 'Sin seleccionar';
const brandById = (id) => BRANDS.find((brand) => brand.id === id);
const currentBrand = () => brandById(activeBrandId);
const currentModels = () => MODELS_BY_BRAND[activeBrandId];
const currentPlans = () => PLANS_BY_BRAND[activeBrandId];
const defaults = () => DEFAULTS_BY_BRAND[activeBrandId];
const planById = (id, brandId = activeBrandId) => PLANS_BY_BRAND[brandId]?.find((plan) => plan.id === id);
const fieldMap = {
  modelId: ['#model', '#model-error'], versionId: ['#version', '#version-error'],
  price: ['#price', '#price-error'], downPayment: ['#down-payment', '#down-payment-error'],
  planId: ['#plan', '#plan-error'], months: ['#term', '#term-error'],
};
let activeTab = 'quote';
let activeBrandId = DEFAULT_SELECTION.brandId;
let lastAvailabilityStatus = '';
let lastQuote = null;
let lastComparison = null;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function text(selector, value) {
  $(selector).textContent = value;
}

/** Pesos enteros: se aceptan 32000000 y 32.000.000, no notación científica ni decimales. */
function parsePesos(value) {
  const normalized = value.trim().replace(/[$\s\u00a0]/g, '');
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(normalized)) return Number.NaN;
  return Number(normalized.replaceAll('.', ''));
}

function fillSelect(select, items, preferred, { placeholder, autoSelect = true } = {}) {
  select.replaceChildren();
  if (placeholder || !items.length) select.append(new Option(placeholder ?? 'Sin opciones disponibles', ''));
  items.forEach((item) => select.append(new Option(item.label, String(item.value))));
  const match = items.find((item) => String(item.value) === String(preferred));
  select.value = match ? String(match.value) : autoSelect && items.length ? String(items[0].value) : '';
  select.disabled = !items.length;
}

function readSelection() {
  return {
    brandId: activeBrandId,
    modelId: $('#model').value,
    versionId: $('#version').value,
    price: parsePesos($('#price').value),
    downPayment: parsePesos($('#down-payment').value),
    customerType: $('input[name="customerType"]:checked')?.value ?? '',
    planId: $('#plan').value,
    months: Number($('#term').value),
  };
}

function getVehicle(selection = readSelection()) {
  const model = MODELS_BY_BRAND[selection.brandId]?.find((item) => item.id === selection.modelId);
  const version = model?.versions.find((item) => item.id === selection.versionId);
  return { model, version };
}

function vehicleErrors(selection) {
  const { model, version } = getVehicle(selection);
  const errors = {};
  if (!model) errors.modelId = `Seleccioná un modelo ${brandById(selection.brandId)?.name ?? 'de la marca activa'}.`;
  if (model && ((model.versions.length && !version) || (!model.versions.length && selection.versionId))) {
    errors.versionId = 'Seleccioná una versión compatible con el modelo.';
  }
  if (!CUSTOMER_TYPES.some((type) => type.id === selection.customerType)) errors.customerType = 'Seleccioná el tipo de cliente.';
  return errors;
}

function quoteForSelection(selection, plan = planById(selection.planId, selection.brandId)) {
  return calculateQuote({ ...selection, model: getVehicle(selection).model, plan });
}

function evaluateSelection(selection = readSelection()) {
  const result = quoteForSelection(selection);
  const errors = { ...(result.errors ?? {}), ...vehicleErrors(selection) };
  for (const [key, selector] of [['price', '#price'], ['downPayment', '#down-payment']]) {
    if ($(selector).value.trim() && Number.isNaN(selection[key])) {
      errors[key] = 'Usá pesos enteros, por ejemplo 32.000.000, sin centavos.';
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : result;
}

function availablePlans() {
  const selection = readSelection();
  return currentPlans().filter((plan) => isPlanAvailable(plan, selection));
}

function planOptions(plans) {
  return plans.map((plan) => ({ value: plan.id, label: `${plan.entity} — ${plan.name}${plan.isUva ? ' · UVA' : ''}` }));
}

function fillTerms(select, planId, preferred) {
  const plan = planById(planId);
  fillSelect(select, (plan?.terms ?? []).map((term) => ({ value: term.months, label: `${term.months} meses` })), preferred);
}

function fillVersions(preferred) {
  const model = currentModels().find((item) => item.id === $('#model').value);
  fillSelect($('#version'), (model?.versions ?? []).map((version) => ({ value: version.id, label: version.name })), preferred, {
    placeholder: model ? model.versions.length ? undefined : 'Sin versión específica' : 'Elegí un modelo primero',
  });
  $('#version').required = Boolean(model?.versions.length);
  text('#version-hint', model && !model.versions.length ? 'Estas campañas se aplican por modelo.' : '');
}

function fillFinancing(preferredPlan = $('#plan').value, preferredMonths = Number($('#term').value)) {
  const plans = availablePlans();
  fillSelect($('#plan'), planOptions(plans), preferredPlan, {
    placeholder: plans.length ? undefined : $('#model').value ? 'Sin planes compatibles vigentes' : 'Elegí un modelo primero',
  });
  fillTerms($('#term'), $('#plan').value, preferredMonths);
}

function refreshPlanLimit() {
  const selection = readSelection();
  const plan = planById(selection.planId);
  const validPrice = Number.isFinite(selection.price) && selection.price > 0;
  text('#plan-limit', plan && validPrice ? money(Math.floor(Math.min(selection.price * plan.maxLtvPct / 100, plan.maxAmount))) : '—');
  text('#plan-ltv', plan ? `${percent(plan.maxLtvPct)} del precio · tope ${money(plan.maxAmount)}` : 'Calculado sobre el precio de lista');
  text('#plan-notes', plan?.notes ?? 'Seleccioná un modelo y un tipo de cliente para explorar las campañas vigentes de esta marca.');
}

function showErrors(errors, visible) {
  Object.entries(fieldMap).forEach(([key, [inputSelector, errorSelector]]) => {
    const message = visible ? errors[key] : '';
    const input = $(inputSelector);
    const error = $(errorSelector);
    error.textContent = message ?? '';
    error.hidden = !message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  });
  const customerError = visible ? errors.customerType : '';
  text('#customer-error', customerError ?? '');
  $('#customer-error').hidden = !customerError;
  document.querySelectorAll('input[name="customerType"]').forEach((radio) => {
    if (customerError) radio.setAttribute('aria-invalid', 'true');
    else radio.removeAttribute('aria-invalid');
  });
}

function validateUI({ showFieldErrors = true } = {}) {
  const selection = readSelection();
  const result = evaluateSelection(selection);
  const active = getPlanStatus(currentBrand()) === 'active';
  showErrors(result.errors ?? {}, showFieldErrors && active);
  $('#calculate-button').disabled = !active || !result.ok;
  const amountsValid = !Object.keys(validateAmounts(selection.price, selection.downPayment)).length;
  text('#requested-preview', amountsValid ? money(selection.price - selection.downPayment) : '—');
  refreshPlanLimit();
  return result;
}

function hideQuote(message = 'Actualizaste los datos. Presioná Recalcular para ver una nueva simulación.') {
  lastQuote = null;
  $('#quote-result').hidden = true;
  $('#result-empty').hidden = false;
  $('#print-quote').disabled = true;
  text('#empty-message', message);
  text('#summary-indicator', 'Pendiente de cálculo');
  $('#summary-indicator').classList.add('is-pending');
}

function announce(message) {
  text('#app-announcer', message);
}

function readComparisonChoices() {
  return ['a', 'b'].map((side) => ({
    planId: $(`#compare-plan-${side}`).value,
    months: Number($(`#compare-term-${side}`).value),
  }));
}

function removeStoredSelection() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return true;
  } catch { return false; }
}

function loadSelection() {
  try {
    // Se descarta v1: sus planes ficticios no son compatibles con las circulares.
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Selección inválida');
    if (!brandById(saved.brandId)) throw new Error('Marca inválida');
    const brandOnly = { brandId: saved.brandId };
    if (!saved.modelId || getPlanStatus(brandById(saved.brandId)) !== 'active') return brandOnly;
    const candidate = {
      ...brandOnly, modelId: saved.modelId, versionId: saved.versionId ?? '',
      price: saved.price, downPayment: saved.downPayment,
      customerType: saved.customerType, planId: saved.planId, months: saved.months,
    };
    if (!Number.isSafeInteger(candidate.price) || !Number.isSafeInteger(candidate.downPayment)
      || !CUSTOMER_TYPES.some((type) => type.id === candidate.customerType) || !quoteForSelection(candidate).ok) {
      localStorage.removeItem(STORAGE_KEY);
      return brandOnly;
    }
    const comparison = Array.isArray(saved.comparison) && saved.comparison.length === 2
      ? saved.comparison.map((choice) => ({ planId: choice?.planId, months: choice?.months })) : [];
    return { ...candidate, comparison: comparison.every((choice) => quoteForSelection({ ...candidate, ...choice }).ok) ? comparison : [] };
  } catch {
    removeStoredSelection();
    return null;
  }
}

/** Lista explícita: nunca se persisten objetos arbitrarios ni información personal. */
function saveSelection({ brandOnly = false } = {}) {
  const selection = readSelection();
  const snapshot = { brandId: activeBrandId };
  if (!brandOnly && evaluateSelection(selection).ok) {
    Object.assign(snapshot, selection);
    const comparison = readComparisonChoices();
    if (comparison.every((choice) => quoteForSelection({ ...selection, ...choice }).ok)) snapshot.comparison = comparison;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch { return false; }
}

function setTime(selector, value) {
  const element = $(selector);
  element.dateTime = value;
  element.textContent = formatDate(value);
}

function renderQuote(result) {
  const selection = readSelection();
  const { model, version } = getVehicle(selection);
  const values = {
    '#result-installment': money(result.installment), '#result-months': `${result.months} meses`,
    '#result-tna': percent(result.tna), '#result-ce': percent(result.dealerContributionPct),
    '#result-model': `${currentBrand().name} ${model.name}`, '#result-version': version?.name ?? 'Sin versión específica · precio manual',
    '#result-entity': result.entity, '#result-plan': result.planName,
    '#result-customer': customerName(selection.customerType),
    '#result-price': money(result.price), '#result-down-payment': money(result.downPayment),
    '#result-requested': money(result.requested), '#result-eligible': money(result.eligible),
    '#result-ltv': `${percent(result.maxLtvPct)} · ${money(result.ltvLimit)}`,
    '#result-max': money(result.maxAmount), '#result-coefficient': coefficientFormatter.format(result.installmentPerThousandWithVat),
    '#result-channel': result.channel, '#result-rate-type': result.isUva ? 'UVA' : 'TASA FIJA',
    '#result-total': money(result.totalInstallments), '#result-gap': money(result.gap),
    '#result-total-label': result.isUva ? 'Total aritmético inicial · no proyectado' : 'Total nominal estimado de cuotas',
    '#result-source': `${result.source.circular} · pág. ${result.source.page} · LTV: pág. ${result.source.ltvPage}`,
    '#result-source-file': result.source.filename,
    '#result-validity': `Vigencia: ${formatDate(result.validFrom)} al ${formatDate(result.validTo)} · Vigente al calcular`,
  };
  Object.entries(values).forEach(([selector, value]) => text(selector, value));
  text('#result-method', 'Método: monto financiado / 1.000 × cuota por mil con IVA de la circular. No se recalcula por TNA ni se deriva CFT.');
  text('#quote-uva-warning', APP_META.uvaWarning);
  $('#quote-uva-warning').hidden = !result.isUva;
  $('.hero-caption').textContent = result.isUva ? 'Pesos argentinos · cuota inicial, ajustable por UVA' : 'Pesos argentinos · referencia de tasa fija';
  $('#cap-notice').hidden = result.gap === 0;
  $('#coverage-note').hidden = result.gap > 0;
  text('#coverage-note', 'El monto solicitado está cubierto por este escenario.');
  $('.gap-row').classList.toggle('has-gap', result.gap > 0);
  if (result.gap > 0) {
    const reasons = result.cappedBy.map((reason) => reason === 'ltv' ? `LTV de ${percent(result.maxLtvPct)}` : `monto máximo de ${money(result.maxAmount)}`).join(' y ');
    text('#cap-message', `El tope por ${reasons || 'redondeo a pesos'} deja ${money(result.gap)} fuera de la financiación. Aumentá el anticipo en ${money(result.gap)}, hasta ${money(result.requiredDownPayment)}. No incluye seguro automotor ni otros cargos.`);
  }
  setTime('#result-date', result.calculatedOn);
  $('#quote-result').hidden = false;
  $('#result-empty').hidden = true;
  $('#print-quote').disabled = false;
  text('#summary-indicator', 'Escenario calculado');
  $('#summary-indicator').classList.remove('is-pending');
  lastQuote = result;
}

function calculate({ notify = true, persist = true } = {}) {
  refreshValidity();
  if (getPlanStatus(currentBrand()) !== 'active') return;
  const result = validateUI();
  if (!result.ok) {
    hideQuote('Corregí los campos señalados para calcular la financiación.');
    text('#form-status', 'Hay datos por revisar. Los errores aparecen junto a cada campo.');
    if (notify) $('#quote-form [aria-invalid="true"]')?.focus();
    return;
  }
  renderQuote(result);
  const saved = persist ? saveSelection() : false;
  text('#form-status', saved ? 'Cotización actualizada. Selección guardada sólo en este navegador.' : 'Cotización actualizada. No se envió información a ningún servicio.');
  if (notify) {
    announce(`Simulación calculada: cuota estimada de ${money(result.installment)} en ${result.months} meses.${result.gap ? ` Necesitás aumentar el anticipo en ${money(result.gap)}.` : ''}`);
  }
}

function refreshComparisonChoices(preferences = readComparisonChoices()) {
  const plans = availablePlans();
  ['a', 'b'].forEach((side, index) => {
    const preferred = preferences[index] ?? defaults().comparison[index];
    const fallbackPlan = plans[index] ?? plans[0];
    const selectedPlan = plans.some((plan) => plan.id === preferred?.planId) ? preferred.planId : fallbackPlan?.id;
    fillSelect($(`#compare-plan-${side}`), planOptions(plans), selectedPlan);
    fillTerms($(`#compare-term-${side}`), $(`#compare-plan-${side}`).value, preferred?.months);
  });
  const [a, b] = readComparisonChoices();
  if (a.planId && a.planId === b.planId && a.months === b.months) {
    const otherPlan = plans.find((plan) => plan.id !== a.planId);
    if (otherPlan) {
      $('#compare-plan-b').value = otherPlan.id;
      fillTerms($('#compare-term-b'), otherPlan.id, defaults().months);
    } else {
      const otherTerm = planById(a.planId)?.terms.find((term) => term.months !== a.months);
      if (otherTerm) $('#compare-term-b').value = String(otherTerm.months);
    }
  }
}

function refreshComparisonContext() {
  const selection = readSelection();
  const { model, version } = getVehicle(selection);
  const context = $('#comparison-context');
  const vehicle = node('div', 'scenario-vehicle');
  vehicle.append(node('h3', '', model ? `${currentBrand().name} ${model.name}` : 'Elegí un vehículo en Cotizador'));
  vehicle.append(node('p', '', model ? `${version?.name ?? 'Sin versión específica'} · ${customerName(selection.customerType)}` : 'El comparador usa el mismo vehículo, precio y anticipo.'));
  const values = node('dl', 'scenario-values');
  const amountsValid = !Object.keys(validateAmounts(selection.price, selection.downPayment)).length;
  [
    ['Precio de lista', Number.isFinite(selection.price) && selection.price > 0 ? money(selection.price) : '—'],
    ['Anticipo', Number.isFinite(selection.downPayment) && selection.downPayment >= 0 ? money(selection.downPayment) : '—'],
    ['Monto solicitado', amountsValid ? money(selection.price - selection.downPayment) : '—'],
  ].forEach(([label, value]) => {
    const group = node('div');
    group.append(node('dt', '', label), node('dd', '', value));
    values.append(group);
  });
  context.replaceChildren(vehicle, values);
}

function comparisonValidation() {
  if (getPlanStatus(currentBrand()) !== 'active') return { ok: false, message: 'La marca no tiene una circular vigente para cotizar ni comparar.' };
  const selection = readSelection();
  const sharedErrors = { ...validateAmounts(selection.price, selection.downPayment), ...vehicleErrors(selection) };
  if (Object.keys(sharedErrors).length) return { ok: false, message: 'Corregí los datos del vehículo, el precio o el anticipo en Cotizador antes de comparar.' };
  const choices = readComparisonChoices();
  const results = choices.map((choice) => quoteForSelection({ ...selection, ...choice }));
  if (results.some((result) => !result.ok)) return { ok: false, message: 'Elegí dos alternativas vigentes y compatibles, con un plazo válido para cada plan.' };
  if (choices[0].planId === choices[1].planId && choices[0].months === choices[1].months) {
    return { ok: false, duplicate: true, message: 'Las alternativas son iguales. Cambiá el plan o el plazo de una de ellas.' };
  }
  return { ok: true, results };
}

function syncComparisonValidation({ showMessage = true } = {}) {
  const validation = comparisonValidation();
  $('#compare-button').disabled = !validation.ok;
  text('#compare-error', !validation.ok && showMessage ? validation.message : '');
  $('#compare-error').hidden = validation.ok || !showMessage;
  ['a', 'b'].forEach((side) => {
    const select = $(`#compare-plan-${side}`);
    select.setAttribute('aria-describedby', 'compare-error');
    if (validation.duplicate) select.setAttribute('aria-invalid', 'true');
    else select.removeAttribute('aria-invalid');
  });
  return validation;
}

function hideComparison() {
  lastComparison = null;
  $('#comparison-result').hidden = true;
  $('#print-compare').disabled = true;
  text('#compare-status', 'Presioná Comparar alternativas para actualizar el resultado.');
}

function renderComparison({ notify = true, persist = true } = {}) {
  refreshValidity();
  if (getPlanStatus(currentBrand()) !== 'active') return;
  refreshComparisonContext();
  const validation = syncComparisonValidation();
  if (!validation.ok) {
    hideComparison();
    text('#compare-status', 'Revisá los datos indicados.');
    return;
  }
  const [a, b] = validation.results;
  const headRow = node('tr');
  const metricHeader = node('th', '', 'Condición');
  metricHeader.scope = 'col';
  headRow.append(metricHeader);
  [a, b].forEach((result, index) => {
    const header = node('th');
    header.scope = 'col';
    header.append(node('strong', '', `ALTERNATIVA ${index === 0 ? 'A' : 'B'}`), node('div', '', result.entity), node('span', '', `${result.planName} · ${result.isUva ? 'UVA' : 'Pesos, tasa fija'} · ${result.channel}`));
    headRow.append(header);
  });
  $('#comparison-head').replaceChildren(headRow);
  const bothFixed = !a.isUva && !b.isUva;
  const sameIndex = a.isUva === b.isUva;
  const metrics = [
    { key: 'months', label: 'Plazo', format: (value) => `${value} meses` },
    { key: 'installment', label: 'Cuota mensual inicial estimada', format: money, highlight: bothFixed },
    { key: 'eligible', label: 'Monto financiado', format: money },
    { key: 'tna', label: 'TNA', format: percent, highlight: sameIndex },
    { key: 'dealerContributionPct', label: 'Aporte CE · interno, no gasto del cliente', format: percent },
    { key: 'installmentPerThousandWithVat', label: 'Cuota por $1.000 con IVA', format: (value) => coefficientFormatter.format(value) },
    { key: 'maxLtvPct', label: 'LTV máximo', format: percent },
    { key: 'maxAmount', label: 'Máximo del plan', format: money },
    { key: 'totalInstallments', label: bothFixed ? 'Total nominal estimado de cuotas' : 'Total aritmético inicial · sin proyección UVA', format: money, highlight: bothFixed },
    { key: 'gap', label: 'Diferencia sin financiar', format: money, highlight: true },
  ];
  const bodyRows = metrics.map(({ key, label, format, highlight = false }) => {
    const row = node('tr');
    const heading = node('th', '', label);
    heading.scope = 'row';
    row.append(heading);
    const equal = a[key] === b[key];
    [a, b].forEach((result) => {
      const lower = result[key] === Math.min(a[key], b[key]);
      const cell = node('td', equal ? 'equal-value' : lower && highlight ? 'lower-value' : '', format(result[key]));
      cell.dataset.metric = key;
      if (equal) cell.append(node('span', 'metric-note', 'Iguales'));
      else if (lower && highlight) cell.append(node('span', 'sr-only', ' · Menor valor comparable; no implica recomendación.'));
      row.append(cell);
    });
    return row;
  });
  $('#comparison-body').replaceChildren(...bodyRows);
  text('#comparison-date', `Simulación: ${formatDate(a.calculatedOn)} · Datos actualizados: ${formatDate(APP_META.updatedAt)}.`);
  const describeSource = (result) => `${result.source.circular}, pág. ${result.source.page}; ${result.source.filename}. Vigencia: ${formatDate(result.validFrom)} al ${formatDate(result.validTo)}.`;
  text('#comparison-source', describeSource(a) === describeSource(b) ? `Fuente de ambas alternativas: ${describeSource(a)}`
    : [a, b].map((result, index) => `${index === 0 ? 'A' : 'B'}: ${describeSource(result)}`).join(' '));
  $('#comparison-uva-warning').hidden = bothFixed;
  text('#comparison-uva-warning', `${APP_META.uvaWarning} Los totales UVA sólo multiplican la cuota inicial; no representan el costo futuro ni se resaltan como menores.`);
  let gaps = $('#comparison-gaps');
  if (!gaps) {
    gaps = node('p');
    gaps.id = 'comparison-gaps';
    $('#comparison-date').before(gaps);
  }
  gaps.textContent = [a, b].map((result, index) => result.gap > 0
    ? `Alternativa ${index === 0 ? 'A' : 'B'}: necesitás aumentar el anticipo en ${money(result.gap)}, hasta ${money(result.requiredDownPayment)}; sin seguro ni otros cargos.`
    : `Alternativa ${index === 0 ? 'A' : 'B'}: el monto solicitado queda cubierto.`).join(' ');
  $('#comparison-result').hidden = false;
  $('#print-compare').disabled = false;
  text('#compare-status', 'Comparación actualizada. No se recomienda automáticamente ninguna opción.');
  lastComparison = [a, b];
  if (persist) saveSelection();
  if (notify) announce(`Comparación de ${currentBrand().name} actualizada. Sólo se destacan valores comparables, sin recomendar ninguna opción.`);
}

function draftChanged({ financingChanged = false } = {}) {
  if (financingChanged) {
    fillFinancing();
    refreshComparisonChoices();
  }
  hideQuote();
  hideComparison();
  const result = validateUI();
  refreshComparisonContext();
  syncComparisonValidation({ showMessage: false });
  text('#form-status', result.ok ? 'Datos modificados. Recalculá para actualizar la simulación.' : 'Revisá los campos señalados antes de recalcular.');
}

function updateVehiclePrice({ focusManual = true } = {}) {
  const { model, version } = getVehicle();
  if (!model) return;
  const price = version?.price ?? model.price;
  const hasPreset = Number.isFinite(price) && price > 0;
  const previousDownPayment = parsePesos($('#down-payment').value);
  $('#price').value = hasPreset ? integerFormatter.format(price) : '';
  text('#price-hint', hasPreset ? 'Precio demo editable · pesos sin centavos.' : 'Ingreso manual obligatorio · precio no informado en la circular.');
  if (!Number.isFinite(previousDownPayment)) {
    $('#down-payment').value = integerFormatter.format(hasPreset ? Math.round(price * DEFAULT_SELECTION.downPaymentPct / 100) : 0);
  }
  if (!hasPreset && focusManual) $('#price').focus();
}

function activateTab(name, { focus = false } = {}) {
  activeTab = name;
  document.querySelectorAll('[role="tab"]').forEach((tab) => {
    const selected = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $(`#${tab.getAttribute('aria-controls')}`).hidden = !selected;
    if (selected && focus) tab.focus();
  });
  document.body.classList.toggle('print-comparison', name === 'compare');
  if (name === 'compare') {
    refreshComparisonContext();
    renderComparison({ notify: false, persist: false });
  }
  if (name === 'data') renderCatalog();
}

function clearSelection() {
  const removed = removeStoredSelection();
  $('#model').value = '';
  fillVersions();
  $('#price').value = '';
  $('#down-payment').value = '';
  document.querySelectorAll('input[name="customerType"]').forEach((radio) => { radio.checked = radio.value === DEFAULT_SELECTION.customerType; });
  fillFinancing();
  refreshComparisonChoices();
  hideQuote('Elegí un modelo para iniciar otra cotización. La selección anterior fue eliminada.');
  hideComparison();
  validateUI({ showFieldErrors: false });
  refreshComparisonContext();
  syncComparisonValidation({ showMessage: false });
  text('#form-status', removed ? 'Selección eliminada del navegador. Empezá una nueva cotización.' : 'Formulario limpio. El almacenamiento del navegador no está disponible.');
  announce('Selección eliminada. Elegí un modelo para empezar de nuevo.');
  if (!$('#model').disabled) $('#model').focus();
  else $(`#brand-${activeBrandId}`).focus();
}

const statusLabels = { active: 'Vigente', expired: 'Vencida', upcoming: 'Próxima', invalid: 'Vigencia inválida', pending: 'Pendiente' };

function renderCatalog() {
  const brand = currentBrand();
  const status = getPlanStatus(brand);
  text('#source-brand', brand.name);
  text('#source-circular', brand.sourceLabel ?? 'Pendiente de recepción');
  text('#source-filename', brand.sourceFile ?? 'Sin archivo recibido');
  text('#source-pages', brand.sourcePage ? `Promociones: pág. ${brand.sourcePage} · LTV: pág. ${brand.riskPage}` : 'No disponibles');
  text('#source-validity', brand.validFrom ? `${formatDate(brand.validFrom)} al ${formatDate(brand.validTo)} · ${statusLabels[status]}` : 'Pendiente');
  text('#source-status-message', status === 'active' ? 'Circular vigente según la fecha local del dispositivo. Verificá elegibilidad y condiciones antes de informar al cliente.'
    : status === 'pending' ? APP_META.pendingMessage : status === 'expired' ? 'Circular vencida. Se necesita una circular nueva; estas condiciones sólo pueden consultarse como referencia histórica.'
      : 'Estas condiciones todavía no están vigentes o no tienen una fecha válida. No se habilitan cotizaciones.');
  text('#source-scope', APP_META.scopeNote);
  text('#source-scope-badge', brand.status === 'pending' ? 'PENDIENTE' : 'PROMOCIONES 0 KM');
  text('#model-count', String(currentModels().length).padStart(2, '0'));
  text('#plan-count', String(currentPlans().length).padStart(2, '0'));
  text('#term-count', String(currentPlans().reduce((count, plan) => count + plan.terms.length, 0)).padStart(2, '0'));
  const list = $('#plan-list');
  const cards = currentPlans().map((plan) => {
    const status = getPlanStatus(plan);
    const card = node('article', 'card source-plan');
    card.dataset.planId = plan.id;
    const header = node('div', 'source-plan-header');
    const title = node('div');
    title.append(node('p', '', `${plan.entity} · ${plan.channel} · ${plan.isUva ? 'UVA' : 'Pesos, tasa fija'}`), node('h4', '', plan.name));
    header.append(title, node('span', `plan-status ${status}`, statusLabels[status]));
    const meta = node('div', 'source-plan-meta');
    meta.append(
      node('span', '', `${plan.source.circular} · pág. ${plan.source.page} · LTV: pág. ${plan.source.ltvPage}`),
      node('span', '', `Vigencia: ${formatDate(plan.validFrom)} al ${formatDate(plan.validTo)}`),
      node('span', '', `LTV: ${percent(plan.maxLtvPct)} · Máximo: ${money(plan.maxAmount)}`),
      node('span', '', `Modelos: ${plan.modelIds.map((id) => currentModels().find((model) => model.id === id)?.name ?? id).join(', ')}`),
      node('span', 'source-filename', plan.source.filename),
    );
    if (plan.versionIds) meta.append(node('span', '', `Versión exclusiva: ${currentModels().flatMap((model) => model.versions).filter((version) => plan.versionIds.includes(version.id)).map((version) => version.name).join(', ')}`));
    const terms = node('div', 'source-terms');
    plan.terms.forEach((term) => {
      const row = node('div', 'source-term');
      row.append(node('strong', '', `${term.months} meses`));
      [
        `TNA ${percent(term.tna)}`, `Aporte CE ${percent(term.dealerContributionPct)}`,
        `Cuota / $1.000 con IVA: ${coefficientFormatter.format(term.installmentPerThousandWithVat)}`,
      ].forEach((value) => row.append(node('span', '', value)));
      terms.append(row);
    });
    card.append(header, meta, node('p', 'source-plan-notes', plan.notes));
    if (plan.isUva) card.append(node('p', 'catalog-uva-note', APP_META.uvaWarning));
    card.append(terms);
    return card;
  });
  list.replaceChildren(...cards);
  const active = currentPlans().filter((plan) => getPlanStatus(plan) === 'active').length;
  text('#catalog-status', brand.status === 'pending' ? 'Sin campañas cargadas' : `${active} vigentes · ${currentPlans().length - active} bloqueadas por vigencia`);
}

function setupBrands() {
  document.querySelectorAll('.logo-frame').forEach((frame) => {
    const image = frame.querySelector('img');
    if (!image || image.dataset.fallbackReady) return;
    image.dataset.fallbackReady = 'true';
    const update = () => frame.classList.toggle('is-loaded', image.hasAttribute('src') && image.complete && image.naturalWidth > 0);
    image.addEventListener('load', update);
    image.addEventListener('error', () => frame.classList.remove('is-loaded'));
    update();
  });
}

function buildBrandSelector() {
  BRANDS.forEach((brand) => {
    const label = node('label', 'brand-choice');
    label.htmlFor = `brand-${brand.id}`;
    label.dataset.brand = brand.id;
    const input = node('input', 'sr-only');
    input.type = 'radio'; input.name = 'brandId'; input.value = brand.id; input.id = label.htmlFor;
    const logo = node('span', 'logo-frame brand-choice-logo');
    logo.setAttribute('aria-hidden', 'true');
    logo.append(node('span', 'wordmark', brand.name === 'GM / Chevrolet' ? 'GM' : brand.name));
    if (brand.logo) {
      const image = node('img', 'brand-image');
      image.src = brand.logo; image.alt = ''; image.width = 100; image.height = 55;
      logo.append(image);
    }
    const copy = node('span', 'brand-choice-copy');
    copy.append(node('span', 'brand-choice-name', brand.name), node('span', 'brand-choice-state', statusLabels[getPlanStatus(brand)]));
    label.append(input, logo, copy);
    input.addEventListener('change', () => selectBrand(brand.id, { focusManual: !input.matches(':focus-visible') }));
    $('#brand-options').append(label);
  });
  setupBrands();
}

function updateAvailability() {
  const brand = currentBrand();
  const status = getPlanStatus(brand);
  lastAvailabilityStatus = status;
  const active = status === 'active';
  document.body.classList.toggle('print-blocked', !active);
  document.body.dataset.availability = status;
  $('#quote-workspace').hidden = !active;
  $('#comparison-workspace').hidden = !active;
  $('#availability-card').hidden = active;
  text('#circular-badge', brand.status === 'pending' ? 'Pendiente' : APP_META.circularLabel);
  text('#brand-validity-status', statusLabels[status]);
  $('#brand-validity-status').className = `plan-status ${status}`;
  $('#brand-validity-status').hidden = status === 'pending';
  const source = brand.sourceLabel ? `${brand.name} · ${brand.sourceLabel} · pág. ${brand.sourcePage} · ${formatDate(brand.validFrom)} al ${formatDate(brand.validTo)}` : `${brand.name} · Sin circular recibida`;
  text('#active-source-line', source);
  text('#availability-badge', `${brand.name} · ${statusLabels[status]}`);
  text('#availability-title', status === 'pending' ? APP_META.pendingTitle : status === 'expired' ? 'Circular vencida' : status === 'upcoming' ? 'Circular próxima' : 'Vigencia no disponible');
  text('#availability-message', status === 'pending' ? APP_META.pendingMessage : status === 'expired'
    ? `Las condiciones de ${brand.sourceLabel} vencieron el ${formatDate(brand.validTo)}. Solicitá una circular nueva para volver a cotizar. La información permanece disponible en Fuentes y vigencia; no se reemplaza por tasas inventadas ni por planes de otra marca.`
    : 'Estas condiciones no están vigentes en la fecha local del dispositivo. Podés consultar su fuente, pero no generar cotizaciones hasta contar con una circular vigente.');
  text('#availability-source', source);
  BRANDS.forEach((item) => {
    const state = $(`#brand-${item.id}`).closest('.brand-choice').querySelector('.brand-choice-state');
    state.textContent = statusLabels[getPlanStatus(item)];
    state.dataset.status = getPlanStatus(item);
  });
  if (!active) {
    document.querySelectorAll('#quote-form input, #quote-form select, #quote-form button, #compare-form select, #compare-form button').forEach((control) => { control.disabled = true; });
    $('#print-quote').disabled = true;
    $('#print-compare').disabled = true;
  } else {
    document.querySelectorAll('#price, #down-payment, #clear-button, input[name="customerType"]').forEach((control) => { control.disabled = false; });
    $('#model').disabled = !currentModels().length;
    $('#version').disabled = !getVehicle().model?.versions.length;
  }
}

function refreshValidity() {
  if (getPlanStatus(currentBrand()) === lastAvailabilityStatus) return;
  fillFinancing();
  refreshComparisonChoices();
  hideQuote('La vigencia cambió. Revisá la circular de esta marca antes de recalcular.');
  hideComparison();
  updateAvailability();
  validateUI({ showFieldErrors: false });
  syncComparisonValidation({ showMessage: false });
  renderCatalog();
}

function selectBrand(brandId, { selection, notify = true, persist = true, autoCalculate = false, focusManual = false } = {}) {
  if (!brandById(brandId)) return;
  activeBrandId = brandId;
  const brand = currentBrand();
  const initial = { ...defaults(), ...selection };
  document.body.dataset.brand = brandId;
  $(`#brand-${brandId}`).checked = true;
  text('#footer-brand', brand.name);
  text('#model-label', `Modelo ${brand.name}`);
  const frame = $('#active-brand-logo');
  const image = $('#active-brand-image');
  frame.classList.remove('is-loaded');
  frame.dataset.brand = brandId;
  frame.setAttribute('aria-label', brand.name);
  text('#active-brand-wordmark', brand.name === 'GM / Chevrolet' ? 'Chevrolet' : brand.name);
  image.hidden = !brand.logo;
  if (brand.logo) image.src = brand.logo;
  else image.removeAttribute('src');
  if (brand.logo && image.complete && image.naturalWidth) frame.classList.add('is-loaded');

  hideQuote('Elegí las condiciones y presioná Recalcular para generar una referencia de esta marca.');
  hideComparison();
  // No quedan datos de otra marca ni siquiera en las tablas ocultas o en la impresión.
  $('#quote-result').querySelectorAll('[id]').forEach((element) => { if (!element.children.length) element.textContent = ''; });
  $('#comparison-head').replaceChildren();
  $('#comparison-body').replaceChildren();
  fillSelect($('#model'), currentModels().map((model) => ({ value: model.id, label: model.name })), initial.modelId, { placeholder: 'Seleccioná un modelo' });
  fillVersions(initial.versionId);
  $('#price').disabled = false;
  $('#down-payment').value = '';
  $('#price').value = '';
  updateVehiclePrice({ focusManual: false });
  if (Number.isSafeInteger(initial.price)) $('#price').value = integerFormatter.format(initial.price);
  if (Number.isSafeInteger(initial.downPayment)) $('#down-payment').value = integerFormatter.format(initial.downPayment);
  document.querySelectorAll('input[name="customerType"]').forEach((radio) => { radio.checked = radio.value === (initial.customerType ?? DEFAULT_SELECTION.customerType); });
  fillFinancing(initial.planId, initial.months);
  refreshComparisonChoices(initial.comparison);
  refreshComparisonContext();
  updateAvailability();
  const validation = validateUI({ showFieldErrors: false });
  syncComparisonValidation({ showMessage: false });
  renderCatalog();
  text('#form-status', $('#price').value ? 'Recalculá para obtener una cotización con la marca seleccionada.' : 'Ingresá el precio de lista; la circular no informa precios de vehículos.');
  if (autoCalculate && validation.ok && getPlanStatus(brand) === 'active') {
    calculate({ notify: false, persist: false });
    renderComparison({ notify: false, persist: false });
  }
  if (persist) saveSelection({ brandOnly: true });
  if (notify) announce(`Marca seleccionada: ${brand.name}. ${statusLabels[getPlanStatus(brand)]}. ${brand.status === 'pending' ? APP_META.pendingMessage : !$('#price').value ? 'Ingresá el precio de lista manualmente para cotizar.' : 'Los resultados anteriores fueron limpiados.'}`);
  if (focusManual && activeTab === 'quote' && getPlanStatus(brand) === 'active' && !$('#price').value) $('#price').focus();
}

function bindEvents() {
  $('#quote-form').addEventListener('submit', (event) => { event.preventDefault(); calculate(); });
  $('#clear-button').addEventListener('click', clearSelection);
  $('#clear-stored-selection').addEventListener('click', clearSelection);
  $('#model').addEventListener('change', () => {
    fillVersions();
    updateVehiclePrice();
    draftChanged({ financingChanged: true });
  });
  $('#version').addEventListener('change', () => { updateVehiclePrice(); draftChanged({ financingChanged: true }); });
  document.querySelectorAll('input[name="customerType"]').forEach((radio) => radio.addEventListener('change', () => draftChanged({ financingChanged: true })));
  ['#price', '#down-payment'].forEach((selector) => {
    $(selector).addEventListener('input', () => draftChanged());
    $(selector).addEventListener('blur', () => {
      const amount = parsePesos($(selector).value);
      if (Number.isSafeInteger(amount)) $(selector).value = integerFormatter.format(amount);
    });
  });
  $('#plan').addEventListener('change', () => { fillTerms($('#term'), $('#plan').value, Number($('#term').value)); draftChanged(); });
  $('#term').addEventListener('change', () => draftChanged());
  $('#compare-form').addEventListener('submit', (event) => { event.preventDefault(); renderComparison(); });
  ['a', 'b'].forEach((side) => {
    $(`#compare-plan-${side}`).addEventListener('change', () => {
      fillTerms($(`#compare-term-${side}`), $(`#compare-plan-${side}`).value, Number($(`#compare-term-${side}`).value));
      hideComparison();
      syncComparisonValidation();
    });
    $(`#compare-term-${side}`).addEventListener('change', () => { hideComparison(); syncComparisonValidation(); });
  });
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      activateTab(tabs[next].dataset.tab, { focus: true });
    });
  });
  $('#go-compare').addEventListener('click', () => { activateTab('compare', { focus: true }); $('.section-nav').scrollIntoView({ block: 'start' }); });
  $('#edit-scenario').addEventListener('click', () => { activateTab('quote'); $('#model').focus(); $('.section-nav').scrollIntoView({ block: 'start' }); });
  $('#print-quote').addEventListener('click', () => { if (lastQuote) window.print(); });
  $('#print-compare').addEventListener('click', () => { if (lastComparison) window.print(); });
  window.addEventListener('beforeprint', () => {
    refreshValidity();
    document.body.classList.toggle('print-comparison', activeTab === 'compare');
    if (getPlanStatus(currentBrand()) !== 'active') return;
    if (activeTab === 'compare') renderComparison({ notify: false, persist: false });
    else if (evaluateSelection().ok) calculate({ notify: false, persist: false });
  });
  // Revalida al volver a la pestaña: no conserva resultados de planes que vencieron durante la sesión.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    refreshValidity();
  });
  window.addEventListener('focus', refreshValidity);
}

function init() {
  document.querySelectorAll('.updated-date').forEach((element) => {
    element.dateTime = APP_META.updatedAt;
    element.textContent = formatDate(APP_META.updatedAt);
  });
  text('#financial-disclaimer', APP_META.disclaimer);
  text('#price-disclaimer', APP_META.priceDisclaimer);
  text('#comparison-disclaimer', APP_META.comparisonDisclaimer);
  text('#footer-year', APP_META.updatedAt.slice(0, 4));
  const saved = loadSelection();
  CUSTOMER_TYPES.forEach((type) => {
    const label = node('label', 'customer-choice');
    const radio = node('input');
    radio.type = 'radio'; radio.name = 'customerType'; radio.value = type.id;
    radio.id = `customer-${type.id}`; radio.required = true;
    radio.setAttribute('aria-describedby', 'customer-error');
    radio.checked = DEFAULT_SELECTION.customerType === type.id;
    label.htmlFor = radio.id;
    label.append(radio, node('span', '', type.name));
    $('#customer-options').append(label);
  });
  buildBrandSelector();
  selectBrand(saved?.brandId ?? DEFAULT_SELECTION.brandId, { selection: saved, notify: false, persist: false, autoCalculate: true });
  bindEvents();
}

init();
