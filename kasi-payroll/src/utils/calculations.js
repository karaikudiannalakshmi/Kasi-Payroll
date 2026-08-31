export const HOURS_PER_DAY_OLD = 9;
export const HOURS_PER_DAY_NEW = 8;
export const SALARY_DIVISOR_OLD = 26;
export const SALARY_DIVISOR_NEW = 24;

// Month from which new system applies
export const NEW_SYSTEM_FROM = '2026-04';

export function isNewSystem(yearMonth) {
  return yearMonth >= NEW_SYSTEM_FROM;
}

export function getRates(monthlySalary, yearMonth) {
  const divisor = isNewSystem(yearMonth) ? SALARY_DIVISOR_NEW : SALARY_DIVISOR_OLD;
  const hpd     = isNewSystem(yearMonth) ? HOURS_PER_DAY_NEW : HOURS_PER_DAY_OLD;
  const daily   = monthlySalary / divisor;
  const hourly  = daily / hpd;
  return { daily, hourly, divisor, hpd };
}

// OLD system: hour-based attendance
export function calcEmployeeSalaryOld(monthlySalary, hoursMap={}, holidays=[], yearMonth, fullPayAlways=false) {
  const { hourly, daily, hpd } = getRates(monthlySalary, yearMonth);
  if (fullPayAlways) {
    return {
      totalEffectiveHours: SALARY_DIVISOR_OLD * HOURS_PER_DAY_OLD,
      effectiveDays: SALARY_DIVISOR_OLD,
      grossSalary: monthlySalary,
      daily, hourly, hpd,
      dayDetails: [], fullPayAlways: true,
    };
  }
  const [yr, mo] = yearMonth.split('-').map(Number);
  const daysInMo = new Date(yr, mo, 0).getDate();
  let totalEffectiveHours = 0;
  const dayDetails = [];
  for (let d = 1; d <= daysInMo; d++) {
    const key = String(d).padStart(2,'00');
    const isHoliday = holidays.includes(key);
    const entered   = Number(hoursMap[key]||0);
    const effective = isHoliday ? hpd + entered : entered;
    totalEffectiveHours += effective;
    dayDetails.push({ key, isHoliday, enteredHours: entered, effectiveHours: effective });
  }
  return {
    totalEffectiveHours,
    effectiveDays: +(totalEffectiveHours / hpd).toFixed(4),
    grossSalary:   Math.round(totalEffectiveHours * hourly),
    daily, hourly, hpd, dayDetails,
  };
}

// NEW system: tick-based + OT + Permission
export function calcEmployeeSalaryNew(monthlySalary, tickMap={}, holidays=[], otHours=0, permHours=0, yearMonth, fullPayAlways=false) {
  const { hourly, daily, hpd, divisor } = getRates(monthlySalary, yearMonth);
  if (fullPayAlways) {
    return {
      totalEffectiveHours: divisor * hpd,
      effectiveDays: divisor,
      grossSalary: monthlySalary,
      daily, hourly, hpd, divisor,
      presentDays: divisor, otHours: 0, permHours: 0,
      dayDetails: [], fullPayAlways: true,
    };
  }
  const [yr, mo] = yearMonth.split('-').map(Number);
  const daysInMo = new Date(yr, mo, 0).getDate();
  let presentDays = 0;
  const dayDetails = [];
  for (let d = 1; d <= daysInMo; d++) {
    const key     = String(d).padStart(2,'0');
    const isHol   = holidays.includes(key);
    const present = isHol || tickMap[key] === true;
    if (present) presentDays++;
    dayDetails.push({ key, isHol, present });
  }
  const ot   = Number(otHours)   || 0;
  const perm = Number(permHours) || 0;
  const totalEffectiveHours = presentDays * hpd + ot - perm;
  return {
    totalEffectiveHours: Math.max(0, totalEffectiveHours),
    effectiveDays: +(Math.max(0, totalEffectiveHours) / hpd).toFixed(4),
    grossSalary:   Math.round(Math.max(0, totalEffectiveHours) * hourly),
    daily, hourly, hpd, divisor,
    presentDays, otHours: ot, permHours: perm,
    dayDetails,
  };
}

// Router — picks old or new based on month
export function calcEmployeeSalary(monthlySalary, attData={}, holidays=[], yearMonth, fullPayAlways=false) {
  if (isNewSystem(yearMonth)) {
    return calcEmployeeSalaryNew(
      monthlySalary,
      attData.ticks || {},
      holidays,
      attData.otHours || 0,
      attData.permHours || 0,
      yearMonth,
      fullPayAlways,
    );
  } else {
    return calcEmployeeSalaryOld(monthlySalary, attData, holidays, yearMonth, fullPayAlways);
  }
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
