/**
 * Salary Calculation Logic — Kasi Kitchen Payroll
 *
 * Rules:
 *  • Standard day = 9 hours
 *  • Daily rate   = monthly salary / 26
 *  • Hourly rate  = daily rate / 9
 *
 * Holiday behaviour (paid holidays):
 *  • Not worked   → credit 9h automatically
 *  • Worked Xh   → credit 9h (holiday) + Xh (extra) = 9+X hours total
 *    (attendance entry for a holiday = EXTRA hours only; base 9h is auto-added)
 *
 * Regular day:
 *  • 0h = absent (no pay)
 *  • 1–8h = partial pay
 *  • 9h = full day
 *  • >9h = overtime included
 */

export const HOURS_PER_DAY = 9;
export const SALARY_DIVISOR = 26; // fixed denominator for monthly salary

/** Returns daily rate and hourly rate for an employee */
export function getRates(monthlySalary) {
  const daily = monthlySalary / SALARY_DIVISOR;
  const hourly = daily / HOURS_PER_DAY;
  return { daily, hourly };
}

/**
 * Calculate one employee's salary for a month.
 * @param {number}   monthlySalary
 * @param {Object}   hoursMap   - { "01": 9, "02": 0, ... }  (regular-day extra hours on holidays)
 * @param {string[]} holidays   - ["01","15"] — paid holiday date strings
 * @param {string}   yearMonth  - "YYYY-MM"
 */
/**
 * If fullPayAlways=true, return full monthly salary regardless of attendance
 */
export function calcEmployeeSalary(monthlySalary, hoursMap = {}, holidays = [], yearMonth, fullPayAlways = false) {
  if (fullPayAlways) {
    const { hourly, daily } = getRates(monthlySalary);
    const [yr, mo] = yearMonth.split('-').map(Number);
    const daysInMo = new Date(yr, mo, 0).getDate();
    const totalEffectiveHours = SALARY_DIVISOR * HOURS_PER_DAY; // 26 × 9 = 234
    return {
      totalEffectiveHours,
      effectiveDays: SALARY_DIVISOR,
      grossSalary: monthlySalary,
      overtimeHours: 0,
      holidayWorkedHours: 0,
      daily,
      hourly,
      dayDetails: [],
      fullPayAlways: true,
    };
  }
  const { hourly, daily } = getRates(monthlySalary);
  const [yr, mo] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(yr, mo, 0).getDate();

  let totalEffectiveHours = 0;
  let overtimeHours = 0;        // hours beyond 9 on a regular day
  let holidayWorkedHours = 0;   // extra hours on holiday days
  const dayDetails = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const key = String(d).padStart(2, '0');
    const isHoliday = holidays.includes(key);
    const enteredHours = Number(hoursMap[key] || 0);

    let effectiveHours = 0;
    let type = 'absent';

    if (isHoliday) {
      // always credit 9h holiday pay; extra = enteredHours
      effectiveHours = HOURS_PER_DAY + enteredHours;
      holidayWorkedHours += enteredHours;
      type = enteredHours > 0 ? 'holiday-worked' : 'holiday';
    } else {
      effectiveHours = enteredHours;
      if (enteredHours > HOURS_PER_DAY) {
        overtimeHours += enteredHours - HOURS_PER_DAY;
        type = 'overtime';
      } else if (enteredHours === HOURS_PER_DAY) {
        type = 'full';
      } else if (enteredHours > 0) {
        type = 'partial';
      }
    }

    const dayPay = effectiveHours * hourly;
    totalEffectiveHours += effectiveHours;
    dayDetails.push({ key, isHoliday, enteredHours, effectiveHours, dayPay, type });
  }

  const grossSalary = Math.round(totalEffectiveHours * hourly);
  const effectiveDays = +(totalEffectiveHours / HOURS_PER_DAY).toFixed(4);

  return {
    totalEffectiveHours,
    effectiveDays,
    grossSalary,
    overtimeHours,
    holidayWorkedHours,
    daily,
    hourly,
    dayDetails,
  };
}

/** Net pay after deductions */
export function calcNetPay(grossSalary, advanceDeduction = 0, loanDeduction = 0) {
  return Math.max(0, grossSalary - advanceDeduction - loanDeduction);
}

/** Format currency ₹ */
export function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

/** Month label, e.g. "2026-02" → "February 2026" */
export function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

/** Today's YYYY-MM */
export function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Days in a month */
export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
