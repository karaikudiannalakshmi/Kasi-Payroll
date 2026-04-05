export const HOURS_PER_DAY = 9;
export const SALARY_DIVISOR = 26;

export function getRates(monthlySalary) {
  const daily  = monthlySalary / SALARY_DIVISOR;
  const hourly = daily / HOURS_PER_DAY;
  return { daily, hourly };
}

export function calcEmployeeSalary(monthlySalary, hoursMap = {}, holidays = [], yearMonth, fullPayAlways = false) {
  if (fullPayAlways) {
    const { hourly, daily } = getRates(monthlySalary);
    return {
      totalEffectiveHours: SALARY_DIVISOR * HOURS_PER_DAY,
      effectiveDays: SALARY_DIVISOR,
      grossSalary: monthlySalary,
      overtimeHours: 0,
      holidayWorkedHours: 0,
      daily, hourly,
      dayDetails: [],
      fullPayAlways: true,
    };
  }

  const { hourly, daily } = getRates(monthlySalary);
  const [yr, mo] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(yr, mo, 0).getDate();
  let totalEffectiveHours = 0;
  const dayDetails = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const key = String(d).padStart(2, '0');
    const isHoliday    = holidays.includes(key);
    const enteredHours = Number(hoursMap[key] || 0);
    let effectiveHours = 0;
    let type = 'absent';

    if (isHoliday) {
      effectiveHours = HOURS_PER_DAY + enteredHours;
      type = enteredHours > 0 ? 'holiday-worked' : 'holiday';
    } else {
      effectiveHours = enteredHours;
      if      (enteredHours > HOURS_PER_DAY) type = 'overtime';
      else if (enteredHours === HOURS_PER_DAY) type = 'full';
      else if (enteredHours > 0) type = 'partial';
    }

    totalEffectiveHours += effectiveHours;
    dayDetails.push({ key, isHoliday, enteredHours, effectiveHours, type });
  }

  return {
    totalEffectiveHours,
    effectiveDays: +(totalEffectiveHours / HOURS_PER_DAY).toFixed(4),
    grossSalary: Math.round(totalEffectiveHours * hourly),
    overtimeHours: 0,
    holidayWorkedHours: 0,
    daily, hourly,
    dayDetails,
  };
}

export function calcNetPay(grossSalary, advanceDeduction = 0, loanDeduction = 0) {
  return Math.max(0, grossSalary - advanceDeduction - loanDeduction);
}

export function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

export function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

export function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
