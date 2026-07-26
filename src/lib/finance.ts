import type {
  Loan,
  Subscription,
  MembershipFee,
  Fine,
  InterestRecord,
  Expense,
  Profile,
} from '../types';

export const MIN_RETAINED_CAPITAL = 1500;

export function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function formatKES(v: number | string | null | undefined, withSymbol = true): string {
  const n = toNum(v);
  const formatted = n.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `KES ${formatted}` : formatted;
}

export function formatKESShort(v: number | string | null | undefined): string {
  const n = toNum(v);
  if (Math.abs(n) >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `KES ${(n / 1_000).toFixed(1)}K`;
  return `KES ${n.toFixed(0)}`;
}

export function formatDate(v: string | Date | null): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(v: string | Date | null): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthsBetween(a: string | Date, b: string | Date = new Date()): number {
  const d1 = typeof a === 'string' ? new Date(a) : a;
  const d2 = typeof b === 'string' ? new Date(b) : b;
  return Math.max(
    0,
    (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth())
  );
}

export function daysBetween(a: string | Date, b: string | Date = new Date()): number {
  const d1 = typeof a === 'string' ? new Date(a) : a;
  const d2 = typeof b === 'string' ? new Date(b) : b;
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

// ===== Financial formulas =====

export function interestAmount(principal: number, rate = 5): number {
  return round2((principal * rate) / 100);
}

export function totalRepayable(principal: number, rate = 5): number {
  return round2(principal + interestAmount(principal, rate));
}

export function latePenalty(outstandingBalance: number, daysPastDue: number, rate = 0.01): number {
  if (daysPastDue <= 0) return 0;
  return round2(outstandingBalance * rate * daysPastDue);
}

export function loanablePool(
  totalAssets: number,
  fixedReserve: number,
  minRetained = MIN_RETAINED_CAPITAL
): number {
  return round2(Math.max(0, totalAssets - fixedReserve - minRetained));
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ===== Aggregations =====

export function sumSubscriptions(items: Subscription[]): number {
  return items.reduce((acc, s) => acc + toNum(s.amount_paid), 0);
}

export function sumFees(items: MembershipFee[]): number {
  return items.filter((f) => f.status === 'Paid').reduce((a, f) => a + toNum(f.amount), 0);
}

export function sumActiveLoanPrincipal(loans: Loan[]): number {
  return loans
    .filter((l) => l.status === 'Active' || l.status === 'Overdue' || l.status === 'Carried Forward')
    .reduce((a, l) => a + toNum(l.principal), 0);
}

export function sumOutstandingLoanBalance(loans: Loan[]): number {
  return loans
    .filter((l) => l.status === 'Active' || l.status === 'Overdue' || l.status === 'Defaulted' || l.status === 'Carried Forward')
    .reduce((a, l) => a + toNum(l.current_balance), 0);
}

export function sumOutstandingPrincipal(loans: Loan[]): number {
  return loans
    .filter((l) => l.status === 'Active' || l.status === 'Overdue' || l.status === 'Carried Forward')
    .reduce((a, l) => a + toNum(l.principal_balance), 0);
}

export function sumAccruedInterest(loans: Loan[]): number {
  return loans
    .filter((l) => l.status === 'Active' || l.status === 'Overdue' || l.status === 'Carried Forward')
    .reduce((a, l) => a + toNum(l.accrued_interest), 0);
}

export function sumInterest(items: InterestRecord[]): number {
  return items.reduce((a, i) => a + toNum(i.interest_earned), 0);
}

export function sumFines(items: Fine[]): number {
  return items.reduce((a, f) => a + toNum(f.amount), 0);
}

export function sumUnpaidFines(items: Fine[]): number {
  return items.filter((f) => f.status === 'Unpaid').reduce((a, f) => a + toNum(f.amount), 0);
}

export function sumExpenses(items: Expense[]): number {
  return items.reduce((a, e) => a + toNum(e.amount), 0);
}

// ===== Credit score =====

export interface CreditScoreInputs {
  paymentHistoryScore: number; // 0-100
  outstandingDebtRatio: number; // 0-1 (lower is better)
  tenureMonths: number; // capped at e.g. 24
  inauguralStatus: boolean; // active membership
  delinquencyDays: number; // days past due across loans
}

export function creditScore(inp: CreditScoreInputs): number {
  const payment = inp.paymentHistoryScore * 0.35;
  const debt = (1 - Math.min(1, Math.max(0, inp.outstandingDebtRatio))) * 100 * 0.3;
  const tenure = Math.min(100, (inp.tenureMonths / 24) * 100) * 0.15;
  const inaugural = (inp.inauguralStatus ? 100 : 0) * 0.1;

  // Delinquency deductions (0.10 weight max)
  let delinquencyPoints = 100;
  if (inp.delinquencyDays >= 1 && inp.delinquencyDays <= 7) delinquencyPoints = 50;
  else if (inp.delinquencyDays > 7) delinquencyPoints = 0;
  const delinquency = delinquencyPoints * 0.1;

  return Math.round(payment + debt + tenure + inaugural + delinquency);
}

export function scoreBand(score: number): {
  label: string; color: string; text: string;
} {
  if (score >= 750) return { label: 'Excellent', color: '#10B981', text: 'text-success-600' };
  if (score >= 650) return { label: 'Good', color: '#2563EB', text: 'text-brand-600' };
  if (score >= 500) return { label: 'Fair', color: '#F59E0B', text: 'text-warning-600' };
  if (score >= 350) return { label: 'Poor', color: '#F97316', text: 'text-orange-600' };
  return { label: 'High Risk', color: '#EF4444', text: 'text-danger-600' };
}

// ===== Pre-qualification engine =====

export interface QualificationCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export function qualifyForLoan(
  profile: Profile,
  loans: Loan[],
  subscriptions: Subscription[],
  minTenureMonths = 3
): { eligible: boolean; checks: QualificationCheck[] } {
  const checks: QualificationCheck[] = [];

  checks.push({
    label: 'Active membership',
    passed: profile.status === 'Active',
    detail: profile.status === 'Active' ? 'Profile is Active.' : `Profile is ${profile.status}.`,
  });

  const hasBadLoan = loans.some(
    (l) => l.status === 'Overdue' || l.status === 'Defaulted' || l.status === 'Carried Forward'
  );
  checks.push({
    label: 'No overdue or defaulted loans',
    passed: !hasBadLoan,
    detail: hasBadLoan ? 'Member has an overdue/defaulted loan on record.' : 'No delinquent loans.',
  });

  const tenure = monthsBetween(profile.join_date);
  checks.push({
    label: `Minimum ${minTenureMonths}-month tenure`,
    passed: tenure >= minTenureMonths,
    detail: tenure >= minTenureMonths
      ? `${tenure} months since registration.`
      : `Only ${tenure} months; need ${minTenureMonths}.`,
  });

  const subs = [...subscriptions].sort((a, b) => a.billing_month.localeCompare(b.billing_month));
  const onTime = subs.every((s) => s.status === 'Paid');
  checks.push({
    label: 'On-time subscription history',
    passed: onTime && subs.length > 0,
    detail: onTime && subs.length > 0
      ? `${subs.length} subscriptions fully paid.`
      : 'Some subscriptions unpaid or partially paid.',
  });

  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastMonthKey = lastMonth.toISOString().slice(0, 7);
  const clearedPrior = subs.some(
    (s) => s.billing_month.slice(0, 7) === lastMonthKey && s.status === 'Paid'
  );
  checks.push({
    label: 'Cleared up to prior month',
    passed: clearedPrior,
    detail: clearedPrior
      ? 'Subscriptions cleared through prior operational month.'
      : 'Prior month subscription not cleared.',
  });

  return { eligible: checks.every((c) => c.passed), checks };
}

// ===== Loan status workflow =====

export const LOAN_WORKFLOW: Record<string, string[]> = {
  Draft: ['Submitted'],
  Submitted: ['Under Review', 'Rejected'],
  'Under Review': ['Approved', 'Rejected'],
  Approved: ['Disbursed'],
  Rejected: [],
  Disbursed: ['Active'],
  Active: ['Paid', 'Overdue', 'Carried Forward'],
  Overdue: ['Active', 'Defaulted', 'Carried Forward'],
  Defaulted: ['Carried Forward'],
  'Carried Forward': ['Active'],
  Paid: [],
};

export function nextStatuses(current: string): string[] {
  return LOAN_WORKFLOW[current] ?? [];
}

// ===== Carry-forward =====
// When a loan term ends with an unpaid balance, the outstanding principal +
// accrued interest can be rolled into a brand-new loan. The old loan is marked
// 'Carried Forward' and points the new loan via carry_forward_from.

export function buildCarryForwardLoan(source: Loan, newRate = 5): {
  principal: number;
  interest_amount: number;
  total_repayable: number;
  principal_balance: number;
  accrued_interest: number;
} {
  const carriedPrincipal = round2(toNum(source.principal_balance) + toNum(source.accrued_interest));
  const newInterest = interestAmount(carriedPrincipal, newRate);
  const repayable = round2(carriedPrincipal + newInterest);
  return {
    principal: carriedPrincipal,
    interest_amount: newInterest,
    total_repayable: repayable,
    principal_balance: carriedPrincipal,
    accrued_interest: newInterest,
  };
}

// ===== M-PESA 2026 transaction charges (Safaricom tariff) =====
// Source: Safaricom official M-PESA tariff, transfer to M-PESA users / Pochi La Biashara
const MPESA_TARIFF: [number, number, number][] = [
  //  [minKES, maxKES, charge]
  [1,       49,     0],
  [50,      100,    0],
  [101,     500,    7],
  [501,     1000,   13],
  [1001,    1500,   23],
  [1501,    2500,   33],
  [2501,    3500,   53],
  [3501,    5000,   57],
  [5001,    7500,   78],
  [7501,    10000,  90],
  [10001,   15000,  100],
  [15001,   20000,  105],
  [20001,   35000,  108],
  [35001,   50000,  108],
  [50001,   250000, 108],
];

export function mpesaTransactionCost(amount: number): number {
  for (const [min, max, charge] of MPESA_TARIFF) {
    if (amount >= min && amount <= max) return charge;
  }
  return 108; // default cap
}

// ===== Split repayment (principal + interest paid together) =====
// A single payment is split: interest is settled first, then principal.
// Returns the split and the resulting balances.

export function splitRepayment(
  loan: Loan,
  paymentAmount: number
): {
  interest_paid: number;
  principal_paid: number;
  new_principal_balance: number;
  new_accrued_interest: number;
  new_amount_paid: number;
  new_current_balance: number;
  is_fully_paid: boolean;
} {
  const amount = round2(Math.max(0, paymentAmount));
  const interestDue = round2(toNum(loan.accrued_interest));
  const principalDue = round2(toNum(loan.principal_balance));

  // Settle interest first
  const interest_paid = round2(Math.min(amount, interestDue));
  const remaining = round2(amount - interest_paid);
  // Then principal
  const principal_paid = round2(Math.min(remaining, principalDue));

  const new_accrued_interest = round2(interestDue - interest_paid);
  const new_principal_balance = round2(principalDue - principal_paid);
  const new_amount_paid = round2(toNum(loan.amount_paid) + amount);
  const new_current_balance = round2(new_principal_balance + new_accrued_interest);
  const is_fully_paid = new_current_balance <= 0;

  return {
    interest_paid,
    principal_paid,
    new_principal_balance,
    new_accrued_interest,
    new_amount_paid,
    new_current_balance,
    is_fully_paid,
  };
}
