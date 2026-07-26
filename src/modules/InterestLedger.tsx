import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Plus, Percent } from 'lucide-react';
import { useApp, useMembers } from '../lib/store';
import { supabase } from '../lib/supabase';
import { formatKES, formatKESShort, formatDate, sumInterest, toNum, round2, todayISO } from '../lib/finance';
import { logAudit } from '../lib/audit';
import { useToast } from '../lib/toast';
import { PageHeader, Card, Avatar, EmptyState, Modal, Spinner } from '../components/ui';
import { canManage, PERMISSIONS } from '../lib/rbac';
import type { RoleName, Profile, InterestRecord } from '../types';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

export function InterestLedger() {
  const { interestRecords, profiles, currentUser, refresh } = useApp();
  const { push } = useToast();
  const [recordOpen, setRecordOpen] = useState(false);
  const memberProfiles = useMembers();

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms = PERMISSIONS[role];
  const canEdit = canManage(perms, 'interest');

  const memberMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const total = sumInterest(interestRecords);

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of interestRecords) {
      const m = r.date_earned.slice(0, 7);
      map.set(m, (map.get(m) ?? 0) + toNum(r.interest_earned));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, interest]) => ({ month, label: monthLabel(month), interest: round2(interest) }));
  }, [interestRecords]);

  const ytd = interestRecords
    .filter((r) => r.date_earned.slice(0, 4) === String(new Date().getFullYear()))
    .reduce((a, r) => a + toNum(r.interest_earned), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Interest Ledger"
        subtitle="Historical interest yield matrix"
        actions={canEdit && (
          <button className="btn-success" onClick={() => setRecordOpen(true)}>
            <Percent size={16} /> Record interest
          </button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-ink-500">Total interest accrued</p>
          <p className="mt-1 text-xl font-bold text-ink-900">{formatKES(total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-500">YTD interest</p>
          <p className="mt-1 text-xl font-bold text-success-600">{formatKES(ytd)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-500">Records</p>
          <p className="mt-1 text-xl font-bold text-ink-900">{interestRecords.length}</p>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <TrendingUp size={16} className="text-success-600" /> Monthly interest earned
          </h2>
        </div>
        <div className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byMonth} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatKESShort(v).replace('KES ', '')} />
              <Tooltip formatter={(v: number) => [formatKES(v), 'Interest']} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Bar dataKey="interest" fill="#10B981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Interest records</h2>
        </div>
        {interestRecords.length === 0 ? (
          <EmptyState title="No interest records" description="Use the Record interest button to log interest for any month." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="px-5 py-3 font-semibold">Principal basis</th>
                  <th className="px-5 py-3 font-semibold">Interest earned</th>
                  <th className="px-5 py-3 font-semibold">Month</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {interestRecords.slice(0, 50).map((r) => {
                  const m = memberMap.get(r.member_id);
                  return (
                    <tr key={r.id} className="table-row-hover">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={m?.full_name ?? '?'} size={28} />
                          <span className="font-medium text-ink-900">{m?.full_name ?? 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-ink-600">{formatKES(r.principal_basis)}</td>
                      <td className="px-5 py-3 font-semibold text-success-600">{formatKES(r.interest_earned)}</td>
                      <td className="px-5 py-3 text-ink-600">{monthLabel(r.date_earned.slice(0, 7))}</td>
                      <td className="px-5 py-3"><span className="badge-info">{r.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {recordOpen && (
        <RecordInterestModal
          memberProfiles={memberProfiles}
          currentUser={currentUser}
          onClose={() => setRecordOpen(false)}
          onSaved={async () => { await refresh(); setRecordOpen(false); }}
          push={push}
        />
      )}
    </div>
  );
}

function RecordInterestModal({
  memberProfiles, currentUser, onClose, onSaved, push,
}: {
  memberProfiles: Profile[];
  currentUser: Profile | null;
  onClose: () => void;
  onSaved: () => void;
  push: (t: { kind: 'success' | 'error'; message: string; description?: string }) => void;
}) {
  const [mode, setMode] = useState<'bulk' | 'single'>('bulk');
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [bulkAmount, setBulkAmount] = useState(0);
  const [memberId, setMemberId] = useState(memberProfiles[0]?.id ?? '');
  const [singleAmount, setSingleAmount] = useState(0);
  const [principalBasis, setPrincipalBasis] = useState(0);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (mode === 'bulk') {
        if (bulkAmount <= 0) { push({ kind: 'error', message: 'Enter a total interest amount' }); setSaving(false); return; }
        // Record a single bulk interest entry for the month (no specific member)
        const { error } = await supabase.from('interest_records').insert({
          member_id: null,
          loan_id: null,
          principal_basis: 0,
          interest_earned: round2(bulkAmount),
          date_earned: month + '-01',
          status: 'Accrued',
          notes: `Bulk interest for ${monthLabel(month)}`,
          recorded_by: currentUser?.id ?? null,
        });
        if (error) throw error;
        await logAudit({
          user: currentUser,
          action: 'CREATE',
          target_table: 'interest_records',
          summary: `Recorded bulk interest ${formatKES(bulkAmount)} for ${monthLabel(month)}`,
          new_value: { interest_earned: bulkAmount, date_earned: month + '-01' },
        });
        push({ kind: 'success', message: 'Interest recorded', description: `${formatKES(bulkAmount)} for ${monthLabel(month)}` });
      } else {
        if (!memberId) { push({ kind: 'error', message: 'Select a member' }); setSaving(false); return; }
        if (singleAmount <= 0) { push({ kind: 'error', message: 'Interest amount must be positive' }); setSaving(false); return; }
        const { error } = await supabase.from('interest_records').insert({
          member_id: memberId,
          loan_id: null,
          principal_basis: round2(principalBasis),
          interest_earned: round2(singleAmount),
          date_earned: month + '-01',
          status: 'Accrued',
          notes: null,
          recorded_by: currentUser?.id ?? null,
        });
        if (error) throw error;
        await logAudit({
          user: currentUser,
          action: 'CREATE',
          target_table: 'interest_records',
          summary: `Recorded interest ${formatKES(singleAmount)} for ${memberProfiles.find((p) => p.id === memberId)?.full_name} — ${monthLabel(month)}`,
          new_value: { interest_earned: singleAmount, member_id: memberId, date_earned: month + '-01' },
        });
        push({ kind: 'success', message: 'Interest recorded', description: `${formatKES(singleAmount)} for ${memberProfiles.find((p) => p.id === memberId)?.full_name}` });
      }
      onSaved();
    } catch (err) {
      push({ kind: 'error', message: 'Failed to record interest', description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Record interest"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-success" disabled={saving} onClick={save}>
            {saving ? <Spinner label="Saving…" /> : 'Record'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${mode === 'bulk' ? 'border-success-300 bg-success-50 text-success-700' : 'border-ink-200 text-ink-500 hover:bg-ink-50'}`}
            onClick={() => setMode('bulk')}
          >
            Bulk (total for month)
          </button>
          <button
            className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${mode === 'single' ? 'border-success-300 bg-success-50 text-success-700' : 'border-ink-200 text-ink-500 hover:bg-ink-50'}`}
            onClick={() => setMode('single')}
          >
            Single member
          </button>
        </div>

        <div>
          <label className="label">Month</label>
          <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          <p className="mt-1 text-[11px] text-ink-400">Use any previous month to backfill records.</p>
        </div>

        {mode === 'bulk' ? (
          <div>
            <label className="label">Total interest for {monthLabel(month)} (KES)</label>
            <input className="input" type="number" min={0} value={bulkAmount} onChange={(e) => setBulkAmount(Number(e.target.value))} placeholder="e.g. 5000" />
            <p className="mt-1.5 text-xs text-ink-500">Records the combined interest for the entire month — ideal for previous months.</p>
          </div>
        ) : (
          <>
            <div>
              <label className="label">Member</label>
              <select className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                {memberProfiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Principal basis (KES)</label>
                <input className="input" type="number" min={0} value={principalBasis} onChange={(e) => setPrincipalBasis(Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Interest earned (KES)</label>
                <input className="input" type="number" min={0} value={singleAmount} onChange={(e) => setSingleAmount(Number(e.target.value))} />
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
