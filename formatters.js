(function exposeFormatters(root) {
  function toNumber(value) {
    const normalized = String(value ?? '').replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatGroupedAmount(value) {
    const [integerPart, decimalPart] = Number(value).toFixed(2).split('.');
    return `${integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${decimalPart}`;
  }

  function formatGroupedWholeAmount(value) {
    return Math.round(Number(value)).toLocaleString('sk-SK').replace(/\u00a0/g, ' ');
  }

  function formatCurrency(value) {
    return `${formatGroupedAmount(value)} €`;
  }

  function formatPercentage(value, total) {
    return total > 0 ? `${((value / total) * 100).toFixed(2)} %` : '0.00 %';
  }

  const api = { toNumber, formatGroupedAmount, formatGroupedWholeAmount, formatCurrency, formatPercentage };
  if (typeof module !== 'undefined') module.exports = api;
  if (root) root.SalaryFormatters = api;
}(typeof window !== 'undefined' ? window : undefined));
