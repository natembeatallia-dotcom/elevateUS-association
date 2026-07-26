import { useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Download, FileSpreadsheet, TrendingUp, Wallet, ArrowDownCircle, ArrowUpCircle, Filter, Database } from 'lucide-react';
import { useApp, useMembers } from '../lib/store';
import { formatKES, formatKESShort, toNum, round2 } from '../lib/finance';
import { PageHeader, Card } from '../components/ui';

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#64748B'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

function toCSV(rows: Record<string, unknown>[], headers: { key: string; label: string }[]): string {
  const head = headers.map((h) => h.label).join(',');
  const body = rows.map((r) =>
    headers.map((h) => {
      const v = r[h.key];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  );
  return [head, ...body].join('\n');
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

type GroupBy = 'month' | 'year' | 'all';

export function Analytics() {
  const { subscriptions, loans, interestRecords, expenses, fines, profiles } = useApp();
  const memberProfiles = useMembers();
  const [reportType, setReportType] = useState<'monthly' | 'loans' | 'members'>('monthly');
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [selectedMember, setSelectedMember] = useState<string>('all');

  // Filter by selected member if applicable
  const memberFilter = (memberId: string) => selectedMember === 'all' || memberId === selectedMember;

  const savingsTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of subscriptions) {
      if (!memberFilter(s.member_id)) continue;
      const key = s.billing_month.slice(0, groupBy === 'year' ? 4 : 7);
      map.set(key, (map.get(key) ?? 0) + toNum(s.amount_paid));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([key, amount]) => ({
      key, label: groupBy === 'year' ? key : monthLabel(key), amount: round2(amount),
    }));
  }, [subscriptions, groupBy, selectedMember]);

  const interestTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of interestRecords) {
      if (r.member_id && !memberFilter(r.member_id)) continue;
      const key = r.date_earned.slice(0, groupBy === 'year' ? 4 : 7);
      map.set(key, (map.get(key) ?? 0) + toNum(r.interest_earned));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([key, interest]) => ({
      key, label: groupBy === 'year' ? key : monthLabel(key), interest: round2(interest),
    }));
  }, [interestRecords, groupBy, selectedMember]);

  const expenseByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      const key = e.date_spent.slice(0, groupBy === 'year' ? 4 : 7);
      map.set(key, (map.get(key) ?? 0) + toNum(e.amount));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([key, amount]) => ({
      key, label: groupBy === 'year' ? key : monthLabel(key), amount: round2(amount),
    }));
  }, [expenses, groupBy]);

  const loanStatus = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const l of loans) {
      if (!memberFilter(l.member_id)) continue;
      groups[l.status] = (groups[l.status] ?? 0) + toNum(l.principal);
    }
    return Object.entries(groups).map(([name, value]) => ({ name, value: round2(value) }));
  }, [loans, selectedMember]);

  const combined = useMemo(() => {
    const allKeys = new Set<string>([...savingsTrend.map((s) => s.key), ...interestTrend.map((s) => s.key), ...expenseByMonth.map((s) => s.key)]);
    return Array.from(allKeys).sort().map((k) => ({
      key: k,
      label: groupBy === 'year' ? k : monthLabel(k),
      savings: savingsTrend.find((s) => s.key === k)?.amount ?? 0,
      interest: interestTrend.find((s) => s.key === k)?.interest ?? 0,
      expenses: expenseByMonth.find((s) => s.key === k)?.amount ?? 0,
      net: round2(
        (savingsTrend.find((s) => s.key === k)?.amount ?? 0) +
        (interestTrend.find((s) => s.key === k)?.interest ?? 0) -
        (expenseByMonth.find((s) => s.key === k)?.amount ?? 0)
      ),
    }));
  }, [savingsTrend, interestTrend, expenseByMonth, groupBy]);

  const totalSavings = round2(savingsTrend.reduce((a, s) => a + s.amount, 0));
  const totalInterest = round2(interestTrend.reduce((a, s) => a + s.interest, 0));
  const totalExpenses = round2(expenseByMonth.reduce((a, s) => a + s.amount, 0));
  const netPosition = round2(totalSavings + totalInterest - totalExpenses);

  const downloadReport = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const memberName = selectedMember === 'all' ? 'all-members' : (memberProfiles.find((p) => p.id === selectedMember)?.full_name ?? 'member').replace(/\s+/g, '-').toLowerCase();

    if (reportType === 'monthly') {
      const rows = combined.map((r) => ({
        period: r.label,
        savings: r.savings,
        interest: r.interest,
        expenses: r.expenses,
        net: r.net,
      }));
      const csv = toCSV(rows, [
        { key: 'period', label: groupBy === 'year' ? 'Year' : 'Month' },
        { key: 'savings', label: 'Savings (KES)' },
        { key: 'interest', label: 'Interest (KES)' },
        { key: 'expenses', label: 'Expenses (KES)' },
        { key: 'net', label: 'Net (KES)' },
      ]);
      downloadFile(`elevateus-summary-${groupBy}-${memberName}-${dateStr}.csv`, csv, 'text/csv');
    } else if (reportType === 'loans') {
      const memberMap = new Map(profiles.map((p) => [p.id, p.full_name]));
      const filteredLoans = selectedMember === 'all' ? loans : loans.filter((l) => l.member_id === selectedMember);
      const rows = filteredLoans.map((l) => ({
        member: memberMap.get(l.member_id) ?? 'Unknown',
        principal: round2(toNum(l.principal)),
        interest: round2(toNum(l.interest_amount)),
        transaction_cost: round2(toNum(l.transaction_cost)),
        total_repayable: round2(toNum(l.total_repayable)),
        amount_paid: round2(toNum(l.amount_paid)),
        balance: round2(toNum(l.current_balance)),
        status: l.status,
        due_date: l.due_date ?? '',
      }));
      const csv = toCSV(rows, [
        { key: 'member', label: 'Member' },
        { key: 'principal', label: 'Principal (KES)' },
        { key: 'interest', label: 'Interest (KES)' },
        { key: 'transaction_cost', label: 'Transaction Cost (KES)' },
        { key: 'total_repayable', label: 'Total Repayable (KES)' },
        { key: 'amount_paid', label: 'Amount Paid (KES)' },
        { key: 'balance', label: 'Balance (KES)' },
        { key: 'status', label: 'Status' },
        { key: 'due_date', label: 'Due Date' },
      ]);
      downloadFile(`elevateus-loans-${memberName}-${dateStr}.csv`, csv, 'text/csv');
    } else {
      const memberMap = new Map(profiles.map((p) => [p.id, p]));
      const targetProfiles = selectedMember === 'all' ? profiles.filter((p) => !p.is_system) : profiles.filter((p) => p.id === selectedMember);
      const rows = targetProfiles.map((p) => {
        const mySubs = subscriptions.filter((s) => s.member_id === p.id);
        const myLoans = loans.filter((l) => l.member_id === p.id);
        const myFines = fines.filter((f) => f.member_id === p.id);
        return {
          name: p.full_name,
          email: p.email ?? '',
          role: p.role?.role_name ?? 'Member',
          status: p.status,
          total_saved: round2(mySubs.reduce((a, s) => a + toNum(s.amount_paid), 0)),
          total_borrowed: round2(myLoans.reduce((a, l) => a + toNum(l.principal), 0)),
          total_repaid: round2(myLoans.reduce((a, l) => a + toNum(l.amount_paid), 0)),
          outstanding_fines: round2(myFines.filter((f) => f.status === 'Unpaid').reduce((a, f) => a + toNum(f.amount), 0)),
          join_date: p.join_date,
        };
      });
      const csv = toCSV(rows, [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' },
        { key: 'status', label: 'Status' },
        { key: 'total_saved', label: 'Total Saved (KES)' },
        { key: 'total_borrowed', label: 'Total Borrowed (KES)' },
        { key: 'total_repaid', label: 'Total Repaid (KES)' },
        { key: 'outstanding_fines', label: 'Outstanding Fines (KES)' },
        { key: 'join_date', label: 'Join Date' },
      ]);
      downloadFile(`elevateus-members-${memberName}-${dateStr}.csv`, csv, 'text/csv');
    }
  };

  const downloadAllData = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const sections: string[] = [];
    const memberMap = new Map(profiles.map((p) => [p.id, p.full_name]));

    const pushSection = (title: string, rows: Record<string, unknown>[], headers: { key: string; label: string }[]) => {
      sections.push(`\n# ${title}\n`);
      sections.push(toCSV(rows, headers));
    };

    pushSection('PROFILES', profiles.map((p) => ({
      name: p.full_name, email: p.email ?? '', role: p.role?.role_name ?? 'Member',
      status: p.status, phone: p.phone ?? '', join_date: p.join_date,
    })), [
      { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' }, { key: 'status', label: 'Status' },
      { key: 'phone', label: 'Phone' }, { key: 'join_date', label: 'Join Date' },
    ]);

    pushSection('SUBSCRIPTIONS', subscriptions.map((s) => ({
      member: memberMap.get(s.member_id) ?? 'Unknown',
      billing_month: s.billing_month, amount_paid: round2(toNum(s.amount_paid)),
      method: s.payment_method ?? '', reference: s.reference ?? '', date: s.payment_date ?? '',
    })), [
      { key: 'member', label: 'Member' }, { key: 'billing_month', label: 'Billing Month' },
      { key: 'amount_paid', label: 'Amount Paid (KES)' }, { key: 'method', label: 'Method' },
      { key: 'reference', label: 'Reference' }, { key: 'date', label: 'Date' },
    ]);

    pushSection('LOANS', loans.map((l) => ({
      member: memberMap.get(l.member_id) ?? 'Unknown',
      principal: round2(toNum(l.principal)), interest: round2(toNum(l.interest_amount)),
      transaction_cost: round2(toNum(l.transaction_cost)), total_repayable: round2(toNum(l.total_repayable)),
      amount_paid: round2(toNum(l.amount_paid)), balance: round2(toNum(l.current_balance)),
      status: l.status, due_date: l.due_date ?? '',
    })), [
      { key: 'member', label: 'Member' }, { key: 'principal', label: 'Principal (KES)' },
      { key: 'interest', label: 'Interest (KES)' }, { key: 'transaction_cost', label: 'Transaction Cost (KES)' },
      { key: 'total_repayable', label: 'Total Repayable (KES)' }, { key: 'amount_paid', label: 'Amount Paid (KES)' },
      { key: 'balance', label: 'Balance (KES)' }, { key: 'status', label: 'Status' },
      { key: 'due_date', label: 'Due Date' },
    ]);

    pushSection('INTEREST RECORDS', interestRecords.map((r) => ({
      member: r.member_id ? (memberMap.get(r.member_id) ?? 'Unknown') : 'Bulk',
      date_earned: r.date_earned, interest_earned: round2(toNum(r.interest_earned)),
      description: r.description ?? '',
    })), [
      { key: 'member', label: 'Member' }, { key: 'date_earned', label: 'Date Earned' },
      { key: 'interest_earned', label: 'Interest (KES)' }, { key: 'description', label: 'Description' },
    ]);

    pushSection('FINES', fines.map((f) => ({
      member: memberMap.get(f.member_id) ?? 'Unknown', amount: round2(toNum(f.amount)),
      reason: f.reason, status: f.status, date_issued: f.date_issued,
    })), [
      { key: 'member', label: 'Member' }, { key: 'amount', label: 'Amount (KES)' },
      { key: 'reason', label: 'Reason' }, { key: 'status', label: 'Status' },
      { key: 'date_issued', label: 'Date Issued' },
    ]);

    pushSection('EXPENSES', expenses.map((e) => ({
      amount: round2(toNum(e.amount)), category: e.category, description: e.description,
      date_spent: e.date_spent, paid_by: memberMap.get(e.paid_by) ?? 'Unknown',
    })), [
      { key: 'amount', label: 'Amount (KES)' }, { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description' }, { key: 'date_spent', label: 'Date' },
      { key: 'paid_by', label: 'Paid By' },
    ]);

    downloadFile(`elevateus-all-data-${dateStr}.csv`, sections.join('\n'), 'text/csv');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics & Reports"
        subtitle="Financial trends, portfolio composition & member health"
      />

      {/* Report controls */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
            <Filter size={14} /> Report filters
          </div>
          <div className="flex flex-1 flex-wrap gap-2">
            <select className="input w-auto text-xs" value={reportType} onChange={(e) => setReportType(e.target.value as typeof reportType)}>
              <option value="monthly">Monthly summary</option>
              <option value="loans">Loan portfolio</option>
              <option value="members">Member statement</option>
            </select>
            <select className="input w-auto text-xs" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
              <option value="month">Group by month</option>
              <option value="year">Group by year</option>
              <option value="all">All time (no grouping)</option>
            </select>
            <select className="input w-auto text-xs" value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)}>
              <option value="all">All members</option>
              {memberProfiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            <button className="btn-primary text-xs" onClick={downloadReport}>
              <Download size={15} /> Download CSV
            </button>
            <button className="btn-secondary text-xs" onClick={downloadAllData}>
              <Database size={15} /> Download all data
            </button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Wallet size={15} className="text-brand-600" />
            <p className="text-xs text-ink-500">Total savings</p>
          </div>
          <p className="mt-1 text-xl font-bold text-ink-900">{formatKES(totalSavings)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-success-600" />
            <p className="text-xs text-ink-500">Total interest</p>
          </div>
          <p className="mt-1 text-xl font-bold text-success-600">{formatKES(totalInterest)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <ArrowDownCircle size={15} className="text-warning-600" />
            <p className="text-xs text-ink-500">Total expenses</p>
          </div>
          <p className="mt-1 text-xl font-bold text-warning-600">{formatKES(totalExpenses)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <ArrowUpCircle size={15} className={netPosition >= 0 ? 'text-success-600' : 'text-danger-600'} />
            <p className="text-xs text-ink-500">Net position</p>
          </div>
          <p className={`mt-1 text-xl font-bold ${netPosition >= 0 ? 'text-success-600' : 'text-danger-600'}`}>{formatKES(netPosition)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Savings vs Interest (combined)</h2>
            <p className="text-xs text-ink-500">Capital pool and yield over time</p>
          </div>
          <div className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={combined} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="intGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatKESShort(v).replace('KES ', '')} />
                <Tooltip formatter={(v: number) => formatKES(v)} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="savings" stroke="#2563EB" strokeWidth={2} fill="url(#savGrad)" />
                <Area type="monotone" dataKey="interest" stroke="#10B981" strokeWidth={2} fill="url(#intGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Expense outflows</h2>
            <p className="text-xs text-ink-500">Operational outflows over time</p>
          </div>
          <div className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={expenseByMonth} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatKESShort(v).replace('KES ', '')} />
                <Tooltip formatter={(v: number) => formatKES(v)} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Bar dataKey="amount" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Loan portfolio composition</h2>
            <p className="text-xs text-ink-500">By status</p>
          </div>
          <div className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={loanStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {loanStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatKES(v)} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Net cash flow</h2>
            <p className="text-xs text-ink-500">Savings + Interest − Expenses</p>
          </div>
          <div className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={combined} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatKESShort(v).replace('KES ', '')} />
                <Tooltip formatter={(v: number) => formatKES(v)} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Bar dataKey="net" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <FileSpreadsheet size={16} className="text-brand-600" /> Summary table
          </h2>
          <p className="text-xs text-ink-500">
            All figures in KES · grouped by {groupBy === 'year' ? 'year' : groupBy === 'all' ? 'all time' : 'month'}
            {selectedMember !== 'all' && ` · filtered to ${memberProfiles.find((p) => p.id === selectedMember)?.full_name ?? 'selected member'}`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="px-5 py-3 font-semibold">{groupBy === 'year' ? 'Year' : 'Month'}</th>
                <th className="px-5 py-3 text-right font-semibold">Savings</th>
                <th className="px-5 py-3 text-right font-semibold">Interest</th>
                <th className="px-5 py-3 text-right font-semibold">Expenses</th>
                <th className="px-5 py-3 text-right font-semibold">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {combined.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-ink-500">No data for the selected filters</td></tr>
              ) : (
                combined.map((r) => (
                  <tr key={r.key} className="table-row-hover">
                    <td className="px-5 py-3 font-medium text-ink-900">{r.label}</td>
                    <td className="px-5 py-3 text-right text-ink-700">{formatKES(r.savings)}</td>
                    <td className="px-5 py-3 text-right text-success-600">{formatKES(r.interest)}</td>
                    <td className="px-5 py-3 text-right text-warning-600">{formatKES(r.expenses)}</td>
                    <td className={`px-5 py-3 text-right font-semibold ${r.net >= 0 ? 'text-success-600' : 'text-danger-600'}`}>{formatKES(r.net)}</td>
                  </tr>
                ))
              )}
              <tr className="border-t-2 border-ink-200 bg-ink-50 font-bold">
                <td className="px-5 py-3 text-ink-900">Totals</td>
                <td className="px-5 py-3 text-right text-ink-900">{formatKES(totalSavings)}</td>
                <td className="px-5 py-3 text-right text-success-700">{formatKES(totalInterest)}</td>
                <td className="px-5 py-3 text-right text-warning-700">{formatKES(totalExpenses)}</td>
                <td className={`px-5 py-3 text-right ${netPosition >= 0 ? 'text-success-700' : 'text-danger-700'}`}>{formatKES(netPosition)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Interest yield trend</h2>
          <p className="text-xs text-ink-500">Historical interest revenue</p>
        </div>
        <div className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={interestTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatKESShort(v).replace('KES ', '')} />
              <Tooltip formatter={(v: number) => formatKES(v)} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Line type="monotone" dataKey="interest" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
