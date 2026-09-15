(function exposeEarningsProgress(root) {
  const { toNumber } = typeof module !== 'undefined'
    ? require('./formatters.js')
    : root.SalaryFormatters;

  function countWeekdaysInMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let day = 1; day <= lastDay; day += 1) {
      const weekday = new Date(year, month, day).getDay();
      if (weekday !== 0 && weekday !== 6) count += 1;
    }
    return count;
  }

  function timeToSeconds(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return (hours * 60 + minutes) * 60;
  }

  function calculateEarningsProgress(monthlyNet, now, workingDays, startTime, endTime) {
    const safeNet = Math.max(0, toNumber(monthlyNet));
    const days = Math.max(1, Math.floor(toNumber(workingDays)) || countWeekdaysInMonth(now));
    const startSeconds = timeToSeconds(startTime);
    const endSeconds = timeToSeconds(endTime);
    const validShift = startSeconds !== null && endSeconds !== null && endSeconds > startSeconds;
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    let completedWorkdays = 0;
    let todayWorkdayNumber = 0;

    for (let day = 1; day <= now.getDate(); day += 1) {
      const weekday = new Date(now.getFullYear(), now.getMonth(), day).getDay();
      if (weekday === 0 || weekday === 6) continue;
      todayWorkdayNumber += 1;
      if (day < now.getDate()) completedWorkdays += 1;
    }

    const isScheduledToday = now.getDay() !== 0 && now.getDay() !== 6 && todayWorkdayNumber <= days;
    const todayProgress = isScheduledToday && validShift
      ? Math.min(1, Math.max(0, (currentSeconds - startSeconds) / (endSeconds - startSeconds)))
      : 0;
    const monthEarned = Math.min(safeNet, (safeNet / days) * (Math.min(days, completedWorkdays) + todayProgress));
    const todayEarned = (safeNet / days) * todayProgress;
    return {
      year: safeNet * now.getMonth() + monthEarned,
      month: monthEarned,
      today: todayEarned,
    };
  }

  const api = { countWeekdaysInMonth, timeToSeconds, calculateEarningsProgress };
  if (typeof module !== 'undefined') module.exports = api;
  if (root) root.EarningsProgress = api;
}(typeof window !== 'undefined' ? window : undefined));
