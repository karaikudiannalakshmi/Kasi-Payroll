export const HOURS_PER_DAY = 9;
export const SALARY_DIVISOR = 26;
export function getRates(monthlySalary) {
  const daily = monthlySalary / SALARY_DIVISOR;
  return { daily, hourly: daily / HOURS_PER_DAY };
}
export function calcEmployeeSalary(monthlySalary, hoursMap={}, holidays=[], yearMonth, fullPayAlways=false) {
  if (fullPayAlways) {
    const { hourly, daily } = getRates(monthlySalary);
    return { totalEffectiveHours: SALARY_DIVISOR*HOURS_PER_DAY, effectiveDays: SALARY_DIVISOR,
      grossSalary: monthlySalary, overtimeHours:0, holidayWorkedHours:0, daily, hourly, dayDetails:[], fullPayAlways:true };
  }
  const { hourly, daily } = getRates(monthlySalary);
  const [yr, mo] = yearMonth.split('-').map(Number);
  const daysInMo = new Date(yr, mo, 0).getDate();
  let totalEffectiveHours = 0;
  const dayDetails = [];
  for (let d = 1; d <= daysInMo; d++) {
    const key = String(d).padStart(2,'0');
    const isHoliday = holidays.includes(key);
    const entered = Number(hoursMap[key]||0);
    let effective = isHoliday ? HOURS_PER_DAY + entered : entered;
    totalEffectiveHours += effective;
    dayDetails.push({ key, isHoliday, enteredHours: entered, effectiveHours: effective });
  }
  return {
    totalEffectiveHours,
    effectiveDays: +(totalEffectiveHours/HOURS_PER_DAY).toFixed(4),
    grossSalary: Math.round(totalEffectiveHours * hourly),
    overtimeHours:0, holidayWorkedHours:0, daily, hourly, dayDetails,
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
