import { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, Wallet, TrendingUp, AlertCircle, Landmark, Coins,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useApp } from '../lib/store';
import {
  formatKES, formatKESShort, greeting, sumSubscriptions, sumFees,
  sumOutstandingLoanBalance, sumInterest, sumUnpaidFines, toNum,
  round2,
} from '../lib/finance';
import { Card, Avatar, StatusBadge } from '../components/ui';
import type { RoleName } from '../types';
import { PERMISSIONS } from '../lib/rbac';

const CHART_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#64748B'];

export function Dashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const {
    currentUser, profiles, subscriptions, membershipFees, loans,
    interestRecords, fines, snapshot,
  } = useApp();

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms = PERMISSIONS[role];
  const isMember = role === 'Member';

  const kpis = useMemo(() => {
    const activeMembers = profiles.filter((p) => p.status === 'Active').length;
    const totalSavings = round2(sumSubscriptions(subscriptions) + sumFees(membershipFees));
    const outstandingLoans = sumOutstandingLoanBalance(loans);
    const totalCash = toNum(snapshot?.cash_at_hand ?? snapshot?.total_assets ?? totalSavings);
    const unloanableReserve = round2(totalCash * 0.2);
    const loanable = round2(Math.max(0, totalCash - outstandingLoans - unloanableReserve));
    const interestYTD = sumInterest(
      interestRecords.filter((r) => r.date_earned?.slice(0, 4) === String(new Date().getFullYear()))
    );
    const interestTotal = sumInterest(interestRecords);
    const unpaidFines = sumUnpaidFines(fines);
    return { activeMembers, totalSavings, outstandingLoans, loanable, interestYTD, interestTotal, unpaidFines, unloanableReserve, totalCash };
  }, [profiles, subscriptions, membershipFees, loans, interestRecords, fines, snapshot]);

  const savingsTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of subscriptions) {
      const m = s.billing_month.slice(0, 7);
      map.set(m, (map.get(m) ?? 0) + toNum(s.amount_paid));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({ month, amount: round2(amount) }));
  }, [subscriptions]);

  const interestMatrix = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of interestRecords) {
      const m = r.date_earned.slice(0, 7);
      map.set(m, (map.get(m) ?? 0) + toNum(r.interest_earned));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, interest]) => ({ month, interest: round2(interest) }));
  }, [interestRecords]);

  const loanBreakdown = useMemo(() => {
    const groups: Record<string, number> = { Active: 0, Paid: 0, Overdue: 0, Defaulted: 0 };
    for (const l of loans) {
      if (groups[l.status] !== undefined) groups[l.status] += toNum(l.principal);
    }
    return Object.entries(groups)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value: round2(value) }));
  }, [loans]);

  const recentAudit = useApp().auditLogs.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
            {greeting()}, {currentUser?.full_name?.split(' ')[0] ?? 'Member'}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-info">{role}</span>
          <span className="badge-success">System Operational</span>
        </div>
      </div>

      {/* Colorful banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 50%, #4F46E5 100%)' }}>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-success-400/20 blur-2xl" />
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Welcome back to your association dashboard</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{formatKES(kpis.totalSavings)}</p>
            <p className="text-xs text-white/70">Total savings pool · {kpis.activeMembers} active members</p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-sm">
              <p className="text-xs text-white/70">Loanable</p>
              <p className="text-sm font-bold">{formatKESShort(kpis.loanable)}</p>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-sm">
              <p className="text-xs text-white/70">Interest YTD</p>
              <p className="text-sm font-bold">{formatKESShort(kpis.interestYTD)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Total Active Members"
          value={String(kpis.activeMembers)}
          icon={<Users size={20} />}
          accent="brand"
          trend="+1 this month"
          trendUp
        />
        <KpiCard
          label="Total Savings Pool"
          value={formatKES(kpis.totalSavings)}
          icon={<Coins size={20} />}
          accent="success"
          trend="+12.4% MoM"
          trendUp
        />
        <KpiCard
          label="Outstanding Loans Volume"
          value={formatKES(kpis.outstandingLoans)}
          icon={<Wallet size={20} />}
          accent="warning"
          trend="5 active loans"
        />
        <KpiCard
          label="Available Loanable Capital"
          value={formatKES(kpis.loanable)}
          icon={<Landmark size={20} />}
          accent="brand"
          trend={`20% reserve KES ${formatKESShort(kpis.unloanableReserve).replace('KES ', '')}`}
        />
        <KpiCard
          label="Interest Revenue (YTD)"
          value={formatKES(kpis.interestYTD)}
          icon={<TrendingUp size={20} />}
          accent="success"
          trend={`Total ${formatKESShort(kpis.interestTotal)}`}
          trendUp
        />
        <KpiCard
          label="Outstanding Deficit & Fines"
          value={formatKES(kpis.unpaidFines)}
          icon={<AlertCircle size={20} />}
          accent="danger"
          trend="Requires follow-up"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Savings Growth Trend</h2>
              <p className="text-xs text-ink-500">Month-over-month capital pool expansion</p>
            </div>
            <span className="badge-success">Growing</span>
          </div>
          <div className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={savingsTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatKESShort(v).replace('KES ', '')} />
                <Tooltip
                  formatter={(v: number) => [formatKES(v), 'Savings']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12, boxShadow: '0 10px 30px -10px rgba(15,23,42,0.2)' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#2563EB" strokeWidth={2.5} fill="url(#savingsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Loan Portfolio Status</h2>
            <p className="text-xs text-ink-500">Breakdown by status</p>
          </div>
          <div className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={loanBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {loanBreakdown.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatKES(v)} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Monthly Interest Earned Matrix</h2>
            <p className="text-xs text-ink-500">Historical interest yield</p>
          </div>
          <div className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={interestMatrix} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatKESShort(v).replace('KES ', '')} />
                <Tooltip formatter={(v: number) => [formatKES(v), 'Interest']} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Bar dataKey="interest" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Recent Activity</h2>
            <p className="text-xs text-ink-500">Immutable audit trail</p>
          </div>
          <div className="divide-y divide-ink-100">
            {recentAudit.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-ink-500">No activity yet</p>
            ) : (
              recentAudit.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                  <Avatar name={log.user_name ?? 'System'} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-ink-800">{log.summary ?? log.action}</p>
                    <p className="text-[11px] text-ink-400">
                      {log.user_name} · {new Date(log.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Member-only personal summary */}
      {isMember && currentUser && (
        <Card>
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">My Statement Summary</h2>
            <p className="text-xs text-ink-500">Personal account overview</p>
          </div>
          <MemberSummary memberId={currentUser.id} onNavigate={onNavigate} />
        </Card>
      )}

      {perms.audit !== 'none' && !isMember && (
        <Card>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Financial Snapshot</h2>
              <p className="text-xs text-ink-500">Audited consolidated position</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 px-5 pb-5 sm:grid-cols-4">
            <SnapshotItem label="Total Cash" value={formatKES(kpis.totalCash)} />
            <SnapshotItem label="Outstanding Loans" value={formatKES(kpis.outstandingLoans)} />
            <SnapshotItem label="Unloanable Reserve (20%)" value={formatKES(kpis.unloanableReserve)} />
            <SnapshotItem label="Loanable Pool" value={formatKES(kpis.loanable)} />
          </div>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  label, value, icon, accent, trend, trendUp,
}: {
  label: string; value: string; icon: React.ReactNode; accent: 'brand' | 'success' | 'warning' | 'danger';
  trend?: string; trendUp?: boolean;
}) {
  const accents = {
    brand: { bg: 'bg-brand-50', text: 'text-brand-600', grad: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' },
    success: { bg: 'bg-success-50', text: 'text-success-600', grad: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' },
    warning: { bg: 'bg-warning-50', text: 'text-warning-600', grad: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' },
    danger: { bg: 'bg-danger-50', text: 'text-danger-600', grad: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' },
  };
  return (
    <Card hover className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: accents[accent].grad }}>
          {icon}
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trendUp ? 'text-success-600' : 'text-ink-500'}`}>
            {trendUp && <ArrowUpRight size={12} />}
            {!trendUp && trend.includes('follow') && <ArrowDownRight size={12} />}
            {trend}
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-ink-900">{value}</p>
      <p className="mt-1 text-xs font-medium text-ink-500">{label}</p>
    </Card>
  );
}

function SnapshotItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 p-3.5">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-ink-900">{value}</p>
    </div>
  );
}

function MemberSummary({ memberId, onNavigate }: { memberId: string; onNavigate: (id: string) => void }) {
  const { subscriptions, membershipFees, loans, fines } = useApp();
  const mySubs = subscriptions.filter((s) => s.member_id === memberId);
  const myFees = membershipFees.filter((f) => f.member_id === memberId);
  const myLoans = loans.filter((l) => l.member_id === memberId);
  const myFines = fines.filter((f) => f.member_id === memberId);

  const totalSaved = round2(sumSubscriptions(mySubs) + sumFees(myFees));
  const totalBorrowed = myLoans.reduce((a, l) => a + toNum(l.principal), 0);
  const totalPaid = myLoans.reduce((a, l) => a + toNum(l.amount_paid), 0);
  const outstandingFines = sumUnpaidFines(myFines);

  return (
    <div className="grid grid-cols-2 gap-4 px-5 pb-5 sm:grid-cols-4">
      <SnapshotItem label="Total Saved" value={formatKES(totalSaved)} />
      <SnapshotItem label="Total Borrowed" value={formatKES(totalBorrowed)} />
      <SnapshotItem label="Total Repaid" value={formatKES(totalPaid)} />
      <SnapshotItem label="Outstanding Fines" value={formatKES(outstandingFines)} />
      <div className="col-span-2 mt-2 flex flex-wrap gap-2 sm:col-span-4">
        <button className="btn-ghost text-xs" onClick={() => onNavigate('loans')}>View my loans</button>
        <button className="btn-ghost text-xs" onClick={() => onNavigate('subscriptions')}>My subscriptions</button>
        <button className="btn-ghost text-xs" onClick={() => onNavigate('fines')}>My fines</button>
      </div>
      <div className="col-span-2 mt-2 sm:col-span-4">
        <div className="flex flex-wrap gap-2">
          {myLoans.map((l) => <StatusBadge key={l.id} status={l.status} />)}
        </div>
      </div>
    </div>
  );
}
