import { useState, useEffect } from 'react';
import { Save, ShieldAlert, History, Wallet } from 'lucide-react';
import { useApp } from '../lib/store';
import { supabase } from '../lib/supabase';
import { formatKES, formatDate, toNum } from '../lib/finance';
import { logAudit } from '../lib/audit';
import { useToast } from '../lib/toast';
import {
  PageHeader, Card, Spinner, EmptyState,
} from '../components/ui';
import { canManage, PERMISSIONS } from '../lib/rbac';
import type { RoleName } from '../types';

const EDITABLE = [
  { key: 'org_name', label: 'Organization name', type: 'text' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'interest_rate', label: 'Interest rate (%)', type: 'number' },
  { key: 'reserve_ratio', label: 'Reserve ratio (0-1)', type: 'number' },
  { key: 'min_retained_capital', label: 'Min retained capital (KES)', type: 'number' },
  { key: 'grace_period_days', label: 'Grace period (days)', type: 'number' },
  { key: 'late_penalty_rate', label: 'Late penalty rate (0-1)', type: 'number' },
  { key: 'membership_fee_amount', label: 'Membership fee (KES)', type: 'number' },
  { key: 'min_tenure_months', label: 'Min tenure (months)', type: 'number' },
  { key: 'subscription_monthly_rate', label: 'Monthly subscription rate (KES)', type: 'number' },
  { key: 'subscription_annual_rate', label: 'Annual subscription rate (KES)', type: 'number' },
  { key: 'subscription_grace_days', label: 'Subscription grace days', type: 'number' },
  { key: 'subscription_late_fee', label: 'Subscription late fee (KES)', type: 'number' },
];

export function Settings() {
  const { settings, currentUser, refresh, auditLogs } = useApp();
  const { push } = useToast();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms = PERMISSIONS[role];
  const canEdit = canManage(perms, 'settings');

  useEffect(() => {
    const d: Record<string, string> = {};
    for (const f of EDITABLE) {
      const v = settings[f.key];
      d[f.key] = typeof v === 'string' ? v.replace(/"/g, '') : String(v ?? '');
    }
    setDraft(d);
  }, [settings]);

  const snapshot = settings.financial_snapshot as { total_assets: number; cash_at_hand: number; fixed_reserve: number; loanable_pool: number; as_of: string } | undefined;
  const settingsAudit = auditLogs.filter((l) => l.target_table === 'organization_settings').slice(0, 6);

  const save = async () => {
    setSaving(true);
    try {
      for (const f of EDITABLE) {
        const raw = draft[f.key];
        const val = f.type === 'number' ? Number(raw) : raw;
        const { error } = await supabase
          .from('organization_settings')
          .upsert({ key: f.key, value: JSON.stringify(val), updated_at: new Date().toISOString() });
        if (error) throw error;
      }
      await logAudit({
        user: currentUser,
        action: 'UPDATE',
        target_table: 'organization_settings',
        summary: 'Updated global system settings',
        new_value: draft,
      });
      push({ kind: 'success', message: 'Settings saved' });
      await refresh();
    } catch (err) {
      push({ kind: 'error', message: 'Save failed', description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Global System Settings"
        subtitle="Organization configuration & financial parameters"
        actions={canEdit && (
          <button className="btn-primary" disabled={saving} onClick={save}>
            {saving ? <Spinner /> : <><Save size={16} /> Save changes</>}
          </button>
        )}
      />

      {!canEdit && (
        <div className="rounded-2xl border border-warning-200 bg-warning-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} className="mt-0.5 flex-none text-warning-600" />
            <p className="text-sm text-warning-800">
              You have view-only access. Only the Admin can modify system settings.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink-900">Financial parameters</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {EDITABLE.map((f) => (
                <div key={f.key}>
                  <label className="label">{f.label}</label>
                  <input
                    className="input"
                    type={f.type}
                    disabled={!canEdit}
                    value={draft[f.key] ?? ''}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Wallet size={16} className="text-brand-600" /> Subscription rates
            </h2>
            <p className="mt-1 text-xs text-ink-500">Configure the monthly and annual subscription amounts. These are used as defaults when recording payments.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Monthly subscription (KES)</label>
                <input
                  className="input"
                  type="number"
                  disabled={!canEdit}
                  value={draft.subscription_monthly_rate ?? ''}
                  onChange={(e) => setDraft({ ...draft, subscription_monthly_rate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Annual subscription (KES)</label>
                <input
                  className="input"
                  type="number"
                  disabled={!canEdit}
                  value={draft.subscription_annual_rate ?? ''}
                  onChange={(e) => setDraft({ ...draft, subscription_annual_rate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Grace days (after due date)</label>
                <input
                  className="input"
                  type="number"
                  disabled={!canEdit}
                  value={draft.subscription_grace_days ?? ''}
                  onChange={(e) => setDraft({ ...draft, subscription_grace_days: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Late fee (KES)</label>
                <input
                  className="input"
                  type="number"
                  disabled={!canEdit}
                  value={draft.subscription_late_fee ?? ''}
                  onChange={(e) => setDraft({ ...draft, subscription_late_fee: e.target.value })}
                />
              </div>
            </div>
            {canEdit && (
              <p className="mt-3 text-[11px] text-ink-400">Changes apply to new subscription records going forward.</p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink-900">Audited financial snapshot</h2>
            {snapshot ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <SnapItem label="Total assets" value={formatKES(snapshot.total_assets)} />
                <SnapItem label="Cash at hand" value={formatKES(snapshot.cash_at_hand)} />
                <SnapItem label="Fixed reserve" value={formatKES(snapshot.fixed_reserve)} />
                <SnapItem label="Loanable pool" value={formatKES(snapshot.loanable_pool)} />
                <div className="col-span-2 text-xs text-ink-500">As of {formatDate(snapshot.as_of)}</div>
              </div>
            ) : (
              <EmptyState title="No snapshot configured" />
            )}
          </Card>

          <Card>
            <div className="border-b border-ink-200 px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <History size={16} className="text-ink-500" /> Settings change history
              </h2>
            </div>
            {settingsAudit.length === 0 ? (
              <EmptyState title="No settings changes logged" />
            ) : (
              <div className="divide-y divide-ink-100">
                {settingsAudit.map((l) => (
                  <div key={l.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium text-ink-800">{l.summary}</p>
                      <p className="text-xs text-ink-500">{l.user_name}</p>
                    </div>
                    <span className="text-xs text-ink-400">{formatDate(l.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function SnapItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 p-3">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-ink-900">{value}</p>
    </div>
  );
}
