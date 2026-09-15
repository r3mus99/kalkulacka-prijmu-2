const {
  calculateSalary,
  solveGrossForNet,
  calculateEmployeeContributions,
  calculateTaxFreeAllowance,
  calculateChildBonusMonthly,
  monthlyAgeBonus,
  truncateCurrency,
  TAX_RULES,
} = require('./salary-calculator.js');
const { calculateEarningsProgress, countWeekdaysInMonth, timeToSeconds } = require('./earnings-progress.js');
const { toNumber, formatGroupedAmount, formatGroupedWholeAmount, formatCurrency, formatPercentage } = require('./formatters.js');

function assertEqual(actual, expected, label) {
  if (Math.abs(actual - expected) > 0.0001) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assert(condition, label) {
  if (!condition) {
    throw new Error(label);
  }
}

function assertStrict(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// reference case: 4300, no tax-free allowance, no children
const baseCase = calculateSalary({
  gross: 4300,
  useTaxFree: false,
  deductibleItem: 0,
  childrenUnder15: 0,
  children15to18: 0,
});

assertEqual(baseCase.gross, 4300, 'gross');
assertEqual(baseCase.healthInsurance, 215, 'health insurance');
assertEqual(baseCase.socialInsurance, 404.2, 'social insurance');
assertEqual(baseCase.taxableBase, 3680.8, 'taxable base');
assertEqual(baseCase.taxAfterBonus, 700.28, 'tax after bonus');
assertEqual(baseCase.net, 2980.52, 'net salary');

const refundableBonusCase = calculateSalary({
  gross: 1500,
  useTaxFree: true,
  deductibleItem: 0,
  childrenUnder15: 2,
  children15to18: 0,
});
assertEqual(refundableBonusCase.taxAfterBonus, -50.52, 'negative tax after child bonus');
assertEqual(refundableBonusCase.taxBonus, 200, 'two-child bonus');
assertEqual(refundableBonusCase.net, 1334.52, 'net including refundable child bonus');

// tax-free allowance should reduce taxable base
const taxFreeCase = calculateSalary({
  gross: 4300,
  useTaxFree: true,
  deductibleItem: 0,
  childrenUnder15: 0,
  children15to18: 0,
});
assertEqual(taxFreeCase.taxableBase, 3680.8, 'tax-free base at high income');

// at 4300 gross monthly, the partial tax base is high enough to remove the bonus
const childCase = calculateSalary({
  gross: 4300,
  useTaxFree: false,
  deductibleItem: 0,
  childrenUnder15: 1,
  children15to18: 1,
});
assert(childCase.childBonus.monthlyAfterReduction === 0, 'bonus disabled at 4300 gross');
assert(childCase.childBonus.monthlyBeforeReduction >= 100, 'under15 bonus value exists before reduction');

// below the reduction base, the full under-15 bonus is available
const belowThresholdCase = calculateSalary({
  gross: 1500,
  useTaxFree: false,
  deductibleItem: 0,
  childrenUnder15: 1,
  children15to18: 0,
});
assertEqual(belowThresholdCase.childBonus.monthlyAfterReduction, 100, 'full child bonus below threshold');

// at 3000 gross, the reference model applies the 0.866 percentage factor
// and then reduces the bonus above a 2286 EUR tax-base threshold.
const reducedCase = calculateSalary({
  gross: 3000,
  useTaxFree: false,
  deductibleItem: 0,
  childrenUnder15: 1,
  children15to18: 0,
});
assertEqual(reducedCase.childBonus.monthlyAfterReduction, 71.8, 'gradually reduced child bonus');

const olderChildCase = calculateSalary({
  gross: 3000,
  useTaxFree: false,
  deductibleItem: 0,
  childrenUnder15: 0,
  children15to18: 1,
});
assertEqual(olderChildCase.childBonus.monthlyAfterReduction, 21.8, 'older child bonus');

// At a low partial tax base, one child is capped at 29% of that base.
const percentageCapCase = calculateSalary({
  gross: 300,
  useTaxFree: false,
  deductibleItem: 0,
  childrenUnder15: 1,
  children15to18: 0,
});
assertEqual(percentageCapCase.childBonus.monthlyAfterReduction, 75.342, 'percentage cap');

// rule constants should be exposed for validation
assert(TAX_RULES.taxRate === 0.19, 'tax rate');
assert(TAX_RULES.bonusReductionBaseMonthly === 2286, 'reduction base');
assert(TAX_RULES.bonusPercentageLimits[1] === 0.29, 'one-child percentage limit');

// Reverse calculation should round-trip representative net salaries.
for (const reverseCase of [
  { gross: 1000, useTaxFree: false, childrenUnder15: 0, children15to18: 0 },
  { gross: 1500, useTaxFree: true, childrenUnder15: 0, children15to18: 0 },
  { gross: 3000, useTaxFree: false, childrenUnder15: 1, children15to18: 0 },
  { gross: 5000, useTaxFree: true, childrenUnder15: 1, children15to18: 1 },
]) {
  const original = calculateSalary({ ...reverseCase, deductibleItem: 0 });
  const solvedGross = solveGrossForNet(original.net, {
    useTaxFree: reverseCase.useTaxFree,
    deductibleItem: 0,
    childrenUnder15: reverseCase.childrenUnder15,
    children15to18: reverseCase.children15to18,
  });
  const roundTrip = calculateSalary({ ...reverseCase, gross: solvedGross, deductibleItem: 0 });
  assertEqual(
    Number(roundTrip.net.toFixed(2)),
    Number(original.net.toFixed(2)),
    `reverse calculation ${reverseCase.gross}`,
  );
}

// Boundary-focused matrix based on the reference calculator's discovered rules:
// low-income caps, allowance transition, 19%/25% tax transition, bonus reduction,
// refund behavior, age split, and both UI toggles.
const boundaryCases = [
  { name: 'low income, no children', gross: 300, useTaxFree: false, deductibleItem: 0, childrenUnder15: 0, children15to18: 0 },
  { name: 'one young child cap', gross: 400, useTaxFree: false, deductibleItem: 0, childrenUnder15: 1, children15to18: 0 },
  { name: 'two young children cap', gross: 650, useTaxFree: false, deductibleItem: 0, childrenUnder15: 2, children15to18: 0 },
  { name: 'mixed age children cap', gross: 650, useTaxFree: false, deductibleItem: 0, childrenUnder15: 1, children15to18: 1 },
  { name: '1000 no allowance', gross: 1000, useTaxFree: false, deductibleItem: 0, childrenUnder15: 0, children15to18: 0 },
  { name: '1000 allowance', gross: 1000, useTaxFree: true, deductibleItem: 0, childrenUnder15: 0, children15to18: 0 },
  { name: '1500 allowance', gross: 1500, useTaxFree: true, deductibleItem: 0, childrenUnder15: 0, children15to18: 0 },
  { name: 'allowance transition below', gross: 2160, useTaxFree: true, deductibleItem: 0, childrenUnder15: 0, children15to18: 0 },
  { name: 'allowance transition above', gross: 2165, useTaxFree: true, deductibleItem: 0, childrenUnder15: 0, children15to18: 0 },
  { name: 'bonus reduction below', gross: 2670, useTaxFree: false, deductibleItem: 0, childrenUnder15: 1, children15to18: 0 },
  { name: 'bonus reduction above', gross: 2680, useTaxFree: false, deductibleItem: 0, childrenUnder15: 1, children15to18: 0 },
  { name: 'bonus reduction with older child', gross: 3000, useTaxFree: false, deductibleItem: 0, childrenUnder15: 0, children15to18: 1 },
  { name: '19 percent tax band', gross: 3700, useTaxFree: false, deductibleItem: 0, childrenUnder15: 0, children15to18: 0 },
  { name: '25 percent tax band', gross: 3800, useTaxFree: false, deductibleItem: 0, childrenUnder15: 0, children15to18: 0 },
  { name: 'high income, no bonus', gross: 5000, useTaxFree: false, deductibleItem: 0, childrenUnder15: 1, children15to18: 1 },
  { name: 'high income with allowance', gross: 5000, useTaxFree: true, deductibleItem: 0, childrenUnder15: 0, children15to18: 0 },
  { name: 'deductible toggle off', gross: 1500, useTaxFree: false, deductibleItem: 0, childrenUnder15: 0, children15to18: 0 },
  { name: 'deductible value path', gross: 1500, useTaxFree: false, deductibleItem: 100, childrenUnder15: 0, children15to18: 0 },
];
let matrixCaseCount = 0;

for (const testCase of boundaryCases) {
  const result = calculateSalary(testCase);
  const label = `matrix ${testCase.name}`;

  assert(Number.isFinite(result.net), `${label}: net is finite`);
  assert(Number.isFinite(result.taxAfterBonus), `${label}: tax is finite`);
  assert(result.gross === testCase.gross, `${label}: gross preserved`);
  assert(result.taxableBase >= 0, `${label}: taxable base is non-negative`);
  assert(result.totalEmployeeContributions >= 0, `${label}: contributions are non-negative`);
  assert(result.childBonus.monthlyAfterReduction >= 0, `${label}: bonus is non-negative`);
  assert(
    result.childBonus.monthlyAfterReduction <= result.childBonus.monthlyBeforeReduction + 0.0001,
    `${label}: bonus does not exceed its age-based amount`,
  );
  assertEqual(
    result.net,
    result.gross - result.totalEmployeeContributions - result.taxAfterBonus,
    `${label}: net consistency`,
  );

  matrixCaseCount += 1;
}

assert(matrixCaseCount === 18, `matrix case count: expected 18, got ${matrixCaseCount}`);

const progressDate = new Date(2026, 5, 8, 12, 0, 0);
const earningsProgress = calculateEarningsProgress(2200, progressDate, 22, '08:00', '16:00');
assertEqual(earningsProgress.today, 50, 'half-day earnings progress');
assertEqual(earningsProgress.week, 50, 'Monday half-day weekly progress');
assertEqual(earningsProgress.month, 550, 'monthly earnings progress');
assertEqual(earningsProgress.year, 11550, 'yearly earnings progress');
assertEqual(countWeekdaysInMonth(new Date(2026, 5, 1)), 22, 'weekdays in June 2026');

// Formatting and input normalization are framework-independent contracts.
assertEqual(toNumber('1 234,56'), 1234.56, 'parse Slovak decimal');
assertEqual(toNumber('  9 876.50 '), 9876.5, 'parse grouped dot decimal');
assertEqual(toNumber(null), 0, 'parse null');
assertEqual(toNumber('invalid'), 0, 'parse invalid value');
assertStrict(formatGroupedAmount(1234567.8), '1 234 567.80', 'group decimal amount');
assertStrict(formatGroupedAmount(-1234.5), '-1 234.50', 'group negative amount');
assertStrict(formatGroupedWholeAmount(1234.6), '1 235', 'round and group whole amount');
assertStrict(formatCurrency(123456.7), '123 456.70 €', 'currency symbol placement');
assertStrict(formatPercentage(25, 200), '12.50 %', 'percentage formatting');
assertStrict(formatPercentage(25, 0), '0.00 %', 'zero-total percentage');

// Primitive payroll rules protect the migration from subtle rounding changes.
assertEqual(truncateCurrency(10.999), 10.99, 'currency truncation');
assertEqual(truncateCurrency(0.009), 0, 'sub-cent truncation');
const thousandContributions = calculateEmployeeContributions(1000);
assertEqual(thousandContributions.healthInsurance, 50, 'health contribution at 1000');
assertEqual(thousandContributions.socialInsurance, 94, 'social contribution at 1000');
assertEqual(thousandContributions.total, 144, 'total contribution at 1000');
assertEqual(calculateEmployeeContributions(-100).total, 0, 'negative gross contributions');
assertEqual(calculateTaxFreeAllowance(0), TAX_RULES.taxFreeAllowance, 'full allowance at zero base');
assertEqual(calculateTaxFreeAllowance(100000), 0, 'allowance removed at high base');
assertEqual(monthlyAgeBonus(2, 1).total, 250, 'combined age bonus');
assertEqual(monthlyAgeBonus(0, 0).total, 0, 'no-child bonus');
assertEqual(calculateChildBonusMonthly(0, 0, 1, 0).monthlyAfterReduction, 0, 'bonus cap at zero gross');

// Defensive salary inputs.
const emptySalary = calculateSalary({});
assertEqual(emptySalary.gross, 0, 'empty payload gross');
assertEqual(emptySalary.net, 0, 'empty payload net');
assertEqual(calculateSalary({ gross: -500 }).gross, 0, 'negative gross clamped');
assertEqual(calculateSalary({ gross: '1 500,00' }).gross, 1500, 'localized gross input');
assertEqual(solveGrossForNet(0, {}), 0, 'reverse zero net');
assertEqual(solveGrossForNet(-100, {}), 0, 'reverse negative net');

// Live earnings: before, during and after a shift, weekends and invalid schedules.
assertEqual(timeToSeconds('08:00'), 28800, 'parse shift start');
assertEqual(timeToSeconds('23:59'), 86340, 'parse end of day');
assertStrict(timeToSeconds('24:00'), null, 'reject invalid hour');
assertStrict(timeToSeconds('invalid'), null, 'reject invalid time');
const beforeShift = calculateEarningsProgress(2200, new Date(2026, 5, 8, 7, 0, 0), 22, '08:00', '16:00');
assertEqual(beforeShift.today, 0, 'before-shift today earnings');
assertEqual(beforeShift.week, 0, 'Monday before-shift weekly earnings');
assertEqual(beforeShift.month, 500, 'before-shift completed days');
const afterShift = calculateEarningsProgress(2200, new Date(2026, 5, 8, 18, 0, 0), 22, '08:00', '16:00');
assertEqual(afterShift.today, 100, 'after-shift full day');
assertEqual(afterShift.week, 100, 'Monday after-shift weekly earnings');
assertEqual(afterShift.month, 600, 'after-shift month earnings');
const weekend = calculateEarningsProgress(2200, new Date(2026, 5, 13, 12, 0, 0), 22, '08:00', '16:00');
assertEqual(weekend.today, 0, 'weekend today earnings');
assertEqual(weekend.week, 500, 'completed workweek earnings');
assertEqual(weekend.month, 1000, 'weekend completed days');
const invalidShift = calculateEarningsProgress(2200, new Date(2026, 5, 8, 12, 0, 0), 22, '16:00', '08:00');
assertEqual(invalidShift.today, 0, 'invalid shift today earnings');
assertEqual(invalidShift.month, 500, 'invalid shift preserves completed days');
const january = calculateEarningsProgress(2200, new Date(2026, 0, 5, 12, 0, 0), 22, '08:00', '16:00');
assertEqual(january.year, january.month, 'January yearly earnings');
assertEqual(calculateEarningsProgress(-2200, progressDate, 22, '08:00', '16:00').year, 0, 'negative net earnings');
assertEqual(countWeekdaysInMonth(new Date(2026, 1, 1)), 20, 'weekdays in February 2026');

console.log(`All tests passed (${matrixCaseCount} boundary cases plus module regression coverage)`);
