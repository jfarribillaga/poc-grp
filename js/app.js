import { CUSTOMER_TYPES, DEFAULT_SELECTION, DEMO_META, MODELS, PLANS } from './demo-data.js';
import { calculateQuote, getPlanStatus, isPlanAvailable, validateAmounts } from './calculator.js';

const STORAGE_KEY = 'grp-finance-poc:v1';
const $ = (selector) => document.querySelector(selector);
const moneyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: DEMO_META.currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const integerFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const money = (value) => moneyFormatter.format(value);
const percent = (value) => `${percentFormatter.format(value)} %`;
const formatDate = (value) => dateFormatter.format(new Date(`${value}T12:00:00`));
const customerName = (id) => CUSTOMER_TYPES.find((type) => type.id === id)?.name ?? 'Sin seleccionar';
const planById = (id) => PLANS.find((plan) => plan.id === id);
const fieldMap = {
  modelId: ['#model', '#model-error'], versionId: ['#version', '#version-error'],
  price: ['#price', '#price-error'], downPayment: ['#down-payment', '#down-payment-error'],
  planId: ['#plan', '#plan-error'], months: ['#term', '#term-error'],
};
let activeTab = 'quote';
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
  const model = MODELS.find((item) => item.id === selection.modelId);
  const version = model?.versions.find((item) => item.id === selection.versionId);
  return { model, version };
}

function vehicleErrors(selection) {
  const { model, version } = getVehicle(selection);
  const errors = {};
  if (!model) errors.modelId = 'Seleccioná un modelo FIAT.';
  if (!version) errors.versionId = 'Seleccioná una versión compatible con el modelo.';
  if (!CUSTOMER_TYPES.some((type) => type.id === selection.customerType)) errors.customerType = 'Seleccioná el tipo de cliente.';
  return errors;
}

function evaluateSelection(selection = readSelection()) {
  const result = calculateQuote({ ...selection, plan: planById(selection.planId) });
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
  return PLANS.filter((plan) => isPlanAvailable(plan, selection));
}

function planOptions(plans) {
  return plans.map((plan) => ({ value: plan.id, label: `${plan.entity} — ${plan.name}` }));
}

function fillTerms(select, planId, preferred) {
  const plan = planById(planId);
  fillSelect(select, (plan?.terms ?? []).map((term) => ({ value: term.months, label: `${term.months} meses` })), preferred);
}

function fillVersions(preferred) {
  const model = MODELS.find((item) => item.id === $('#model').value);
  fillSelect($('#version'), (model?.versions ?? []).map((version) => ({ value: version.id, label: version.name })), preferred, {
    placeholder: model ? undefined : 'Elegí un modelo primero',
  });
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
  const term = plan?.terms.find((item) => item.months === selection.months);
  const validPrice = Number.isFinite(selection.price) && selection.price > 0;
  text('#plan-limit', term && validPrice ? money(Math.floor(Math.min(selection.price * term.maxLtvPct / 100, term.maxAmount))) : '—');
  text('#plan-ltv', term ? `${percent(term.maxLtvPct)} del precio · tope ${money(term.maxAmount)}` : 'Calculado sobre el precio de lista');
  text('#plan-notes', plan?.notes ?? 'Seleccioná un modelo y un tipo de cliente para explorar los planes de demostración.');
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
  showErrors(result.errors ?? {}, showFieldErrors);
  $('#calculate-button').disabled = !result.ok;
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
  try { localStorage.removeItem(STORAGE_KEY); return true; } catch { return false; }
}

function loadSelection() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Selección inválida');
    const { model, version } = getVehicle(saved);
    if (!model || !version || !Number.isSafeInteger(saved.price) || !Number.isSafeInteger(saved.downPayment)
      || !CUSTOMER_TYPES.some((type) => type.id === saved.customerType)) throw new Error('Datos inválidos');
    if (!calculateQuote({ ...saved, plan: planById(saved.planId) }).ok) throw new Error('Plan inválido');
    if (!Array.isArray(saved.comparison) || saved.comparison.length !== 2) throw new Error('Comparación inválida');
    for (const choice of saved.comparison) {
      if (!choice || !calculateQuote({ ...saved, ...choice, plan: planById(choice.planId) }).ok) throw new Error('Alternativa inválida');
    }
    return saved;
  } catch {
    removeStoredSelection();
    return null;
  }
}

/** Lista explícita: nunca se persisten objetos arbitrarios ni información personal. */
function saveSelection() {
  const selection = readSelection();
  if (!evaluateSelection(selection).ok) return false;
  const comparison = readComparisonChoices();
  if (!comparison.every((choice) => calculateQuote({ ...selection, ...choice, plan: planById(choice.planId) }).ok)) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      modelId: selection.modelId, versionId: selection.versionId,
      price: selection.price, downPayment: selection.downPayment,
      customerType: selection.customerType, planId: selection.planId, months: selection.months,
      comparison: comparison.map(({ planId, months }) => ({ planId, months })),
    }));
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
    '#result-tna': percent(result.tna), '#result-cft': percent(result.cft),
    '#result-model': `FIAT ${model.name}`, '#result-version': version.name,
    '#result-entity': result.entity, '#result-plan': result.planName,
    '#result-customer': customerName(selection.customerType),
    '#result-price': money(result.price), '#result-down-payment': money(result.downPayment),
    '#result-requested': money(result.requested), '#result-eligible': money(result.eligible),
    '#result-ltv': `${percent(result.maxLtvPct)} · ${money(result.ltvLimit)}`,
    '#result-max': money(result.maxAmount), '#result-expenses': money(result.expenses),
    '#result-expense-pct': `(${percent(result.expensePct)})`,
    '#result-total': money(result.totalInstallments), '#result-gap': money(result.gap),
  };
  Object.entries(values).forEach(([selector, value]) => text(selector, value));
  const methods = {
    coefficient: 'Método: coeficiente de cuota ilustrativo provisto por el plan.',
    french: 'Método: cuota fija por sistema francés, con TNA dividida por 12.',
    zero: 'Método: capital dividido por la cantidad de meses, con TNA cero.',
  };
  text('#result-method', `${methods[result.method]} El CFT se informa como dato demo, no se usa para calcular la cuota.`);
  $('#cap-notice').hidden = result.gap === 0;
  $('#coverage-note').hidden = result.gap > 0;
  $('.gap-row').classList.toggle('has-gap', result.gap > 0);
  if (result.gap > 0) {
    const reasons = result.cappedBy.map((reason) => reason === 'ltv' ? `LTV de ${percent(result.maxLtvPct)}` : `monto máximo de ${money(result.maxAmount)}`).join(' y ');
    text('#cap-message', `El tope por ${reasons || 'redondeo a pesos'} deja ${money(result.gap)} fuera de la financiación. Aumentá el anticipo en ${money(result.gap)}, hasta ${money(result.requiredDownPayment)}. Los gastos se abonan aparte.`);
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
    const preferred = preferences[index] ?? DEFAULT_SELECTION.comparison[index];
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
      fillTerms($('#compare-term-b'), otherPlan.id, DEFAULT_SELECTION.comparison[1].months);
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
  vehicle.append(node('h3', '', model ? `FIAT ${model.name}` : 'Elegí un vehículo en Cotizador'));
  vehicle.append(node('p', '', version ? `${version.name} · ${customerName(selection.customerType)}` : 'El comparador usa el mismo vehículo, precio y anticipo.'));
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
  const selection = readSelection();
  const sharedErrors = { ...validateAmounts(selection.price, selection.downPayment), ...vehicleErrors(selection) };
  if (Object.keys(sharedErrors).length) return { ok: false, message: 'Corregí los datos del vehículo, el precio o el anticipo en Cotizador antes de comparar.' };
  const choices = readComparisonChoices();
  const results = choices.map((choice) => calculateQuote({ ...selection, ...choice, plan: planById(choice.planId) }));
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
    header.append(node('strong', '', `ALTERNATIVA ${index === 0 ? 'A' : 'B'}`), node('div', '', result.entity), node('span', '', result.planName));
    headRow.append(header);
  });
  $('#comparison-head').replaceChildren(headRow);
  const metrics = [
    { key: 'months', label: 'Plazo', format: (value) => `${value} meses` },
    { key: 'installment', label: 'Cuota mensual inicial estimada', format: money },
    { key: 'eligible', label: 'Monto financiado', format: money },
    { key: 'expenses', label: 'Gastos estimados', format: money },
    { key: 'tna', label: 'TNA ficticia', format: percent },
    { key: 'cft', label: 'CFT ficticio', format: percent },
    { key: 'maxLtvPct', label: 'LTV máximo', format: percent },
    { key: 'totalInstallments', label: 'Total nominal estimado de cuotas', format: money },
    { key: 'gap', label: 'Diferencia sin financiar', format: money },
  ];
  const bodyRows = metrics.map(({ key, label, format }) => {
    const row = node('tr');
    const heading = node('th', '', label);
    heading.scope = 'row';
    row.append(heading);
    const equal = a[key] === b[key];
    [a, b].forEach((result) => {
      const lower = result[key] === Math.min(a[key], b[key]);
      const cell = node('td', equal ? 'equal-value' : lower ? 'lower-value' : '', format(result[key]));
      if (equal) cell.append(node('span', 'metric-note', 'Iguales'));
      else if (lower) cell.append(node('span', 'sr-only', ' · Menor valor numérico; no implica recomendación.'));
      row.append(cell);
    });
    return row;
  });
  $('#comparison-body').replaceChildren(...bodyRows);
  text('#comparison-date', `Simulación: ${formatDate(a.calculatedOn)} · Datos actualizados: ${formatDate(DEMO_META.updatedAt)}.`);
  let gaps = $('#comparison-gaps');
  if (!gaps) {
    gaps = node('p');
    gaps.id = 'comparison-gaps';
    $('#comparison-date').before(gaps);
  }
  gaps.textContent = [a, b].map((result, index) => result.gap > 0
    ? `Alternativa ${index === 0 ? 'A' : 'B'}: necesitás aumentar el anticipo en ${money(result.gap)}, hasta ${money(result.requiredDownPayment)}; gastos aparte.`
    : `Alternativa ${index === 0 ? 'A' : 'B'}: el monto solicitado queda cubierto.`).join(' ');
  $('#comparison-result').hidden = false;
  $('#print-compare').disabled = false;
  text('#compare-status', 'Comparación actualizada. No se recomienda automáticamente ninguna opción.');
  lastComparison = [a, b];
  if (persist) saveSelection();
  if (notify) announce('Comparación actualizada. Se destaca el menor valor de cada métrica; no implica una recomendación.');
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

function updateVehiclePrice() {
  const { version } = getVehicle();
  if (!version) return;
  const previousDownPayment = parsePesos($('#down-payment').value);
  $('#price').value = integerFormatter.format(version.price);
  if (!Number.isFinite(previousDownPayment)) {
    $('#down-payment').value = integerFormatter.format(Math.round(version.price * DEFAULT_SELECTION.downPaymentPct / 100));
  }
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
  if (name === 'data') renderDemoCatalog();
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
  $('#model').focus();
}

function renderDemoCatalog() {
  const statusLabels = { active: 'Vigente · Demo', expired: 'Vencido · Bloqueado', upcoming: 'Futuro · Bloqueado', invalid: 'Fecha inválida · Bloqueado' };
  const list = $('#demo-plan-list');
  const cards = PLANS.map((plan) => {
    const status = getPlanStatus(plan);
    const card = node('article', 'card demo-plan');
    const header = node('div', 'demo-plan-header');
    const title = node('div');
    title.append(node('p', '', `${plan.entity} · demo: ${plan.demo}`), node('h4', '', plan.name));
    header.append(title, node('span', `plan-status ${status}`, statusLabels[status]));
    const meta = node('div', 'demo-plan-meta');
    meta.append(
      node('span', '', `Vigencia ficticia: ${formatDate(plan.validFrom)} al ${formatDate(plan.validTo)}`),
      node('span', '', `Cliente: ${plan.customerTypes.map(customerName).join(' / ')}`),
      node('span', '', `Modelos: ${plan.modelIds.map((id) => MODELS.find((model) => model.id === id)?.name ?? id).join(', ')}`),
    );
    const terms = node('div', 'demo-terms');
    plan.terms.forEach((term) => {
      const row = node('div', 'demo-term');
      row.append(node('strong', '', `${term.months} meses`));
      [
        `TNA ${percent(term.tna)}`, `CFT ${percent(term.cft)}`, `LTV ${percent(term.maxLtvPct)}`,
        `Tope ${money(term.maxAmount)}`, `Gastos ${percent(term.expensePct)}`,
        term.installmentCoefficient != null ? `Coeficiente ${percentFormatter.format(term.installmentCoefficient * 100)} % del capital` : 'Sin coeficiente: fórmula de cuota fija',
      ].forEach((value) => row.append(node('span', '', value)));
      terms.append(row);
    });
    card.append(header, meta, node('p', 'demo-plan-notes', plan.notes), terms);
    return card;
  });
  list.replaceChildren(...cards);
  const active = PLANS.filter((plan) => getPlanStatus(plan) === 'active').length;
  text('#catalog-status', `${active} vigentes · ${PLANS.length - active} bloqueados según fecha del dispositivo`);
}

function setupBrands() {
  document.querySelectorAll('.logo-frame').forEach((frame) => {
    const image = frame.querySelector('img');
    const update = () => frame.classList.toggle('is-loaded', image.complete && image.naturalWidth > 0);
    image.addEventListener('load', update);
    image.addEventListener('error', () => frame.classList.remove('is-loaded'));
    update();
  });
}

function bindEvents() {
  $('#quote-form').addEventListener('submit', (event) => { event.preventDefault(); calculate(); });
  $('#clear-button').addEventListener('click', clearSelection);
  $('#model').addEventListener('change', () => {
    fillVersions();
    updateVehiclePrice();
    draftChanged({ financingChanged: true });
  });
  $('#version').addEventListener('change', () => { updateVehiclePrice(); draftChanged(); });
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
    document.body.classList.toggle('print-comparison', activeTab === 'compare');
    if (activeTab === 'compare') renderComparison({ notify: false, persist: false });
    else if (evaluateSelection().ok) calculate({ notify: false, persist: false });
  });
  // Revalida al volver a la pestaña: no conserva resultados de planes que vencieron durante la sesión.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (lastQuote && getPlanStatus(planById(lastQuote.planId)) !== 'active') draftChanged({ financingChanged: true });
    if (lastComparison?.some((result) => getPlanStatus(planById(result.planId)) !== 'active')) {
      refreshComparisonChoices(); hideComparison(); syncComparisonValidation();
    }
  });
}

function init() {
  setupBrands();
  document.querySelectorAll('.updated-date').forEach((element) => {
    element.dateTime = DEMO_META.updatedAt;
    element.textContent = formatDate(DEMO_META.updatedAt);
  });
  text('#financial-disclaimer', DEMO_META.disclaimer);
  text('#comparison-disclaimer', DEMO_META.comparisonDisclaimer);
  text('#model-count', String(MODELS.length).padStart(2, '0'));
  text('#plan-count', String(PLANS.length).padStart(2, '0'));
  text('#footer-year', DEMO_META.updatedAt.slice(0, 4));
  const saved = loadSelection();
  const initial = saved ?? DEFAULT_SELECTION;
  CUSTOMER_TYPES.forEach((type) => {
    const label = node('label', 'customer-choice');
    const radio = node('input');
    radio.type = 'radio'; radio.name = 'customerType'; radio.value = type.id;
    radio.id = `customer-${type.id}`; radio.required = true;
    radio.setAttribute('aria-describedby', 'customer-error');
    radio.checked = initial.customerType === type.id;
    label.htmlFor = radio.id;
    label.append(radio, node('span', '', type.name));
    $('#customer-options').append(label);
  });
  fillSelect($('#model'), MODELS.map((model) => ({ value: model.id, label: model.name })), initial.modelId, { placeholder: 'Seleccioná un modelo' });
  fillVersions(initial.versionId);
  const { version } = getVehicle(initial);
  $('#price').value = integerFormatter.format(saved?.price ?? version.price);
  $('#down-payment').value = integerFormatter.format(saved?.downPayment ?? Math.round(version.price * DEFAULT_SELECTION.downPaymentPct / 100));
  fillFinancing(initial.planId, initial.months);
  refreshComparisonChoices(initial.comparison);
  refreshComparisonContext();
  renderDemoCatalog();
  bindEvents();
  calculate({ notify: false, persist: false });
  renderComparison({ notify: false, persist: false });
}

init();
