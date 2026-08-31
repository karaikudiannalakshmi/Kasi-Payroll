export const HOURS_PER_DAY     = 9;
export const HOURS_PER_DAY_NEW = 9;
export const SALARY_DIVISOR    = 26;

// New system active from September 2026
export const NEW_SYSTEM_FROM = '2026-09';
export function isNewSystem(yearMonth) { return yearMonth >= NEW_SYSTEM_FROM; }

export function getRates(monthlySalary, yearMonth) {
  const daily  = monthlySalary / SALARY_DIVISOR;
  const hourly = daily / HOURS_PER_DAY;
  return { daily, hourly, divisor: SALARY_DIVISOR, hpd: HOURS_PER_DAY };
}

// OLD system: hour-based
export function calcEmployeeSalaryOld(monthlySalary, hoursMap={}, holidays=[], yearMonth, fullPayAlways=false) {
  const { hourly, daily } = getRates(monthlySalary);
  if (fullPayAlways) {
    return {
      totalEffectiveHours: SALARY_DIVISOR * HOURS_PER_DAY,
      effectiveDays: SALARY_DIVISOR,
      grossSalary: monthlySalary,
      daily, hourly, dayDetails: [], fullPayAlways: true,
    };
  }
  const [yr, mo] = yearMonth.split('-').map(Number);
  const daysInMo = new Date(yr, mo, 0).getDate();
  let totalEffectiveHours = 0;
  const dayDetails = [];
  for (let d = 1; d <= daysInMo; d++) {
    const key     = String(d).padStart(2, '0');
    const isHol   = holidays.includes(key);
    const entered = Number(hoursMap[key] || 0);
    const eff     = isHol ? HOURS_PER_DAY + entered : entered;
    totalEffectiveHours += eff;
    dayDetails.push({ key, isHoliday: isHol, enteredHours: entered, effectiveHours: eff });
  }
  return {
    totalEffectiveHours,
    effectiveDays: +(totalEffectiveHours / HOURS_PER_DAY).toFixed(4),
    grossSalary:   Math.round(totalEffectiveHours * hourly),
    daily, hourly, dayDetails,
  };
}

// NEW system: tick + OT + Permission (still 9h/26 days)
export function calcEmployeeSalaryNew(monthlySalary, tickMap={}, holidays=[], otHours=0, permHours=0, yearMonth, fullPayAlways=false) {
  const { hourly, daily } = getRates(monthlySalary);
  if (fullPayAlways) {
    return {
      totalEffectiveHours: SALARY_DIVISOR * HOURS_PER_DAY,
      effectiveDays: SALARY_DIVISOR,
      grossSalary: monthlySalary,
      daily, hourly, presentDays: SALARY_DIVISOR,
      otHours: 0, permHours: 0, dayDetails: [], fullPayAlways: true,
    };
  }
  const [yr, mo] = yearMonth.split('-').map(Number);
  const daysInMo = new Date(yr, mo, 0).getDate();
  let presentDays = 0;
  const dayDetails = [];
  for (let d = 1; d <= daysInMo; d++) {
    const key     = String(d).padStart(2, '0');
    const isHol   = holidays.includes(key);
    const present = isHol || tickMap[key] === true;
    if (present) presentDays++;
    dayDetails.push({ key, isHol, present });
  }
  const ot   = Number(otHours)   || 0;
  const perm = Number(permHours) || 0;
  const totalEffectiveHours = Math.max(0, presentDays * HOURS_PER_DAY + ot - perm);
  return {
    totalEffectiveHours,
    effectiveDays: +(totalEffectiveHours / HOURS_PER_DAY).toFixed(4),
    grossSalary:   Math.round(totalEffectiveHours * hourly),
    daily, hourly, presentDays, otHours: ot, permHours: perm, dayDetails,
  };
}

// Router
export function calcEmployeeSalary(monthlySalary, attData={}, holidays=[], yearMonth, fullPayAlways=false) {
  if (isNewSystem(yearMonth)) {
    return calcEmployeeSalaryNew(
      monthlySalary,
      attData.ticks     || {},
      holidays,
      attData.otHours   || 0,
      attData.permHours || 0,
      yearMonth,
      fullPayAlways,
    );
  }
  return calcEmployeeSalaryOld(monthlySalary, attData, holidays, yearMonth, fullPayAlways);
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
