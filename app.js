const { calculateSalary, solveGrossForNet, calculateEmployeeContributions, calculateTaxFreeAllowance,
  calculateChildBonusMonthly } = window.SalaryCalculator;
const { toNumber, formatGroupedWholeAmount, formatCurrency, formatPercentage } = window.SalaryFormatters;
const { countWeekdaysInMonth, calculateEarningsProgress } = window.EarningsProgress;

let latestMonthlyNet = 0;
let recalculateTimer;
const RECALCULATE_DELAY = 700;

function restartAnimation(element, className) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function renderSalaryChart(result) {
  const chart = document.getElementById('salaryPieChart');
  if (!chart) return;
  const net = Math.max(0, result.gross - result.totalEmployeeContributions - result.taxAfterBonus);
  const contributions = Math.max(0, result.totalEmployeeContributions);
  const tax = result.taxAfterBonus;
  const taxSlice = Math.max(0, tax);
  const total = net + contributions + taxSlice;
  const netPercent = total ? (net / total) * 100 : 0;
  const contributionsPercent = total ? (contributions / total) * 100 : 0;
  const taxPercent = result.gross ? (tax / result.gross) * 100 : 0;
  const taxEnd = contributionsPercent + (total ? (taxSlice / total) * 100 : 0);
  chart.style.background = `conic-gradient(var(--chart-contributions) 0 ${contributionsPercent}%, var(--chart-tax) ${contributionsPercent}% ${taxEnd}%, var(--accent) ${taxEnd}% ${taxEnd + netPercent}%)`;
  const breakdown = document.querySelector('.breakdown-row');
  breakdown?.setAttribute('aria-label', `Rozdelenie mzdy: odvody ${formatCurrency(contributions)}, daň ${formatCurrency(tax)}, čistá mzda ${formatCurrency(net)}. Kliknutím ${breakdown.getAttribute('aria-expanded') === 'true' ? 'skryjete' : 'zobrazíte'} detailný rozpis.`);
  [['chartNet', net], ['chartContributions', contributions], ['chartTax', tax]]
    .forEach(([id, value]) => { document.getElementById(id).textContent = formatCurrency(value); });
  document.getElementById('chartNetPercent').textContent = formatPercentage(netPercent, 100);
  document.getElementById('chartContributionsPercent').textContent = formatPercentage(contributionsPercent, 100);
  document.getElementById('chartTaxPercent').textContent = `${taxPercent.toFixed(2)} %`;
  restartAnimation(chart, 'is-drawing');
  restartAnimation(document.querySelector('.breakdown-legend'), 'is-updating');
}

function renderLiveEarnings() {
  const days = document.getElementById('workingDays');
  const start = document.getElementById('workStart');
  const end = document.getElementById('workEnd');
  if (!days || !start || !end) return;
  const earned = calculateEarningsProgress(latestMonthlyNet, new Date(), days.value, start.value, end.value);
  document.getElementById('earnedToday').textContent = formatCurrency(earned.today);
  document.getElementById('earnedWeek').textContent = formatCurrency(earned.week);
  document.getElementById('earnedYear').textContent = formatCurrency(earned.year);
}

function renderResults(result) {
  latestMonthlyNet = result.net;
  document.getElementById('netSalaryPreview').value = formatGroupedWholeAmount(result.net);
  const setValue = (amountId, percentId, amount) => {
    document.getElementById(amountId).textContent = formatCurrency(amount);
    document.getElementById(percentId).textContent = `(${formatPercentage(amount, result.gross)})`;
  };
  setValue('employeeContributions', 'employeeContributionsPercent', result.totalEmployeeContributions);
  setValue('healthInsurance', 'healthInsurancePercent', result.healthInsurance);
  setValue('socialInsurance', 'socialInsurancePercent', result.socialInsurance);
  setValue('taxBase', 'taxBasePercent', result.taxableBase);
  setValue('taxFreeDeduction', 'taxFreeDeductionPercent', result.taxFreeDeduction);
  setValue('taxAfterBonus', 'taxAfterBonusPercent', result.taxAfterBonus);
  setValue('taxBonus', 'taxBonusPercent', result.taxBonus);
  setValue('netAfterDeductions', 'netAfterDeductionsPercent', result.net);
  const taxValue = document.getElementById('taxAfterBonus');
  taxValue.classList.toggle('value-negative', result.taxAfterBonus >= 0);
  taxValue.classList.toggle('value-positive', result.taxAfterBonus < 0);
  renderSalaryChart(result);
  renderLiveEarnings();
}

function updateEligibilityControl(input, available, reason) {
  if (!input) return;
  const control = input.closest('.inline-control');
  const note = input.closest('.control-block')?.querySelector('.eligibility-note');
  input.disabled = !available;
  if (!available && input.type === 'checkbox') input.checked = false;
  if (control) { control.hidden = !available; control.style.display = available ? 'grid' : 'none'; }
  if (note) { note.textContent = reason; note.hidden = available; note.style.display = available ? 'none' : 'block'; }
}

function updateEligibility() {
  const grossInput = document.getElementById('grossSalary');
  const gross = Math.max(0, toNumber(grossInput?.value));
  const partialBase = gross - calculateEmployeeContributions(gross).total;
  const taxToggle = document.getElementById('taxFreeAllowance');
  const taxAvailable = calculateTaxFreeAllowance(partialBase) > 0;
  updateEligibilityControl(taxToggle, taxAvailable, taxAvailable
    ? 'Nezdaniteľná časť je pri tomto príjme dostupná.' : 'Pri tomto základe dane je nezdaniteľná časť nulová.');
  [
    ['childrenUnder15', 1, 0, 'Počet detí do 15 rokov', 'Pri tejto hrubej mzde už nevzniká bonus na deti do 15 rokov.'],
    ['children15to18', 0, 1, 'Počet detí vo veku 15 až 18 rokov', 'Pri tejto hrubej mzde už nevzniká bonus na deti vo veku 15 až 18 rokov.'],
  ].forEach(([id, young, older, activeText, inactiveText]) => {
    const input = document.getElementById(id);
    const available = calculateChildBonusMonthly(gross, partialBase, young, older).monthlyAfterReduction > 0;
    if (!available && input) input.value = 0;
    updateEligibilityControl(input, available, available ? activeText : inactiveText);
  });
}

function currentPayload() {
  return {
    gross: document.getElementById('grossSalary')?.value ?? 0,
    useTaxFree: document.getElementById('taxFreeAllowance')?.checked ?? false,
    deductibleItem: 0,
    childrenUnder15: document.getElementById('childrenUnder15')?.value ?? 0,
    children15to18: document.getElementById('children15to18')?.value ?? 0,
  };
}

function recalculate() { updateEligibility(); renderResults(calculateSalary(currentPayload())); }
function scheduleRecalculate() {
  clearTimeout(recalculateTimer);
  recalculateTimer = setTimeout(() => { recalculateTimer = undefined; recalculate(); }, RECALCULATE_DELAY);
}
function recalculateImmediately() { clearTimeout(recalculateTimer); recalculateTimer = undefined; recalculate(); }

function recalculateFromNet() {
  const grossInput = document.getElementById('grossSalary');
  const payload = currentPayload();
  delete payload.gross;
  if (grossInput) grossInput.value = formatGroupedWholeAmount(
    solveGrossForNet(document.getElementById('netSalaryPreview')?.value ?? 0, payload),
  );
  recalculate();
}

function recalculateFromNetIfChanged(event) {
  const input = event.currentTarget;
  const current = String(toNumber(input.value));
  if (input.dataset.originalValue === current) return;
  recalculateFromNet();
  input.dataset.originalValue = String(toNumber(input.value));
}

function setupDetailsAccordion() {
  const toggle = document.querySelector('.breakdown-row');
  const content = document.getElementById('salaryDetails');
  if (!toggle || !content) return;
  const action = () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    toggle.classList.toggle('is-collapsed', expanded);
    content.classList.toggle('is-collapsed', expanded);
    toggle.setAttribute('aria-label', toggle.getAttribute('aria-label').replace(
      expanded ? 'skryjete' : 'zobrazíte', expanded ? 'zobrazíte' : 'skryjete',
    ));
  };
  toggle.addEventListener('click', action);
  toggle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); }
  });
}

function setupEarningsPanel() {
  const toggle = document.querySelector('.earnings-toggle');
  const content = document.getElementById('earningsContent');
  const days = document.getElementById('workingDays');
  if (!toggle || !content || !days) return;
  days.value = countWeekdaysInMonth(new Date());
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    content.classList.toggle('is-collapsed', expanded);
  });
  ['workingDays', 'workStart', 'workEnd'].forEach((id) => document.getElementById(id)?.addEventListener('input', renderLiveEarnings));
  setInterval(renderLiveEarnings, 1000);
}

function setupForm() {
  const gross = document.getElementById('grossSalary');
  const net = document.getElementById('netSalaryPreview');
  gross?.addEventListener('input', scheduleRecalculate);
  ['taxFreeAllowance', 'childrenUnder15', 'children15to18'].forEach((id) =>
    document.getElementById(id)?.addEventListener('input', recalculateImmediately));
  ['childrenUnder15', 'children15to18'].forEach((id) =>
    document.getElementById(id)?.addEventListener('focus', (event) => event.target.select()));
  gross?.addEventListener('focus', (event) => {
    event.target.dataset.originalValue = String(toNumber(event.target.value)); event.target.select();
  });
  gross?.addEventListener('blur', (event) => {
    const value = toNumber(event.target.value);
    event.target.value = formatGroupedWholeAmount(value);
    if (event.target.dataset.originalValue === String(value)) { clearTimeout(recalculateTimer); recalculateTimer = undefined; }
  });
  net?.addEventListener('focus', (event) => {
    event.target.dataset.originalValue = String(toNumber(event.target.value)); event.target.select();
  });
  net?.addEventListener('blur', recalculateFromNetIfChanged);
  net?.addEventListener('change', recalculateFromNetIfChanged);
  net?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); recalculateFromNetIfChanged({ currentTarget: net }); net.blur(); }
  });
}

setupDetailsAccordion();
setupEarningsPanel();
setupForm();
recalculate();
