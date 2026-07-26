import { useMemo, useState } from 'react';
import {
  Crown, CheckCircle2, XCircle, Clock, FileText, ShieldCheck, Pencil,
} from 'lucide-react';
import { useApp, useMembers } from '../lib/store';
import { supabase } from '../lib/supabase';
import { formatKES, formatDate, nextStatuses, toNum } from '../lib/finance';
import { logAudit } from '../lib/audit';
import { useToast } from '../lib/toast';
import {
  PageHeader, Card, Avatar, StatusBadge, EmptyState, ConfirmDialog, Modal,
} from '../components/ui';
import { canManage, PERMISSIONS } from '../lib/rbac';
import type { RoleName, Loan, Profile } from '../types';

const POSITIONS = [
  'Chairperson', 'Vice Chairperson', 'Secretary', 'Assistant Secretary',
  'Treasurer', 'Assistant Treasurer', 'Organizing Secretary', 'Trustee',
  'Ex-Officio', '',
];

export function Leadership() {
  const { loans, profiles, currentUser, refresh, auditLogs } = useApp();
  const { push } = useToast();
  const [confirm, setConfirm] = useState<{ loan: Loan; status: string } | null>(null);
  const [editingPosition, setEditingPosition] = useState<Profile | null>(null);

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms = PERMISSIONS[role];
  const canApprove = perms.leadership === 'full' || perms.leadership === 'view';
  const canEditPositions = canManage(perms, 'leadership');

  const memberMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const memberProfiles = useMembers();

  const leaders = useMemo(
    () => memberProfiles
      .filter((p) => p.leadership_position && p.leadership_position.trim() !== '')
      .sort((a, b) => (a.leadership_position ?? '').localeCompare(b.leadership_position ?? '')),
    [memberProfiles]
  );

  const pending = loans.filter((l) => l.status === 'Submitted' || l.status === 'Under Review');
  const active = loans.filter((l) => l.status === 'Active' || l.status === 'Overdue' || l.status === 'Defaulted' || l.status === 'Carried Forward');
  const policyChanges = auditLogs.filter((l) => l.target_table === 'organization_settings' || l.target_table === 'constitution_versions').slice(0, 6);

  const transition = async (loan: Loan, status: string) => {
    try {
      const updates: Partial<Loan> = {
        status,
        updated_at: new Date().toISOString(),
        reviewed_by: currentUser?.id ?? null,
      };
      if (status === 'Approved') updates.approved_by = currentUser?.id ?? null;
      if (status === 'Disbursed') updates.disbursed_at = new Date().toISOString();
      const { error } = await supabase.from('loans').update(updates).eq('id', loan.id);
      if (error) throw error;
      await logAudit({
        user: currentUser,
        action: 'UPDATE',
        target_table: 'loans',
        target_id: loan.id,
        summary: `Leadership moved loan ${loan.id.slice(0, 8)} → ${status}`,
        old_value: { status: loan.status },
        new_value: updates,
      });
      push({ kind: 'success', message: `Loan ${status}` });
      await refresh();
    } catch (err) {
      push({ kind: 'error', message: 'Action failed', description: (err as Error).message });
    }
    setConfirm(null);
  };

  const savePosition = async (profile: Profile, position: string) => {
    try {
      const { error } = await supabase.from('profiles').update({ leadership_position: position || null }).eq('id', profile.id);
      if (error) throw error;
      await logAudit({
        user: currentUser,
        action: 'UPDATE',
        target_table: 'profiles',
        target_id: profile.id,
        summary: `Updated leadership position for ${profile.full_name} → ${position || 'none'}`,
        new_value: { leadership_position: position || null },
      });
      push({ kind: 'success', message: 'Leadership position updated' });
      await refresh();
    } catch (err) {
      push({ kind: 'error', message: 'Update failed', description: (err as Error).message });
    }
    setEditingPosition(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leadership Portal"
        subtitle="Loan approvals, policy & governance"
      />

      {/* Leadership team */}
      <Card>
        <div className="flex items-center gap-2 border-b border-ink-200 px-5 py-4">
          <Crown size={16} className="text-brand-600" />
          <h2 className="text-sm font-semibold text-ink-900">Leadership Team</h2>
          <span className="ml-auto badge-info">{leaders.length} positions</span>
        </div>
        {leaders.length === 0 ? (
          <EmptyState title="No leadership positions assigned" description={canEditPositions ? 'Assign positions to members below.' : 'No positions have been set yet.'} />
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {leaders.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-ink-200 bg-gradient-to-br from-brand-50/60 to-white p-3">
                <Avatar name={p.full_name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{p.full_name}</p>
                  <p className="text-xs font-medium text-brand-700">{p.leadership_position}</p>
                  <p className="text-[11px] text-ink-500">{p.email ?? '—'}</p>
                </div>
                {canEditPositions && (
                  <button className="rounded-lg p-1.5 text-ink-500 hover:bg-white" onClick={() => setEditingPosition(p)} title="Edit position">
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {canEditPositions && (
          <div className="border-t border-ink-200 px-5 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Assign / update positions</p>
            <div className="flex flex-wrap gap-2">
              {memberProfiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setEditingPosition(p)}
                  className="rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 transition hover:border-brand-300 hover:bg-brand-50"
                >
                  {p.full_name}
                  {p.leadership_position && <span className="ml-1.5 text-brand-600">· {p.leadership_position}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2 border-b border-ink-200 px-5 py-4">
            <Clock size={16} className="text-warning-600" />
            <h2 className="text-sm font-semibold text-ink-900">Pending approvals</h2>
            <span className="ml-auto badge-warning">{pending.length}</span>
          </div>
          {pending.length === 0 ? (
            <EmptyState title="No pending approvals" description="All applications have been reviewed." />
          ) : (
            <div className="divide-y divide-ink-100">
              {pending.map((l) => {
                const m = memberMap.get(l.member_id);
                const next = nextStatuses(l.status);
                return (
                  <div key={l.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m?.full_name ?? '?'} size={36} />
                        <div>
                          <p className="text-sm font-semibold text-ink-900">{m?.full_name ?? 'Unknown'}</p>
                          <p className="text-xs text-ink-500">{formatKES(l.principal)} · due {formatDate(l.due_date)}</p>
                          <p className="text-[11px] text-ink-400">{l.purpose ?? 'No purpose stated'}</p>
                        </div>
                      </div>
                      <StatusBadge status={l.status} />
                    </div>
                    {canApprove && next.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {next.map((s) => (
                          <button
                            key={s}
                            className={s === 'Rejected' ? 'btn-danger text-xs' : 'btn-primary text-xs'}
                            onClick={() => setConfirm({ loan: l, status: s })}
                          >
                            {s === 'Approved' && <CheckCircle2 size={14} />}
                            {s === 'Rejected' && <XCircle size={14} />}
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 border-b border-ink-200 px-5 py-4">
            <Crown size={16} className="text-brand-600" />
            <h2 className="text-sm font-semibold text-ink-900">Active portfolio</h2>
            <span className="ml-auto badge-info">{active.length}</span>
          </div>
          {active.length === 0 ? (
            <EmptyState title="No active loans" />
          ) : (
            <div className="divide-y divide-ink-100">
              {active.map((l) => {
                const m = memberMap.get(l.member_id);
                return (
                  <div key={l.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m?.full_name ?? '?'} size={30} />
                      <div>
                        <p className="text-sm font-medium text-ink-900">{m?.full_name ?? 'Unknown'}</p>
                        <p className="text-xs text-ink-500">Balance {formatKES(l.current_balance)} · due {formatDate(l.due_date)}</p>
                      </div>
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-ink-200 px-5 py-4">
          <ShieldCheck size={16} className="text-success-600" />
          <h2 className="text-sm font-semibold text-ink-900">Policy & governance changes</h2>
        </div>
        {policyChanges.length === 0 ? (
          <EmptyState icon={<FileText size={20} />} title="No policy changes recorded" />
        ) : (
          <div className="divide-y divide-ink-100">
            {policyChanges.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-ink-800">{l.summary}</p>
                  <p className="text-xs text-ink-500">{l.user_name} · {l.target_table}</p>
                </div>
                <span className="text-xs text-ink-400">{formatDate(l.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && transition(confirm.loan, confirm.status)}
        title="Confirm leadership decision"
        message={confirm ? `Move loan ${confirm.loan.id.slice(0, 8)} to "${confirm.status}"? This decision is permanently logged.` : ''}
        confirmLabel="Confirm decision"
        danger={confirm?.status === 'Rejected'}
      />

      {editingPosition && (
        <PositionModal
          profile={editingPosition}
          onClose={() => setEditingPosition(null)}
          onSave={savePosition}
        />
      )}
    </div>
  );
}

function PositionModal({
  profile, onClose, onSave,
}: {
  profile: Profile;
  onClose: () => void;
  onSave: (profile: Profile, position: string) => void;
}) {
  const [position, setPosition] = useState(profile.leadership_position ?? '');

  return (
    <Modal
      open
      onClose={onClose}
      title={`Leadership position — ${profile.full_name}`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(profile, position)}>Save</button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-3">
          <Avatar name={profile.full_name} size={40} />
          <div>
            <p className="text-sm font-semibold text-ink-900">{profile.full_name}</p>
            <p className="text-xs text-ink-500">{profile.email ?? '—'} · {profile.status}</p>
          </div>
        </div>
        <div>
          <label className="label">Position</label>
          <select className="input" value={position} onChange={(e) => setPosition(e.target.value)}>
            {POSITIONS.map((p) => <option key={p} value={p}>{p || '— No position —'}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Custom position (optional)</label>
          <input className="input" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Welfare Officer" />
        </div>
      </div>
    </Modal>
  );
}
