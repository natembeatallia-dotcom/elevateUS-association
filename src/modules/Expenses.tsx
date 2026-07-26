import { useMemo, useState } from 'react';
import { Plus, PieChart as PieChartIcon, Pencil, Search } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useApp } from '../lib/store';
import { supabase } from '../lib/supabase';
import { formatKES, formatDate, sumExpenses, toNum, round2, todayISO } from '../lib/finance';
import { logAudit } from '../lib/audit';
import { useToast } from '../lib/toast';
import {
  PageHeader, Card, StatusBadge, EmptyState, Modal,
} from '../components/ui';
import { canManage, PERMISSIONS } from '../lib/rbac';
import type { RoleName, Expense, Profile } from '../types';

const CATEGORIES = [
  'Welfare Provisions', 'Social Tokens', 'Welfare Presentation', 'Seasonal Tokens',
  'Operational Maintenance', 'Asset Gathering', 'Operational Write-off', 'Other',
];
const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#64748B'];

export function Expenses() {
  const { expenses, currentUser, refresh } = useApp();
  const { push } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms = PERMISSIONS[role];
  const canEdit = canManage(perms, 'expenses');

  const total = sumExpenses(expenses);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const e of expenses) set.add(e.date_spent.slice(0, 7));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (monthFilter !== 'all' && e.date_spent.slice(0, 7) !== monthFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (e.description ?? '').toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [expenses, monthFilter, search]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      map.set(e.category, (map.get(e.category) ?? 0) + toNum(e.amount));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: round2(value) }));
  }, [filtered]);

  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of filtered) {
      const key = e.date_spent.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expense Tracker"
        subtitle="Operational outflows audit log"
        actions={canEdit && (
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={16} /> Log expense
          </button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-ink-500">Total expenses</p>
          <p className="mt-1 text-xl font-bold text-ink-900">{formatKES(total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-500">Entries</p>
          <p className="mt-1 text-xl font-bold text-ink-900">{expenses.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-500">Categories</p>
          <p className="mt-1 text-xl font-bold text-ink-900">{byCategory.length}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9" placeholder="Search description or category…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input sm:w-40" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="all">All months</option>
            {availableMonths.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Expense ledger</h2>
          </div>
          {grouped.length === 0 ? (
            <EmptyState title="No expenses logged" />
          ) : (
            <div className="space-y-4 px-2 pb-4">
              {grouped.map(([month, rows]) => (
                <div key={month}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="badge-info">{month}</span>
                    <span className="text-xs text-ink-500">{rows.length} entries · {formatKES(rows.reduce((a, e) => a + toNum(e.amount), 0))}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500">
                          <th className="px-5 py-2 font-semibold">Date</th>
                          <th className="px-5 py-2 font-semibold">Category</th>
                          <th className="px-5 py-2 font-semibold">Amount</th>
                          <th className="hidden px-5 py-2 font-semibold md:table-cell">Description</th>
                          {canEdit && <th className="px-5 py-2 text-right font-semibold">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {rows.map((e) => (
                          <tr key={e.id} className="table-row-hover">
                            <td className="px-5 py-3 text-ink-600">{formatDate(e.date_spent)}</td>
                            <td className="px-5 py-3"><span className="badge-neutral">{e.category}</span></td>
                            <td className="px-5 py-3 font-semibold text-ink-900">{formatKES(e.amount)}</td>
                            <td className="hidden px-5 py-3 text-ink-600 md:table-cell max-w-xs truncate">{e.description ?? '—'}</td>
                            {canEdit && (
                              <td className="px-5 py-3 text-right">
                                <button className="btn-ghost text-xs" onClick={() => setEditing(e)}>
                                  <Pencil size={13} /> Edit
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <PieChartIcon size={16} className="text-brand-600" /> By category
            </h2>
          </div>
          <div className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatKES(v)} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {addOpen && (
        <ExpenseModal
          currentUser={currentUser}
          onClose={() => setAddOpen(false)}
          onSaved={async () => { await refresh(); setAddOpen(false); }}
          push={push}
        />
      )}

      {editing && (
        <ExpenseModal
          currentUser={currentUser}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { await refresh(); setEditing(null); }}
          push={push}
        />
      )}
    </div>
  );
}

function ExpenseModal({
  currentUser, existing, onClose, onSaved, push,
}: {
  currentUser: Profile | null;
  existing?: Expense;
  onClose: () => void;
  onSaved: () => void;
  push: (t: { kind: 'success' | 'error'; message: string; description?: string }) => void;
}) {
  const [amount, setAmount] = useState(existing?.amount ?? 0);
  const [date, setDate] = useState(existing?.date_spent?.slice(0, 10) ?? todayISO());
  const [category, setCategory] = useState(existing?.category ?? CATEGORIES[0]);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [saving, setSaving] = useState(false);

  const isEdit = !!existing;

  const save = async () => {
    if (amount <= 0) { push({ kind: 'error', message: 'Amount must be positive' }); return; }
    setSaving(true);
    try {
      const payload: Partial<Expense> = {
        amount: round2(amount),
        date_spent: date,
        category,
        description: description || null,
      };
      if (isEdit) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', existing!.id);
        if (error) throw error;
        await logAudit({
          user: currentUser,
          action: 'UPDATE',
          target_table: 'expenses',
          target_id: existing!.id,
          summary: `Edited expense ${formatKES(amount)} (${category})`,
          new_value: payload,
        });
        push({ kind: 'success', message: 'Expense updated' });
      } else {
        const { error } = await supabase.from('expenses').insert(payload);
        if (error) throw error;
        await logAudit({
          user: currentUser,
          action: 'CREATE',
          target_table: 'expenses',
          summary: `Logged expense ${formatKES(amount)} (${category})`,
          new_value: payload,
        });
        push({ kind: 'success', message: 'Expense logged' });
      }
      onSaved();
    } catch (err) {
      push({ kind: 'error', message: 'Save failed', description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit expense' : 'Log expense'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : isEdit ? 'Update' : 'Log'}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount (KES)</label>
            <input className="input" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
