import { useMemo, useState } from 'react';
import {
  Plus, ShieldCheck, ShieldAlert, ChevronRight, X, CheckCircle2, XCircle, Percent,
} from 'lucide-react';
import { useApp, useMembers } from '../lib/store';
import { supabase } from '../lib/supabase';
import {
  formatKES, formatDate, interestAmount, totalRepayable, round2, toNum,
  qualifyForLoan, nextStatuses, daysBetween, latePenalty,
  buildCarryForwardLoan, splitRepayment, todayISO, mpesaTransactionCost,
} from '../lib/finance';
import { logAudit } from '../lib/audit';
import { useToast } from '../lib/toast';
import {
  PageHeader, Card, Avatar, StatusBadge, EmptyState, Modal, ConfirmDialog,
} from '../components/ui';
import { canManage, PERMISSIONS } from '../lib/rbac';
import type { RoleName, Loan } from '../types';

export function Loans() {
  const { loans, profiles, currentUser, refresh } = useApp();
  const memberProfiles = useMembers();
  const { push } = useToast();
  const [applyOpen, setApplyOpen] = useState(false);
  const [interestOpen, setInterestOpen] = useState(false);
  const [detail, setDetail] = useState<Loan | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms = PERMISSIONS[role];
  const canEdit = canManage(perms, 'loans');
  const isOwn = perms.loans === 'own';

  const memberMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const items = useMemo(() => {
    let list = loans;
    if (isOwn && currentUser) list = list.filter((l) => l.member_id === currentUser.id);
    if (statusFilter !== 'all') list = list.filter((l) => l.status === statusFilter);
    return list;
  }, [loans, isOwn, currentUser, statusFilter]);

  const totalPrincipal = items.reduce((a, l) => a + toNum(l.principal), 0);
  const totalBalance = items.reduce((a, l) => a + toNum(l.current_balance), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Loans"
        subtitle="Advanced loan processing engine"
        actions={
          <div className="flex gap-2">
            {canEdit && (
              <button className="btn-success" onClick={() => setInterestOpen(true)}>
                <Percent size={16} /> Record interest
              </button>
            )}
            <button className="btn-primary" onClick={() => setApplyOpen(true)}>
              <Plus size={16} /> Apply for loan
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MiniStat label="Loans" value={String(items.length)} />
        <MiniStat label="Total Principal" value={formatKES(totalPrincipal)} />
        <MiniStat label="Outstanding Balance" value={formatKES(totalBalance)} />
        <MiniStat label="Active" value={String(items.filter((l) => l.status === 'Active').length)} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {['all', 'Draft', 'Submitted', 'Under Review', 'Approved', 'Disbursed', 'Active', 'Paid', 'Overdue', 'Defaulted', 'Carried Forward', 'Rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === s ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        {items.length === 0 ? (
          <EmptyState
            title="No loans found"
            description="Click here to apply for a loan."
            action={<button className="btn-primary" onClick={() => setApplyOpen(true)}><Plus size={16} /> Apply for loan</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="px-5 py-3 font-semibold">Principal</th>
                  <th className="hidden px-5 py-3 font-semibold sm:table-cell">Interest</th>
                  <th className="hidden px-5 py-3 font-semibold md:table-cell">Repayable</th>
                  <th className="hidden px-5 py-3 font-semibold md:table-cell">Balance</th>
                  <th className="hidden px-5 py-3 font-semibold md:table-cell">Due</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {items.map((l) => {
                  const m = memberMap.get(l.member_id);
                  return (
                    <tr key={l.id} className="table-row-hover">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={m?.full_name ?? '?'} size={30} />
                          <span className="font-medium text-ink-900">{m?.full_name ?? 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-semibold text-ink-900">{formatKES(l.principal)}</td>
                      <td className="hidden px-5 py-3 text-ink-600 sm:table-cell">{formatKES(l.interest_amount)}</td>
                      <td className="hidden px-5 py-3 text-ink-600 md:table-cell">{formatKES(l.total_repayable)}</td>
                      <td className="hidden px-5 py-3 font-semibold text-ink-900 md:table-cell">{formatKES(l.current_balance)}</td>
                      <td className="hidden px-5 py-3 text-ink-600 md:table-cell">{formatDate(l.due_date)}</td>
                      <td className="px-5 py-3"><StatusBadge status={l.status} /></td>
                      <td className="px-5 py-3 text-right">
                        <button className="btn-ghost text-xs" onClick={() => setDetail(l)}>Details</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {applyOpen && (
        <LoanApplicationModal
          currentUser={currentUser}
          profiles={memberProfiles}
          onClose={() => setApplyOpen(false)}
          onSaved={async () => { await refresh(); setApplyOpen(false); }}
          push={push}
        />
      )}

      {detail && (
        <LoanDetailModal
          loan={detail}
          member={memberMap.get(detail.member_id) ?? null}
          canEdit={canEdit}
          currentUser={currentUser}
          onClose={() => setDetail(null)}
          onSaved={async () => { await refresh(); setDetail(null); }}
          push={push}
        />
      )}

      {interestOpen && (
        <RecordInterestModal
          loans={loans.filter((l) => l.status === 'Active' || l.status === 'Overdue' || l.status === 'Carried Forward')}
          memberMap={memberMap}
          currentUser={currentUser}
          onClose={() => setInterestOpen(false)}
          onSaved={async () => { await refresh(); setInterestOpen(false); }}
          push={push}
        />
      )}
    </div>
  );
}

function LoanApplicationModal({
  currentUser, profiles, onClose, onSaved, push,
}: {
  currentUser: { id: string; full_name: string; status: string; join_date: string; role?: { role_name: string } | null } | null;
  profiles: { id: string; full_name: string; status: string; join_date: string; role?: { role_name: string } | null }[];
  onClose: () => void;
  onSaved: () => void;
  push: (t: { kind: 'success' | 'error'; message: string; description?: string }) => void;
}) {
  const { loans, subscriptions } = useApp();
  const [memberId, setMemberId] = useState(currentUser?.id ?? profiles[0]?.id ?? '');
  const [principal, setPrincipal] = useState(1000);
  const [transactionCost, setTransactionCost] = useState(mpesaTransactionCost(1000));
  const [purpose, setPurpose] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const profile = profiles.find((p) => p.id === memberId) ?? null;
  const myLoans = loans.filter((l) => l.member_id === memberId);
  const mySubs = subscriptions.filter((s) => s.member_id === memberId);
  const qualification = profile ? qualifyForLoan(profile as never, myLoans, mySubs) : null;

  const rate = 5;
  const interest = interestAmount(principal, rate);
  const repayable = round2(principal + interest + transactionCost);

  const save = async () => {
    if (!profile) { push({ kind: 'error', message: 'Select a member' }); return; }
    if (!qualification?.eligible) { push({ kind: 'error', message: 'Member is not eligible', description: 'Review failed criteria below.' }); return; }
    if (principal <= 0) { push({ kind: 'error', message: 'Principal must be positive' }); return; }
    if (!dueDate) { push({ kind: 'error', message: 'Set a due date' }); return; }
    setSaving(true);
    try {
      const payload: Partial<Loan> = {
        member_id: memberId,
        principal: round2(principal),
        interest_rate: rate,
        interest_amount: interest,
        transaction_cost: round2(transactionCost),
        total_repayable: repayable,
        amount_paid: 0,
        current_balance: repayable,
        principal_balance: round2(principal),
        accrued_interest: interest,
        due_date: dueDate,
        status: 'Submitted',
        purpose: purpose || null,
        credit_snapshot: `Score ${(profile as { credit_score: number }).credit_score} / ${profile.status}`,
      };
      const { error } = await supabase.from('loans').insert(payload);
      if (error) throw error;
      await logAudit({
        user: currentUser,
        action: 'CREATE',
        target_table: 'loans',
        summary: `Loan application ${formatKES(principal)} by ${profile.full_name}`,
        new_value: payload,
      });
      push({ kind: 'success', message: 'Loan application submitted' });
      onSaved();
    } catch (err) {
      push({ kind: 'error', message: 'Submission failed', description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Apply for a loan"
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving || !qualification?.eligible} onClick={save}>
            {saving ? 'Submitting…' : 'Submit application'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Pre-qualification engine */}
        {qualification && (
          <div className={`rounded-xl border p-4 ${qualification.eligible ? 'border-success-200 bg-success-50' : 'border-danger-200 bg-danger-50'}`}>
            <div className="flex items-center gap-2">
              {qualification.eligible ? (
                <ShieldCheck size={18} className="text-success-600" />
              ) : (
                <ShieldAlert size={18} className="text-danger-600" />
              )}
              <p className={`text-sm font-semibold ${qualification.eligible ? 'text-success-800' : 'text-danger-800'}`}>
                {qualification.eligible ? 'Eligible for loan' : 'Ineligible for loan'}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {qualification.checks.map((c, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-white/60 p-2.5">
                  {c.passed ? (
                    <CheckCircle2 size={15} className="mt-0.5 flex-none text-success-600" />
                  ) : (
                    <XCircle size={15} className="mt-0.5 flex-none text-danger-600" />
                  )}
                  <div>
                    <p className="text-xs font-medium text-ink-800">{c.label}</p>
                    <p className="text-[11px] text-ink-500">{c.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Member</label>
            <select className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} — {p.role?.role_name ?? 'Member'}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Principal (KES)</label>
            <input className="input" type="number" min={0} value={principal} onChange={(e) => {
              const p = Number(e.target.value);
              setPrincipal(p);
              setTransactionCost(mpesaTransactionCost(p));
            }} />
          </div>
          <div>
            <label className="label">M-PESA transaction cost (auto)</label>
            <input className="input bg-ink-50" type="number" readOnly value={transactionCost} />
            <p className="mt-1 text-[11px] text-ink-400">Safaricom tariff for KES {principal} transfer</p>
          </div>
          <div>
            <label className="label">Due date</label>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Purpose</label>
            <input className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. School fees, business top-up…" />
          </div>
        </div>

        <div className="rounded-xl bg-ink-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Loan summary (5% interest)</p>
          <div className="mt-2 grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-xs text-ink-500">Principal</p>
              <p className="text-sm font-bold text-ink-900">{formatKES(principal)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Interest</p>
              <p className="text-sm font-bold text-brand-600">{formatKES(interest)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">M-PESA cost</p>
              <p className="text-sm font-bold text-warning-600">{formatKES(transactionCost)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Total repayable</p>
              <p className="text-sm font-bold text-ink-900">{formatKES(repayable)}</p>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-500">Total = Principal + Interest + M-PESA transaction cost</p>
        </div>
      </div>
    </Modal>
  );
}

function LoanDetailModal({
  loan, member, canEdit, currentUser, onClose, onSaved, push,
}: {
  loan: Loan;
  member: { full_name: string; credit_score: number } | null;
  canEdit: boolean;
  currentUser: { id: string; full_name: string } | null;
  onClose: () => void;
  onSaved: () => void;
  push: (t: { kind: 'success' | 'error'; message: string; description?: string }) => void;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const next = nextStatuses(loan.status);

  // Late penalty calc
  const daysPastDue = loan.due_date ? Math.max(0, daysBetween(loan.due_date)) : 0;
  const penalty = daysPastDue > 1 ? latePenalty(toNum(loan.current_balance), daysPastDue) : 0;

  const transition = async (newStatus: string) => {
    try {
      const updates: Partial<Loan> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'Disbursed') {
        updates.disbursed_at = new Date().toISOString();
        updates.approved_by = currentUser?.id ?? null;
      }
      if (newStatus === 'Approved') updates.reviewed_by = currentUser?.id ?? null;
      if (newStatus === 'Active' && loan.status === 'Disbursed') {
        updates.disbursed_at = updates.disbursed_at ?? loan.disbursed_at;
      }
      // Carry-forward: mark old loan and create a new rolled-over loan
      if (newStatus === 'Carried Forward') {
        updates.carried_forward_at = new Date().toISOString();
        const cf = buildCarryForwardLoan(loan);
        const newLoan: Partial<Loan> = {
          member_id: loan.member_id,
          principal: cf.principal,
          interest_rate: 5,
          interest_amount: cf.interest_amount,
          total_repayable: cf.total_repayable,
          amount_paid: 0,
          current_balance: cf.total_repayable,
          principal_balance: cf.principal_balance,
          accrued_interest: cf.accrued_interest,
          due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          status: 'Active',
          carry_forward_from: loan.id,
          credit_snapshot: `Carried forward from ${loan.id.slice(0, 8)}`,
          purpose: `Carry-forward of ${loan.id.slice(0, 8)}`,
        };
        const { error: cfErr } = await supabase.from('loans').insert(newLoan);
        if (cfErr) throw cfErr;
        await logAudit({
          user: currentUser,
          action: 'CREATE',
          target_table: 'loans',
          summary: `Carry-forward loan ${formatKES(cf.principal)} from ${loan.id.slice(0, 8)}`,
          new_value: newLoan,
        });
      }
      const { error } = await supabase.from('loans').update(updates).eq('id', loan.id);
      if (error) throw error;
      await logAudit({
        user: currentUser,
        action: 'UPDATE',
        target_table: 'loans',
        target_id: loan.id,
        summary: `Loan ${loan.id.slice(0, 8)} → ${newStatus}`,
        old_value: { status: loan.status },
        new_value: updates,
      });
      push({ kind: 'success', message: `Loan moved to ${newStatus}` });
      onSaved();
    } catch (err) {
      push({ kind: 'error', message: 'Update failed', description: (err as Error).message });
    }
  };

  return (
    <Modal open onClose={onClose} title={`Loan · ${member?.full_name ?? 'Unknown'}`} size="lg">
      <div className="space-y-4">
        {/* Workflow state */}
        <div className="rounded-xl border border-ink-200 bg-ink-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Workflow state</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            {['Draft', 'Submitted', 'Under Review', 'Approved', 'Disbursed', 'Active', 'Paid'].map((s, i, arr) => {
              const reached = arr.indexOf(loan.status) >= i || (loan.status === 'Overdue' && i <= 5) || (loan.status === 'Defaulted' && i <= 5) || (loan.status === 'Rejected' && i <= 2);
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <span className={`rounded-md px-2 py-1 font-medium ${reached ? 'bg-brand-600 text-white' : 'bg-white text-ink-400'}`}>{s}</span>
                  {i < arr.length - 1 && <ChevronRight size={12} className="text-ink-300" />}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={loan.status} />
            {loan.status === 'Rejected' && <span className="text-xs text-danger-600">Application rejected</span>}
            {loan.status === 'Overdue' && <span className="text-xs text-danger-600">Overdue by {daysPastDue} days</span>}
            {loan.status === 'Defaulted' && <span className="text-xs text-danger-600">Defaulted</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Principal" value={formatKES(loan.principal)} />
          <Stat label="Interest (5%)" value={formatKES(loan.interest_amount)} />
          <Stat label="Transaction cost" value={formatKES(loan.transaction_cost)} accent="warning" />
          <Stat label="Repayable" value={formatKES(loan.total_repayable)} />
          <Stat label="Total Balance" value={formatKES(loan.current_balance)} />
          <Stat label="Principal Balance" value={formatKES(loan.principal_balance)} accent="brand" />
          <Stat label="Accrued Interest" value={formatKES(loan.accrued_interest)} accent="success" />
          <Stat label="Paid" value={formatKES(loan.amount_paid)} />
          <Stat label="Due date" value={formatDate(loan.due_date)} />
          <Stat label="Days past due" value={String(daysPastDue)} />
          <Stat label="Late penalty" value={formatKES(penalty)} accent="danger" />
        </div>

        {loan.carry_forward_from && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
            <p className="text-xs font-semibold text-brand-800">Carried forward from loan {loan.carry_forward_from.slice(0, 8)}</p>
            <p className="mt-0.5 text-[11px] text-brand-600">This loan rolls over the unpaid balance of a prior loan.</p>
          </div>
        )}

        {loan.purpose && (
          <div className="rounded-xl bg-ink-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Purpose</p>
            <p className="mt-1 text-sm text-ink-700">{loan.purpose}</p>
          </div>
        )}

        {loan.credit_snapshot && (
          <p className="text-xs text-ink-500">Credit snapshot: {loan.credit_snapshot}</p>
        )}

        {/* State transitions */}
        {canEdit && next.length > 0 && (
          <div className="rounded-xl border border-ink-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Available transitions</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {next.map((s) => (
                <button
                  key={s}
                  className={s === 'Rejected' || s === 'Defaulted' ? 'btn-danger text-xs' : s === 'Carried Forward' ? 'btn-primary text-xs' : 'btn-primary text-xs'}
                  onClick={() => setConfirmStatus(s)}
                >
                  {s === 'Carried Forward' ? 'Carry forward balance' : `Move to ${s}`}
                </button>
              ))}
              <button className="btn-ghost text-xs" onClick={() => setPayOpen(true)}>
                Record repayment
              </button>
            </div>
          </div>
        )}
      </div>

      {payOpen && (
        <RecordPaymentModal
          loan={loan}
          currentUser={currentUser}
          onClose={() => setPayOpen(false)}
          onSaved={async () => { await onSaved(); setPayOpen(false); }}
          push={push}
        />
      )}

      <ConfirmDialog
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        onConfirm={() => confirmStatus && transition(confirmStatus)}
        title={confirmStatus === 'Carried Forward' ? 'Carry forward loan balance' : 'Confirm status change'}
        message={confirmStatus === 'Carried Forward'
          ? `Roll the outstanding principal (${formatKES(loan.principal_balance)}) + accrued interest (${formatKES(loan.accrued_interest)}) into a new loan with fresh 5% interest? The old loan will be marked "Carried Forward".`
          : `Move this loan to "${confirmStatus}"? This action is logged to the audit trail.`}
        confirmLabel={confirmStatus === 'Carried Forward' ? 'Carry forward' : 'Confirm'}
        danger={confirmStatus === 'Rejected' || confirmStatus === 'Defaulted'}
      />
    </Modal>
  );
}

function RecordPaymentModal({
  loan, currentUser, onClose, onSaved, push,
}: {
  loan: Loan;
  currentUser: { id: string; full_name: string } | null;
  onClose: () => void;
  onSaved: () => void;
  push: (t: { kind: 'success' | 'error'; message: string; description?: string }) => void;
}) {
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  const split = splitRepayment(loan, amount);

  const save = async () => {
    if (amount <= 0) { push({ kind: 'error', message: 'Enter a positive amount' }); return; }
    setSaving(true);
    try {
      const { error: lpErr } = await supabase.from('loan_payments').insert({
        loan_id: loan.id,
        amount_paid: round2(amount),
        principal_paid: split.principal_paid,
        interest_paid: split.interest_paid,
        is_carry_forward: false,
        recorded_by: currentUser?.id ?? null,
      });
      if (lpErr) throw lpErr;
      const newStatus = split.is_fully_paid ? 'Paid' : loan.status === 'Overdue' ? 'Active' : loan.status;
      const { error: lErr } = await supabase.from('loans').update({
        amount_paid: split.new_amount_paid,
        current_balance: Math.max(0, split.new_current_balance),
        principal_balance: Math.max(0, split.new_principal_balance),
        accrued_interest: Math.max(0, split.new_accrued_interest),
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', loan.id);
      if (lErr) throw lErr;
      await logAudit({
        user: currentUser,
        action: 'CREATE',
        target_table: 'loan_payments',
        target_id: loan.id,
        summary: `Repayment ${formatKES(amount)} (interest ${formatKES(split.interest_paid)} + principal ${formatKES(split.principal_paid)}) on loan ${loan.id.slice(0, 8)}`,
        new_value: { amount_paid: amount, principal_paid: split.principal_paid, interest_paid: split.interest_paid },
      });
      push({ kind: 'success', message: 'Repayment recorded' });
      onSaved();
    } catch (err) {
      push({ kind: 'error', message: 'Payment failed', description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Record loan repayment"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Record'}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-xl bg-ink-50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-ink-500">Principal balance</span><span className="font-semibold text-brand-700">{formatKES(loan.principal_balance)}</span></div>
          <div className="flex justify-between"><span className="text-ink-500">Accrued interest</span><span className="font-semibold text-success-700">{formatKES(loan.accrued_interest)}</span></div>
          <div className="flex justify-between border-t border-ink-200 pt-1.5 mt-1.5"><span className="text-ink-500">Total balance</span><span className="font-bold text-ink-900">{formatKES(loan.current_balance)}</span></div>
        </div>
        <div>
          <label className="label">Repayment amount (KES) — interest + principal paid together</label>
          <input className="input" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        {amount > 0 && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Payment split preview</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between"><span className="text-ink-600">To interest</span><span className="font-semibold text-success-700">{formatKES(split.interest_paid)}</span></div>
              <div className="flex justify-between"><span className="text-ink-600">To principal</span><span className="font-semibold text-brand-700">{formatKES(split.principal_paid)}</span></div>
              <div className="flex justify-between border-t border-brand-200 pt-1"><span className="text-ink-600">Remaining balance</span><span className="font-bold text-ink-900">{formatKES(Math.max(0, split.new_current_balance))}</span></div>
            </div>
          </div>
        )}
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'brand' | 'success' | 'danger' }) {
  const color = accent === 'brand' ? 'text-brand-700' : accent === 'success' ? 'text-success-700' : accent === 'danger' ? 'text-danger-700' : 'text-ink-900';
  return (
    <div className="rounded-xl bg-ink-50 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className={`mt-1 text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

function RecordInterestModal({
  loans, memberMap, currentUser, onClose, onSaved, push,
}: {
  loans: Loan[];
  memberMap: Map<string, Profile>;
  currentUser: Profile | null;
  onClose: () => void;
  onSaved: () => void;
  push: (t: { kind: 'success' | 'error'; message: string; description?: string }) => void;
}) {
  const [loanId, setLoanId] = useState(loans[0]?.id ?? '');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const selected = loans.find((l) => l.id === loanId);

  const save = async () => {
    if (!selected) { push({ kind: 'error', message: 'Select a loan' }); return; }
    if (amount <= 0) { push({ kind: 'error', message: 'Interest amount must be positive' }); return; }
    setSaving(true);
    try {
      const newAccrued = round2(toNum(selected.accrued_interest) + amount);
      const newBalance = round2(toNum(selected.current_balance) + amount);
      const { error: lErr } = await supabase.from('loans').update({
        accrued_interest: newAccrued,
        current_balance: newBalance,
        updated_at: new Date().toISOString(),
      }).eq('id', selected.id);
      if (lErr) throw lErr;
      const { error: iErr } = await supabase.from('interest_records').insert({
        loan_id: selected.id,
        amount: round2(amount),
        date_earned: date,
        rate_applied: selected.interest_rate,
        recorded_by: currentUser?.id ?? null,
      });
      if (iErr) throw iErr;
      await logAudit({
        user: currentUser,
        action: 'CREATE',
        target_table: 'interest_records',
        target_id: selected.id,
        summary: `Recorded interest ${formatKES(amount)} on loan ${selected.id.slice(0, 8)} (${memberMap.get(selected.member_id)?.full_name ?? 'Unknown'})`,
        new_value: { amount, date_earned: date, loan_id: selected.id },
      });
      push({ kind: 'success', message: 'Interest recorded', description: `Added ${formatKES(amount)} to accrued interest.` });
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
      title="Record loan interest"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-success" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Record interest'}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Loan</label>
          <select className="input" value={loanId} onChange={(e) => setLoanId(e.target.value)}>
            {loans.map((l) => (
              <option key={l.id} value={l.id}>
                {memberMap.get(l.member_id)?.full_name ?? 'Unknown'} — {formatKES(l.principal)} ({l.status})
              </option>
            ))}
          </select>
        </div>
        {selected && (
          <div className="rounded-xl bg-ink-50 p-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">Current accrued interest</span><span className="font-semibold text-success-700">{formatKES(selected.accrued_interest)}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Current balance</span><span className="font-semibold text-ink-900">{formatKES(selected.current_balance)}</span></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Interest amount (KES)</label>
            <input className="input" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Date earned</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {amount > 0 && selected && (
          <div className="rounded-xl border border-success-200 bg-success-50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-success-700">After recording</p>
            <div className="mt-1.5 space-y-1">
              <div className="flex justify-between"><span className="text-ink-600">New accrued interest</span><span className="font-semibold text-success-700">{formatKES(round2(toNum(selected.accrued_interest) + amount))}</span></div>
              <div className="flex justify-between"><span className="text-ink-600">New total balance</span><span className="font-bold text-ink-900">{formatKES(round2(toNum(selected.current_balance) + amount))}</span></div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
