export const HOURS_PER_DAY     = 9;
export const HOURS_PER_DAY_NEW = 9;  // kept for DailySheet import compatibility
export const SALARY_DIVISOR    = 26;

// New system permanently disabled — always use 9h/26 days
export const NEW_SYSTEM_FROM = '2099-01';
export function isNewSystem() { return false; }

export function getRates(monthlySalary) {
  const daily  = monthlySalary / SALARY_DIVISOR;
  const hourly = daily / HOURS_PER_DAY;
  return { daily, hourly, divisor: SALARY_DIVISOR, hpd: HOURS_PER_DAY };
}

export function calcEmployeeSalary(monthlySalary, attData={}, holidays=[], yearMonth, fullPayAlways=false) {
  const { hourly, daily } = getRates(monthlySalary);
  if (fullPayAlways) {
    return {
      totalEffectiveHours: SALARY_DIVISOR * HOURS_PER_DAY,
      effectiveDays: SALARY_DIVISOR,
      grossSalary: monthlySalary,
      daily, hourly, dayDetails: [], fullPayAlways: true,
    };
  }
  // attData may be hours map {day: hours} — support both old and tick format gracefully
  const hoursMap = attData.ticks ? {} : attData;
  const [yr, mo] = yearMonth.split('-').map(Number);
  const daysInMo = new Date(yr, mo, 0).getDate();
  let totalEffectiveHours = 0;
  const dayDetails = [];
  for (let d = 1; d <= daysInMo; d++) {
    const key     = String(d).padStart(2, '0');
    const isHol   = holidays.includes(key);
    const entered = Number(hoursMap[key] || 0);
    const effective = isHol ? HOURS_PER_DAY + entered : entered;
    totalEffectiveHours += effective;
    dayDetails.push({ key, isHoliday: isHol, enteredHours: entered, effectiveHours: effective });
  }
  return {
    totalEffectiveHours,
    effectiveDays: +(totalEffectiveHours / HOURS_PER_DAY).toFixed(4),
    grossSalary:   Math.round(totalEffectiveHours * hourly),
    daily, hourly, dayDetails,
  };
}

export function calcNetPay(gross, adv=0, loan=0) { return Math.max(0, gross-adv-loan); }
export function fmt(n) { return '₹'+Number(n||0).toLocaleString('en-IN'); }
export function monthLabel(ym) {
  if (!ym) return '';
  const [y,m] = ym.split('-');
  return new Date(Number(y),Number(m)-1,1).toLocaleString('en-IN',{month:'long',year:'numeric'});
}
export function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
export function daysInMonth(ym) {
  const [y,m] = ym.split('-').map(Number);
  return new Date(y,m,0).getDate();
}
