import { useMemo, useState } from 'react';
import { Plus, Search, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp, useMembers } from '../lib/store';
import { supabase } from '../lib/supabase';
import { formatKES, formatDate, toNum, round2, todayISO } from '../lib/finance';
import { logAudit } from '../lib/audit';
import { useToast } from '../lib/toast';
import {
  PageHeader, Card, Avatar, StatusBadge, EmptyState, Modal,
} from '../components/ui';
import { canManage, PERMISSIONS } from '../lib/rbac';
import type { RoleName, Subscription, Profile } from '../types';

export function Subscriptions() {
  const { subscriptions, profiles, currentUser, refresh, settings } = useApp();
  const memberProfiles = useMembers();
  const { push } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [recordOpen, setRecordOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms = PERMISSIONS[role];
  const canEdit = canManage(perms, 'subscriptions');
  const isOwn = perms.subscriptions === 'own';

  const memberMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const s of subscriptions) set.add(s.billing_month.slice(0, 7));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [subscriptions]);

  const items = useMemo(() => {
    let list = subscriptions;
    if (isOwn && currentUser) list = list.filter((s) => s.member_id === currentUser.id);
    return list.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (monthFilter !== 'all' && s.billing_month.slice(0, 7) !== monthFilter) return false;
      if (search) {
        const m = memberMap.get(s.member_id);
        const q = search.toLowerCase();
        return (m?.full_name ?? '').toLowerCase().includes(q) || (s.reference_number ?? '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [subscriptions, isOwn, currentUser, statusFilter, monthFilter, search, memberMap]);

  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, Subscription[]>();
    for (const s of items) {
      const key = s.billing_month.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [items]);

  const totalExpected = items.reduce((a, s) => a + toNum(s.expected_amount), 0);
  const totalPaid = items.reduce((a, s) => a + toNum(s.amount_paid), 0);
  const collectionRate = totalExpected > 0 ? round2((totalPaid / totalExpected) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Subscriptions"
        subtitle="Monthly subscription payments tracker"
        actions={canEdit && (
          <button className="btn-primary" onClick={() => setRecordOpen(true)}>
            <Plus size={16} /> Record payment
          </button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MiniStat label="Records" value={String(items.length)} />
        <MiniStat label="Expected" value={formatKES(totalExpected)} />
        <MiniStat label="Collected" value={formatKES(totalPaid)} />
        <MiniStat label="Collection rate" value={`${collectionRate}%`} />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9" placeholder="Search member or reference…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input sm:w-40" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="all">All months</option>
            {availableMonths.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="input sm:w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Unpaid">Unpaid</option>
          </select>
        </div>
      </Card>

      {grouped.length === 0 ? (
        <Card><EmptyState title="No subscriptions found" description={isOwn ? "You haven't made any subscription payments yet." : "Adjust filters or record a new payment."} /></Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([month, rows]) => (
            <Card key={month}>
              <div className="flex items-center gap-2 border-b border-ink-200 px-5 py-3">
                <span className="badge-info">{month}</span>
                <span className="text-xs text-ink-500">{rows.length} record(s) · {formatKES(rows.reduce((a, s) => a + toNum(s.amount_paid), 0))} collected</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500">
                      <th className="px-5 py-3 font-semibold">Member</th>
                      <th className="px-5 py-3 font-semibold">Expected</th>
                      <th className="px-5 py-3 font-semibold">Paid</th>
                      <th className="hidden px-5 py-3 font-semibold sm:table-cell">Payment date</th>
                      <th className="hidden px-5 py-3 font-semibold md:table-cell">Reference</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      {canEdit && <th className="px-5 py-3 text-right font-semibold">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {rows.map((s) => {
                      const m = memberMap.get(s.member_id);
                      return (
                        <tr key={s.id} className="table-row-hover">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={m?.full_name ?? '?'} size={30} />
                              <span className="font-medium text-ink-900">{m?.full_name ?? 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-ink-600">{formatKES(s.expected_amount)}</td>
                          <td className="px-5 py-3 font-semibold text-ink-900">{formatKES(s.amount_paid)}</td>
                          <td className="hidden px-5 py-3 text-ink-600 sm:table-cell">{s.payment_date ? formatDate(s.payment_date) : '—'}</td>
                          <td className="hidden px-5 py-3 text-ink-600 md:table-cell">{s.reference_number ?? '—'}</td>
                          <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                          {canEdit && (
                            <td className="px-5 py-3 text-right">
                              <button className="btn-ghost text-xs" onClick={() => setEditing(s)}>
                                <Pencil size={13} /> Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      {recordOpen && (
        <RecordPaymentModal
          profiles={memberProfiles}
          currentUser={currentUser}
          settings={settings}
          onClose={() => setRecordOpen(false)}
          onSaved={async () => { await refresh(); setRecordOpen(false); }}
          push={push}
        />
      )}

      {editing && (
        <RecordPaymentModal
          profiles={memberProfiles}
          currentUser={currentUser}
          settings={settings}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { await refresh(); setEditing(null); }}
          push={push}
        />
      )}
    </div>
  );
}

function RecordPaymentModal({
  profiles, currentUser, settings, existing, onClose, onSaved, push,
}: {
  profiles: Profile[];
  currentUser: Profile | null;
  settings: Record<string, unknown>;
  existing?: Subscription;
  onClose: () => void;
  onSaved: () => void;
  push: (t: { kind: 'success' | 'error'; message: string; description?: string }) => void;
}) {
  const monthlyRate = Number(settings.subscription_monthly_rate ?? 2400);
  const [memberId, setMemberId] = useState(existing?.member_id ?? profiles[0]?.id ?? '');
  const [month, setMonth] = useState(existing?.billing_month ?? (todayISO().slice(0, 7) + '-01'));
  const [expected, setExpected] = useState(existing?.expected_amount ?? monthlyRate);
  const [paid, setPaid] = useState(existing?.amount_paid ?? monthlyRate);
  const [paymentDate, setPaymentDate] = useState(existing?.payment_date?.slice(0, 10) ?? todayISO());
  const [reference, setReference] = useState(existing?.reference_number ?? '');
  const [saving, setSaving] = useState(false);

  const isEdit = !!existing;

  const save = async () => {
    if (!memberId) { push({ kind: 'error', message: 'Select a member' }); return; }
    if (paid < 0 || expected < 0) { push({ kind: 'error', message: 'Amounts must be positive' }); return; }
    setSaving(true);
    try {
      const status = paid >= expected ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';
      const payload: Partial<Subscription> = {
        member_id: memberId,
        billing_month: month,
        expected_amount: round2(expected),
        amount_paid: round2(paid),
        payment_date: paid > 0 ? new Date(paymentDate).toISOString() : null,
        status,
        reference_number: reference || null,
        recorded_by: currentUser?.id ?? null,
      };
      if (isEdit) {
        const { error } = await supabase.from('subscriptions').update(payload).eq('id', existing!.id);
        if (error) throw error;
        await logAudit({
          user: currentUser,
          action: 'UPDATE',
          target_table: 'subscriptions',
          target_id: existing!.id,
          summary: `Edited subscription ${formatKES(paid)} for ${profiles.find((p) => p.id === memberId)?.full_name}`,
          new_value: payload,
        });
        push({ kind: 'success', message: 'Subscription updated' });
      } else {
        const { error } = await supabase.from('subscriptions').insert(payload);
        if (error) throw error;
        await logAudit({
          user: currentUser,
          action: 'CREATE',
          target_table: 'subscriptions',
          summary: `Recorded subscription ${formatKES(paid)} for ${profiles.find((p) => p.id === memberId)?.full_name}`,
          new_value: payload,
        });
        push({ kind: 'success', message: 'Subscription recorded' });
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
      title={isEdit ? 'Edit subscription payment' : 'Record subscription payment'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : isEdit ? 'Update' : 'Record'}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Member</label>
          <select className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)} disabled={isEdit}>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Billing month</label>
            <input className="input" type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(e.target.value + '-01')} disabled={isEdit} />
          </div>
          <div>
            <label className="label">Payment date</label>
            <input className="input" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Expected (KES)</label>
            <input className="input" type="number" min={0} value={expected} onChange={(e) => setExpected(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Paid (KES)</label>
            <input className="input" type="number" min={0} value={paid} onChange={(e) => setPaid(Number(e.target.value))} />
          </div>
          <div className="col-span-2">
            <label className="label">Reference</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="MPESA code…" />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink-900">{value}</p>
    </Card>
  );
}

// ===== Membership Fees =====

export function MembershipFees() {
  const { membershipFees, profiles, currentUser, refresh } = useApp();
  const memberProfiles = useMembers();
  const { push } = useToast();
  const [recordOpen, setRecordOpen] = useState(false);
  const [editing, setEditing] = useState<MembershipFee | null>(null);

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms = PERMISSIONS[role];
  const canEdit = canManage(perms, 'membershipFees');
  const isOwn = perms.membershipFees === 'own';

  const memberMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const items = useMemo(() => {
    let list = membershipFees;
    if (isOwn && currentUser) list = list.filter((f) => f.member_id === currentUser.id);
    return list;
  }, [membershipFees, isOwn, currentUser]);

  const expiredMembers = useMemo(() => {
    const today = new Date();
    return profiles.filter((p) => {
      const fee = membershipFees.find((f) => f.member_id === p.id);
      if (!fee || !fee.valid_until) return false;
      return new Date(fee.valid_until) < today;
    });
  }, [profiles, membershipFees]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Membership Fees"
        subtitle="Annual non-refundable registration sub-ledger"
        actions={canEdit && (
          <button className="btn-primary" onClick={() => setRecordOpen(true)}>
            <Plus size={16} /> Record fee
          </button>
        )}
      />

      {expiredMembers.length > 0 && (
        <div className="rounded-2xl border border-warning-200 bg-warning-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <ChevronDown size={18} className="mt-0.5 flex-none text-warning-600" />
            <div>
              <p className="text-sm font-semibold text-warning-800">Expired membership coverage</p>
              <p className="mt-1 text-xs text-warning-700">
                {expiredMembers.map((m) => m.full_name).join(', ')} — annual threshold elapsed. Renew to restore full privileges.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        {items.length === 0 ? (
          <EmptyState title="No membership fees recorded" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                  <th className="hidden px-5 py-3 font-semibold sm:table-cell">Payment date</th>
                  <th className="hidden px-5 py-3 font-semibold md:table-cell">Valid until</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  {canEdit && <th className="px-5 py-3 text-right font-semibold">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {items.map((f) => {
                  const m = memberMap.get(f.member_id);
                  return (
                    <tr key={f.id} className="table-row-hover">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={m?.full_name ?? '?'} size={30} />
                          <span className="font-medium text-ink-900">{m?.full_name ?? 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-ink-600">{f.fee_type}</td>
                      <td className="px-5 py-3 font-semibold text-ink-900">{formatKES(f.amount)}</td>
                      <td className="hidden px-5 py-3 text-ink-600 sm:table-cell">{f.payment_date ? formatDate(f.payment_date) : '—'}</td>
                      <td className="hidden px-5 py-3 text-ink-600 md:table-cell">{formatDate(f.valid_until)}</td>
                      <td className="px-5 py-3"><StatusBadge status={f.status} /></td>
                      {canEdit && (
                        <td className="px-5 py-3 text-right">
                          <button className="btn-ghost text-xs" onClick={() => setEditing(f)}>
                            <Pencil size={13} /> Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {recordOpen && (
        <RecordFeeModal
          profiles={memberProfiles}
          currentUser={currentUser}
          onClose={() => setRecordOpen(false)}
          onSaved={async () => { await refresh(); setRecordOpen(false); }}
          push={push}
        />
      )}

      {editing && (
        <RecordFeeModal
          profiles={memberProfiles}
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

function RecordFeeModal({
  profiles, currentUser, existing, onClose, onSaved, push,
}: {
  profiles: Profile[];
  currentUser: Profile | null;
  existing?: MembershipFee;
  onClose: () => void;
  onSaved: () => void;
  push: (t: { kind: 'success' | 'error'; message: string; description?: string }) => void;
}) {
  const [memberId, setMemberId] = useState(existing?.member_id ?? profiles[0]?.id ?? '');
  const [amount, setAmount] = useState(existing?.amount ?? 500);
  const [paymentDate, setPaymentDate] = useState(existing?.payment_date?.slice(0, 10) ?? todayISO());
  const [validUntil, setValidUntil] = useState(existing?.valid_until ?? '');
  const [reference, setReference] = useState(existing?.reference_number ?? '');
  const [saving, setSaving] = useState(false);

  const isEdit = !!existing;

  const save = async () => {
    if (!memberId) { push({ kind: 'error', message: 'Select a member' }); return; }
    if (!validUntil) { push({ kind: 'error', message: 'Set validity date' }); return; }
    setSaving(true);
    try {
      const payload: Partial<MembershipFee> = {
        member_id: memberId,
        fee_type: 'Annual Registration',
        amount: round2(amount),
        payment_date: new Date(paymentDate).toISOString(),
        valid_until: validUntil,
        status: 'Paid',
        reference_number: reference || null,
        recorded_by: currentUser?.id ?? null,
      };
      if (isEdit) {
        const { error } = await supabase.from('membership_fees').update(payload).eq('id', existing!.id);
        if (error) throw error;
        await logAudit({
          user: currentUser,
          action: 'UPDATE',
          target_table: 'membership_fees',
          target_id: existing!.id,
          summary: `Edited membership fee ${formatKES(amount)} for ${profiles.find((p) => p.id === memberId)?.full_name}`,
          new_value: payload,
        });
        push({ kind: 'success', message: 'Membership fee updated' });
      } else {
        const { error } = await supabase.from('membership_fees').insert(payload);
        if (error) throw error;
        await logAudit({
          user: currentUser,
          action: 'CREATE',
          target_table: 'membership_fees',
          summary: `Recorded membership fee ${formatKES(amount)} for ${profiles.find((p) => p.id === memberId)?.full_name}`,
          new_value: payload,
        });
        push({ kind: 'success', message: 'Membership fee recorded' });
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
      title={isEdit ? 'Edit membership fee' : 'Record membership fee'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : isEdit ? 'Update' : 'Record'}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Member</label>
          <select className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)} disabled={isEdit}>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount (KES)</label>
            <input className="input" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Payment date</label>
            <input className="input" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Valid until</label>
            <input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Reference</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="MPESA code…" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
