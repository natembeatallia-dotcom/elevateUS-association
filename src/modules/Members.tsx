import { useMemo, useState } from 'react';
import {
  Search, Mail, Phone, Calendar, Plus,
  ShieldCheck, AlertTriangle, X, Trash2, Lock,
} from 'lucide-react';
import { useApp } from '../lib/store';
import { supabase } from '../lib/supabase';
import { formatKES, formatDate, monthsBetween, toNum, round2 } from '../lib/finance';
import { logAudit } from '../lib/audit';
import { useToast } from '../lib/toast';
import {
  PageHeader, Card, Avatar, StatusBadge, EmptyState, Spinner, Modal, ConfirmDialog,
} from '../components/ui';
import { CreditScoreGauge } from '../components/CreditScoreGauge';
import { canManage } from '../lib/rbac';
import type { Profile, RoleName } from '../types';
import { PERMISSIONS } from '../lib/rbac';

export function Members() {
  const { profiles, roles, currentUser, refresh } = useApp();
  const { push } = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState<Profile | null>(null);

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms = PERMISSIONS[role];
  const canEdit = canManage(perms, 'members');

  // Exclude system (admin-only) accounts from the members directory
  const memberProfiles = useMemo(() => profiles.filter((p) => !p.is_system), [profiles]);

  const filtered = useMemo(() => {
    return memberProfiles.filter((p) => {
      if (roleFilter !== 'all' && String(p.role_id) !== roleFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.full_name.toLowerCase().includes(q) ||
          (p.email ?? '').toLowerCase().includes(q) ||
          (p.phone_number ?? '').includes(q)
        );
      }
      return true;
    });
  }, [memberProfiles, roleFilter, statusFilter, search]);

  const pageSize = 8;
  const pageItems = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      // Delete the profile row; auth user remains but is orphaned (safe)
      const { error } = await supabase.from('profiles').delete().eq('id', deleting.id);
      if (error) throw error;
      await logAudit({
        user: currentUser,
        action: 'DELETE',
        target_table: 'profiles',
        target_id: deleting.id,
        summary: `Deleted member ${deleting.full_name}`,
        old_value: { full_name: deleting.full_name, email: deleting.email },
      });
      push({ kind: 'success', message: `${deleting.full_name} removed` });
      await refresh();
    } catch (err) {
      push({ kind: 'error', message: 'Delete failed', description: (err as Error).message });
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Members Directory"
        subtitle={`${memberProfiles.length} members · ${memberProfiles.filter((p) => p.status === 'Active').length} active`}
        actions={
          canEdit && (
            <button className="btn-primary" onClick={() => setEditing(emptyMember())}>
              <Plus size={16} /> Add member
            </button>
          )
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Search by name, email, phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <select className="input sm:w-44" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}>
            <option value="all">All roles</option>
            {roles.map((r) => <option key={r.id} value={String(r.id)}>{r.role_name}</option>)}
          </select>
          <select className="input sm:w-40" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
            <option value="all">All statuses</option>
            <option value="Active">Active</option>
            <option value="High Risk">High Risk</option>
            <option value="Suspended">Suspended</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState title="No members found" description="Try adjusting your filters or add a new member." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                    <th className="px-5 py-3 font-semibold">Member</th>
                    <th className="px-5 py-3 font-semibold">Role</th>
                    <th className="hidden px-5 py-3 font-semibold sm:table-cell">Status</th>
                    <th className="hidden px-5 py-3 font-semibold md:table-cell">Joined</th>
                    <th className="px-5 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {pageItems.map((p) => (
                    <tr key={p.id} className="table-row-hover">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={p.full_name} size={36} />
                          <div>
                            <p className="font-semibold text-ink-900">{p.full_name}</p>
                            <p className="text-xs text-ink-500">{p.email ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="badge-neutral">{p.role?.role_name ?? 'Member'}</span>
                      </td>
                      <td className="hidden px-5 py-3 sm:table-cell">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="hidden px-5 py-3 text-ink-600 md:table-cell">{formatDate(p.join_date)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button className="btn-ghost text-xs" onClick={() => setSelected(p)}>
                            View
                          </button>
                          {canEdit && (
                            <>
                              <button className="btn-ghost text-xs" onClick={() => setEditing(p)}>Edit</button>
                              <button
                                className="rounded-lg p-1.5 text-danger-500 transition hover:bg-danger-50"
                                onClick={() => setDeleting(p)}
                                title="Delete member"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-ink-200 px-5 py-3 text-xs text-ink-500">
              <span>Page {page + 1} of {totalPages} · {filtered.length} members</span>
              <div className="flex gap-2">
                <button className="btn-ghost text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <button className="btn-ghost text-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </Card>

      {selected && (
        <MemberDossier
          member={selected}
          onClose={() => setSelected(null)}
          onEdit={canEdit ? () => { setEditing(selected); setSelected(null); } : undefined}
        />
      )}

      {editing && (
        <MemberForm
          member={editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onSaved={async () => { await refresh(); setEditing(null); }}
          currentUser={currentUser}
          push={push}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete member"
        message={deleting ? `Permanently remove ${deleting.full_name} from the directory? Their login account will be deactivated. This action cannot be undone.` : ''}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function MemberDossier({
  member, onClose, onEdit,
}: {
  member: Profile;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const { subscriptions, membershipFees, loans, fines, auditLogs } = useApp();

  const mySubs = subscriptions.filter((s) => s.member_id === member.id);
  const myFees = membershipFees.filter((f) => f.member_id === member.id);
  const myLoans = loans.filter((l) => l.member_id === member.id);
  const myFines = fines.filter((f) => f.member_id === member.id);

  const totalSaved = round2(mySubs.reduce((a, s) => a + toNum(s.amount_paid), 0) + myFees.filter((f) => f.status === 'Paid').reduce((a, f) => a + toNum(f.amount), 0));
  const totalBorrowed = myLoans.reduce((a, l) => a + toNum(l.principal), 0);
  const totalRepaid = myLoans.reduce((a, l) => a + toNum(l.amount_paid), 0);
  const outstandingFines = myFines.filter((f) => f.status === 'Unpaid').reduce((a, f) => a + toNum(f.amount), 0);
  const tenure = monthsBetween(member.join_date);
  const hasDefaulted = myLoans.some((l) => l.status === 'Defaulted' || l.status === 'Overdue');

  const timeline = useMemo(() => {
    const items: { date: string; label: string; kind: string }[] = [];
    for (const s of mySubs) items.push({ date: s.payment_date ?? s.billing_month, label: `Subscription ${s.billing_month.slice(0, 7)} — ${formatKES(s.amount_paid)}`, kind: 'sub' });
    for (const f of myFees) items.push({ date: f.payment_date ?? f.created_at ?? '', label: `${f.fee_type} fee — ${formatKES(f.amount)}`, kind: 'fee' });
    for (const l of myLoans) items.push({ date: l.created_at ?? '', label: `Loan ${formatKES(l.principal)} — ${l.status}`, kind: 'loan' });
    for (const f of myFines) items.push({ date: f.date_issued, label: `Fine ${f.fine_type} — ${formatKES(f.amount)}`, kind: 'fine' });
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  }, [mySubs, myFees, myLoans, myFines]);

  const memberAudit = auditLogs.filter((l) => l.target_id === member.id || l.user_id === member.id).slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-4xl animate-scale-in rounded-t-2xl bg-white shadow-pop sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <Avatar name={member.full_name} size={44} />
            <div>
              <h3 className="text-base font-bold text-ink-900">{member.full_name}</h3>
              <p className="text-xs text-ink-500">{member.role?.role_name ?? 'Member'} · {member.status}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && <button className="btn-ghost text-xs" onClick={onEdit}>Edit</button>}
            <button className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-4">
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Demographics</p>
              <div className="mt-3 space-y-2.5 text-sm">
                <InfoRow icon={<Mail size={14} />} label="Email" value={member.email ?? '—'} />
                <InfoRow icon={<Phone size={14} />} label="Phone" value={member.phone_number ?? '—'} />
                <InfoRow icon={<Calendar size={14} />} label="Joined" value={formatDate(member.join_date)} />
                <InfoRow icon={<ShieldCheck size={14} />} label="Tenure" value={`${tenure} months`} />
                {member.notes && (
                  <div className="flex items-start gap-2 pt-1 text-xs text-ink-500">
                    <AlertTriangle size={14} className="mt-0.5 flex-none text-warning-500" />
                    <span>{member.notes}</span>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Loan Status</p>
              <div className="mt-3 space-y-2 text-sm">
                <InfoRow icon={<ShieldCheck size={14} />} label="Total borrowed" value={formatKES(totalBorrowed)} />
                <InfoRow icon={<ShieldCheck size={14} />} label="Total repaid" value={formatKES(totalRepaid)} />
                {hasDefaulted ? (
                  <>
                    <div className="border-t border-ink-200 pt-2">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger-600">Defaulter — credit score</p>
                      <div className="flex justify-center">
                        <CreditScoreGauge score={member.credit_score} size={160} />
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="pt-1 text-xs text-ink-400">Credit score is only shown once a member defaults on a loan.</p>
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Financial Statement Summary</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Total Saved" value={formatKES(totalSaved)} />
                <Stat label="Total Borrowed" value={formatKES(totalBorrowed)} />
                <Stat label="Total Repaid" value={formatKES(totalRepaid)} />
                <Stat label="Outstanding Fines" value={formatKES(outstandingFines)} />
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Activity Timeline</p>
              <div className="mt-3 space-y-2.5">
                {timeline.length === 0 ? (
                  <p className="py-4 text-center text-xs text-ink-500">No activity recorded</p>
                ) : (
                  timeline.map((t, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className={`mt-1 h-2 w-2 flex-none rounded-full ${t.kind === 'loan' ? 'bg-brand-500' : t.kind === 'fine' ? 'bg-danger-500' : t.kind === 'fee' ? 'bg-warning-500' : 'bg-success-500'}`} />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-ink-800">{t.label}</p>
                        <p className="text-[11px] text-ink-400">{formatDate(t.date)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {memberAudit.length > 0 && (
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Audit History</p>
                <div className="mt-3 space-y-2">
                  {memberAudit.map((l) => (
                    <div key={l.id} className="flex items-center justify-between text-xs">
                      <span className="text-ink-700">{l.summary}</span>
                      <span className="text-ink-400">{formatDate(l.created_at)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberForm({
  member, roles, onClose, onSaved, currentUser, push,
}: {
  member: Profile;
  roles: { id: number; role_name: string }[];
  onClose: () => void;
  onSaved: () => void;
  currentUser: Profile | null;
  push: (t: { kind: 'success' | 'error'; message: string; description?: string }) => void;
}) {
  const [form, setForm] = useState(member);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const isNew = !member.id;

  const save = async () => {
    if (!form.full_name.trim()) { push({ kind: 'error', message: 'Name is required' }); return; }
    if (isNew && !form.email?.trim()) { push({ kind: 'error', message: 'Email is required' }); return; }
    if (isNew && password.length < 6) { push({ kind: 'error', message: 'Password must be at least 6 characters' }); return; }
    setSaving(true);
    try {
      if (isNew) {
        // Create auth account + profile via edge function (uses service role)
        const baseUrl = (import.meta as Record<string, string>).VITE_SUPABASE_URL
          ?? (import.meta as Record<string, string>).VITE_PUBLIC_SUPABASE_URL
          ?? '';
        const anonKey = (import.meta as Record<string, string>).VITE_SUPABASE_ANON_KEY
          ?? (import.meta as Record<string, string>).VITE_PUBLIC_SUPABASE_ANON_KEY
          ?? '';
        const res = await fetch(`${baseUrl}/functions/v1/create-member`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({
            email: form.email,
            password,
            fullName: form.full_name,
            phoneNumber: form.phone_number,
            roleId: form.role_id,
            joinDate: form.join_date,
            creditScore: form.credit_score,
            status: form.status,
            notes: form.notes,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create member account');
        await logAudit({
          user: currentUser,
          action: 'CREATE',
          target_table: 'profiles',
          target_id: data.profile?.id,
          summary: `Created member account for ${form.full_name}`,
          new_value: { email: form.email, full_name: form.full_name, role_id: form.role_id },
        });
        push({ kind: 'success', message: 'Member account created', description: `${form.full_name} can now sign in with their email and password.` });
      } else {
        // Update existing profile
        const payload = {
          full_name: form.full_name,
          role_id: form.role_id,
          phone_number: form.phone_number,
          email: form.email,
          join_date: form.join_date,
          status: form.status,
          notes: form.notes,
        };
        const { error } = await supabase.from('profiles').update(payload).eq('id', form.id).select().single();
        if (error) throw error;
        await logAudit({
          user: currentUser,
          action: 'UPDATE',
          target_table: 'profiles',
          target_id: form.id,
          summary: `Updated member ${form.full_name}`,
          new_value: payload,
        });
        push({ kind: 'success', message: 'Member updated' });
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
      title={isNew ? 'Add member' : 'Edit member'}
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={save}>
            {saving ? <Spinner label="Saving…" /> : 'Save'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {isNew && (
          <div className="sm:col-span-2 rounded-xl bg-brand-50 border border-brand-200 p-3 flex items-start gap-2">
            <Lock size={15} className="mt-0.5 flex-none text-brand-600" />
            <p className="text-xs text-brand-800">
              A login account will be created for this member. They can sign in with their email and the password you set.
            </p>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label">Full name</label>
          <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone_number ?? ''} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
        </div>
        {isNew && (
          <div className="sm:col-span-2">
            <label className="label">Password (login)</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" />
          </div>
        )}
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role_id ?? 6} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.role_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option>Active</option><option>High Risk</option><option>Suspended</option><option>Inactive</option>
          </select>
        </div>
        <div>
          <label className="label">Join date</label>
          <input className="input" type="date" value={form.join_date} onChange={(e) => setForm({ ...form, join_date: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input min-h-[80px]" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

function emptyMember(): Profile {
  return {
    id: '',
    user_id: null,
    full_name: '',
    role_id: 6,
    phone_number: '',
    email: '',
    join_date: new Date().toISOString().slice(0, 10),
    credit_score: 500,
    status: 'Active',
    avatar_url: null,
    notes: null,
    is_system: false,
    leadership_position: null,
    role: null,
  };
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-ink-400">{icon}</span>
      <span className="text-xs text-ink-500">{label}</span>
      <span className="ml-auto text-sm font-medium text-ink-800">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-ink-900">{value}</p>
    </div>
  );
}
