(function exposeSalaryCalculator(root) {
  const { toNumber } = typeof module !== 'undefined'
    ? require('./formatters.js')
    : root.SalaryFormatters;

  const MINIMUM_LIVING_AMOUNT = 284.13;
  const TAX_FREE_ALLOWANCE = 497.23;
  const HEALTH_INSURANCE_RATE = 0.05;
  const SOCIAL_INSURANCE_RATE = 0.014 + 0.04 + 0.03 + 0.01;
  const TAX_RATE = 0.19;
  const HIGHER_TAX_RATE = 0.25;
  const HIGHER_TAX_THRESHOLD_MONTHLY = (154.8 * MINIMUM_LIVING_AMOUNT) / 12;
  const TAX_FREE_ALLOWANCE_THRESHOLD_MONTHLY = (91.8 * MINIMUM_LIVING_AMOUNT) / 12;
  const TAX_FREE_ALLOWANCE_FORMULA_BASE = 44.2 * MINIMUM_LIVING_AMOUNT;
  const CHILD_BONUS_UNDER_15 = 100;
  const CHILD_BONUS_15_TO_18 = 50;
  const CHILD_BONUS_REDUCTION_BASE_MONTHLY = 2286;
  const CHILD_BONUS_REDUCTION_RATE = 0.1;
  const CHILD_BONUS_PERCENTAGE_LIMITS = [0, 0.29, 0.36, 0.43, 0.50, 0.57, 0.64];
  const CHILD_BONUS_PERCENTAGE_FACTOR = 0.866;

  const TAX_RULES = {
    taxFreeAllowance: TAX_FREE_ALLOWANCE,
    minimumLivingAmount: MINIMUM_LIVING_AMOUNT,
    healthInsuranceRate: HEALTH_INSURANCE_RATE,
    socialInsuranceRate: SOCIAL_INSURANCE_RATE,
    taxRate: TAX_RATE,
    higherTaxRate: HIGHER_TAX_RATE,
    higherTaxThresholdMonthly: HIGHER_TAX_THRESHOLD_MONTHLY,
    taxFreeAllowanceThresholdMonthly: TAX_FREE_ALLOWANCE_THRESHOLD_MONTHLY,
    childBonus: { under15: CHILD_BONUS_UNDER_15, age15to18: CHILD_BONUS_15_TO_18 },
    bonusReductionBaseMonthly: CHILD_BONUS_REDUCTION_BASE_MONTHLY,
    bonusReductionRate: CHILD_BONUS_REDUCTION_RATE,
    bonusPercentageLimits: CHILD_BONUS_PERCENTAGE_LIMITS,
    bonusPercentageFactor: CHILD_BONUS_PERCENTAGE_FACTOR,
  };

  function truncateCurrency(value) {
    return Math.floor(value * 100) / 100;
  }

  function calculateEmployeeContributions(gross) {
    const safeGross = Math.max(0, toNumber(gross));
    const socialInsurance = [0.014, 0.04, 0.03, 0.01]
      .reduce((total, rate) => total + truncateCurrency(safeGross * rate), 0);
    const healthInsurance = truncateCurrency(safeGross * TAX_RULES.healthInsuranceRate);
    return { socialInsurance, healthInsurance, total: socialInsurance + healthInsurance };
  }

  function calculateTaxFreeAllowance(partialTaxBaseMonthly) {
    if (partialTaxBaseMonthly < TAX_RULES.taxFreeAllowanceThresholdMonthly) return TAX_RULES.taxFreeAllowance;
    return Math.max(0, truncateCurrency(
      (TAX_FREE_ALLOWANCE_FORMULA_BASE - (partialTaxBaseMonthly * 12) / 3) / 12,
    ));
  }

  function monthlyAgeBonus(childrenUnder15, children15to18) {
    const under15 = childrenUnder15 * TAX_RULES.childBonus.under15;
    const age15to18 = children15to18 * TAX_RULES.childBonus.age15to18;
    return { under15, age15to18, total: under15 + age15to18 };
  }

  function calculateChildBonusMonthly(grossMonthly, partialTaxBaseMonthly, childrenUnder15, children15to18) {
    const monthlyBonus = monthlyAgeBonus(childrenUnder15, children15to18);
    const childCount = childrenUnder15 + children15to18;
    const percentageLimit = TAX_RULES.bonusPercentageLimits[Math.min(childCount, 6)] || 0;
    const monthlyPercentageCap = Math.max(0, grossMonthly) * percentageLimit * TAX_RULES.bonusPercentageFactor;
    const fullBonusAvailable = monthlyBonus.total <= monthlyPercentageCap;
    let reducedUnder15 = fullBonusAvailable ? monthlyBonus.under15 : monthlyPercentageCap;
    let reducedAge15to18 = fullBonusAvailable ? monthlyBonus.age15to18 : monthlyPercentageCap;
    const monthlyReduction = Math.max(0, partialTaxBaseMonthly - TAX_RULES.bonusReductionBaseMonthly)
      * TAX_RULES.bonusReductionRate;

    if (partialTaxBaseMonthly > TAX_RULES.bonusReductionBaseMonthly) {
      reducedUnder15 = Math.max(0, (CHILD_BONUS_UNDER_15 - monthlyReduction) * childrenUnder15);
      reducedAge15to18 = Math.max(0, (CHILD_BONUS_15_TO_18 - monthlyReduction) * children15to18);
    }
    const monthlyAfterReduction = fullBonusAvailable
      ? reducedUnder15 + reducedAge15to18
      : Math.max(reducedUnder15, reducedAge15to18);
    return {
      monthlyBeforeReduction: monthlyBonus.total,
      annualBeforeReduction: monthlyBonus.total * 12,
      annualReduction: (monthlyBonus.total - monthlyAfterReduction) * 12,
      annualAfterReduction: monthlyAfterReduction * 12,
      monthlyAfterReduction,
      ageBreakdown: { under15: reducedUnder15, age15to18: reducedAge15to18, total: monthlyAfterReduction },
      monthlyReduction,
      monthlyPercentageCap,
    };
  }

  function calculateSalary(payload = {}) {
    const gross = Math.max(0, toNumber(payload.gross));
    const deductibleItem = Math.max(0, toNumber(payload.deductibleItem));
    const childrenUnder15 = Math.max(0, toNumber(payload.childrenUnder15));
    const children15to18 = Math.max(0, toNumber(payload.children15to18));
    const contributions = calculateEmployeeContributions(gross);
    const taxableBaseBeforeAllowance = Math.max(0, gross - contributions.total);
    const taxFreeDeduction = payload.useTaxFree ? calculateTaxFreeAllowance(taxableBaseBeforeAllowance) : 0;
    const taxableBase = Math.max(0, taxableBaseBeforeAllowance - taxFreeDeduction - deductibleItem);
    const roundedTaxableBase = truncateCurrency(taxableBase);
    const incomeTax = roundedTaxableBase > TAX_RULES.higherTaxThresholdMonthly
      ? truncateCurrency(TAX_RULES.higherTaxRate * (roundedTaxableBase - TAX_RULES.higherTaxThresholdMonthly)
        + TAX_RULES.taxRate * TAX_RULES.higherTaxThresholdMonthly)
      : truncateCurrency(TAX_RULES.taxRate * roundedTaxableBase);
    const bonusModel = calculateChildBonusMonthly(gross, taxableBaseBeforeAllowance, childrenUnder15, children15to18);
    const taxAfterBonus = incomeTax - bonusModel.monthlyAfterReduction;
    return {
      gross,
      socialInsurance: contributions.socialInsurance,
      healthInsurance: contributions.healthInsurance,
      totalEmployeeContributions: contributions.total,
      taxableBaseBeforeAllowance,
      taxFreeDeduction,
      deductibleItem,
      taxableBase,
      incomeTax,
      childBonus: {
        monthlyBeforeReduction: bonusModel.monthlyBeforeReduction,
        monthlyAfterReduction: bonusModel.monthlyAfterReduction,
        annualBeforeReduction: bonusModel.annualBeforeReduction,
        annualAfterReduction: bonusModel.annualAfterReduction,
        annualReduction: bonusModel.annualReduction,
        ageBreakdown: bonusModel.ageBreakdown,
      },
      taxBonus: bonusModel.monthlyAfterReduction,
      taxAfterBonus,
      net: gross - contributions.total - taxAfterBonus,
      rules: TAX_RULES,
    };
  }

  function solveGrossForNet(targetNet, payload = {}) {
    const target = Math.max(0, toNumber(targetNet));
    if (target === 0) return 0;
    let lower = 0;
    let upper = Math.max(1000, target * 2 + 1000);
    while (calculateSalary({ ...payload, gross: upper }).net < target && upper < 1000000) upper *= 2;
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (calculateSalary({ ...payload, gross: middle }).net < target) lower = middle;
      else upper = middle;
    }
    const candidates = [Math.max(0, Math.floor(upper * 100) / 100), Math.max(0, Math.ceil(upper * 100) / 100)];
    return Number(candidates.sort((a, b) => Math.abs(calculateSalary({ ...payload, gross: a }).net - target)
      - Math.abs(calculateSalary({ ...payload, gross: b }).net - target))[0].toFixed(2));
  }

  const api = {
    calculateSalary, solveGrossForNet, calculateEmployeeContributions, calculateTaxFreeAllowance,
    calculateChildBonusMonthly, monthlyAgeBonus, truncateCurrency, TAX_FREE_ALLOWANCE,
    SOCIAL_INSURANCE_RATE, HEALTH_INSURANCE_RATE, TAX_RATE, TAX_RULES,
  };
  if (typeof module !== 'undefined') module.exports = api;
  if (root) root.SalaryCalculator = api;
}(typeof window !== 'undefined' ? window : undefined));
