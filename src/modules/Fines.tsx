import { useMemo, useState } from 'react';
import { Plus, AlertCircle, Ban, CheckCircle2 } from 'lucide-react';
import { useApp, useMembers } from '../lib/store';
import { supabase } from '../lib/supabase';
import { formatKES, formatDate, sumFines, sumUnpaidFines, round2, todayISO } from '../lib/finance';
import { logAudit } from '../lib/audit';
import { useToast } from '../lib/toast';
import {
  PageHeader, Card, Avatar, StatusBadge, EmptyState, Modal, ConfirmDialog,
} from '../components/ui';
import { canManage, PERMISSIONS } from '../lib/rbac';
import type { RoleName, Fine } from '../types';

const FINE_TYPES = ['Lateness', 'Absence', 'Violation', 'Non-payment', 'Other'];

export function Fines() {
  const { fines, profiles, currentUser, refresh } = useApp();
  const memberProfiles = useMembers();
  const { push } = useToast();
  const [issueOpen, setIssueOpen] = useState(false);
  const [action, setAction] = useState<{ fine: Fine; kind: 'pay' | 'waive' } | null>(null);

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms = PERMISSIONS[role];
  const canEdit = canManage(perms, 'fines');
  const isOwn = perms.fines === 'own';

  const memberMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const items = useMemo(() => {
    let list = fines;
    if (isOwn && currentUser) list = list.filter((f) => f.member_id === currentUser.id);
    return list;
  }, [fines, isOwn, currentUser]);

  const total = sumFines(items);
  const unpaid = sumUnpaidFines(items);

  const doAction = async () => {
    if (!action) return;
    const { fine, kind } = action;
    const newStatus = kind === 'pay' ? 'Paid' : 'Waived';
    try {
      const updates: Partial<Fine> = { status: newStatus };
      if (kind === 'waive') updates.waived_by = currentUser?.id ?? null;
      const { error } = await supabase.from('fines').update(updates).eq('id', fine.id);
      if (error) throw error;
      await logAudit({
        user: currentUser,
        action: 'UPDATE',
        target_table: 'fines',
        target_id: fine.id,
        summary: `Fine ${kind === 'pay' ? 'paid' : 'waived'} — ${formatKES(fine.amount)} (${fine.fine_type})`,
        old_value: { status: fine.status },
        new_value: updates,
      });
      push({ kind: 'success', message: `Fine ${kind === 'pay' ? 'marked paid' : 'waived'}` });
      await refresh();
    } catch (err) {
      push({ kind: 'error', message: 'Action failed', description: (err as Error).message });
    }
    setAction(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fines & Penalties"
        subtitle="Statutory penalty management"
        actions={canEdit && (
          <button className="btn-primary" onClick={() => setIssueOpen(true)}>
            <Plus size={16} /> Issue fine
          </button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-ink-500">Total fines</p>
          <p className="mt-1 text-xl font-bold text-ink-900">{formatKES(total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-500">Outstanding</p>
          <p className="mt-1 text-xl font-bold text-danger-600">{formatKES(unpaid)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-500">Records</p>
          <p className="mt-1 text-xl font-bold text-ink-900">{items.length}</p>
        </Card>
      </div>

      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={<AlertCircle size={20} />}
            title="No fines recorded"
            description={isOwn ? 'You have a clean record.' : 'Issue a fine to get started.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                  <th className="hidden px-5 py-3 font-semibold sm:table-cell">Issued</th>
                  <th className="hidden px-5 py-3 font-semibold md:table-cell">Notes</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  {canEdit && <th className="px-5 py-3 text-right font-semibold">Actions</th>}
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
                      <td className="px-5 py-3"><span className="badge-neutral">{f.fine_type}</span></td>
                      <td className="px-5 py-3 font-semibold text-ink-900">{formatKES(f.amount)}</td>
                      <td className="hidden px-5 py-3 text-ink-600 sm:table-cell">{formatDate(f.date_issued)}</td>
                      <td className="hidden px-5 py-3 text-ink-500 md:table-cell max-w-xs truncate">{f.notes ?? '—'}</td>
                      <td className="px-5 py-3"><StatusBadge status={f.status} /></td>
                      {canEdit && (
                        <td className="px-5 py-3 text-right">
                          {f.status === 'Unpaid' && (
                            <div className="flex justify-end gap-1.5">
                              <button className="btn-ghost text-xs" onClick={() => setAction({ fine: f, kind: 'pay' })}>
                                <CheckCircle2 size={14} /> Pay
                              </button>
                              <button className="btn-ghost text-xs text-danger-600" onClick={() => setAction({ fine: f, kind: 'waive' })}>
                                <Ban size={14} /> Waive
                              </button>
                            </div>
                          )}
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

      {issueOpen && (
        <IssueFineModal
          profiles={memberProfiles}
          currentUser={currentUser}
          onClose={() => setIssueOpen(false)}
          onSaved={async () => { await refresh(); setIssueOpen(false); }}
          push={push}
        />
      )}

      <ConfirmDialog
        open={!!action}
        onClose={() => setAction(null)}
        onConfirm={doAction}
        title={action?.kind === 'pay' ? 'Mark fine as paid' : 'Waive fine'}
        message={action ? `${action.kind === 'pay' ? 'Mark' : 'Waive'} fine of ${formatKES(action.fine.amount)} (${action.fine.fine_type})? This is logged to the audit trail.` : ''}
        confirmLabel={action?.kind === 'pay' ? 'Mark paid' : 'Waive'}
        danger={action?.kind === 'waive'}
      />
    </div>
  );
}

function IssueFineModal({
  profiles, currentUser, onClose, onSaved, push,
}: {
  profiles: { id: string; full_name: string }[];
  currentUser: { id: string; full_name: string } | null;
  onClose: () => void;
  onSaved: () => void;
  push: (t: { kind: 'success' | 'error'; message: string; description?: string }) => void;
}) {
  const [memberId, setMemberId] = useState(profiles[0]?.id ?? '');
  const [fineType, setFineType] = useState(FINE_TYPES[0]);
  const [amount, setAmount] = useState(50);
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!memberId) { push({ kind: 'error', message: 'Select a member' }); return; }
    if (amount <= 0) { push({ kind: 'error', message: 'Amount must be positive' }); return; }
    setSaving(true);
    try {
      const payload: Partial<Fine> = {
        member_id: memberId,
        fine_type: fineType,
        amount: round2(amount),
        date_issued: date,
        status: 'Unpaid',
        notes: notes || null,
        issued_by: currentUser?.id ?? null,
      };
      const { error } = await supabase.from('fines').insert(payload);
      if (error) throw error;
      await logAudit({
        user: currentUser,
        action: 'CREATE',
        target_table: 'fines',
        summary: `Issued ${fineType} fine ${formatKES(amount)} to ${profiles.find((p) => p.id === memberId)?.full_name}`,
        new_value: payload,
      });
      push({ kind: 'success', message: 'Fine issued' });
      onSaved();
    } catch (err) {
      push({ kind: 'error', message: 'Failed to issue fine', description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Issue fine"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Issue'}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Member</label>
          <select className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Fine type</label>
            <select className="input" value={fineType} onChange={(e) => setFineType(e.target.value)}>
              {FINE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Amount (KES)</label>
            <input className="input" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Date issued</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason / documentation…" />
        </div>
      </div>
    </Modal>
  );
}
