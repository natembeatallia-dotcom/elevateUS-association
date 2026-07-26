import { useMemo, useState } from 'react';
import { Mail, Send, Users } from 'lucide-react';
import { useApp } from '../lib/store';
import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/finance';
import { logAudit } from '../lib/audit';
import { useToast } from '../lib/toast';
import {
  PageHeader, Card, StatusBadge, EmptyState, Spinner,
} from '../components/ui';
import { canManage, PERMISSIONS } from '../lib/rbac';
import type { RoleName, EmailLog } from '../types';

const TEMPLATES: Record<string, { subject: string; body: string }> = {
  'Payment Reminder': {
    subject: 'Monthly Subscription Reminder',
    body: 'Dear member, your monthly subscription is due by the 5th. Kindly remit to the association account. Thank you.',
  },
  'Overdue Notice': {
    subject: 'Loan Repayment Overdue',
    body: 'Dear member, your loan repayment is overdue. Kindly regularize your account to avoid additional penalties.',
  },
  'Payment Update': {
    subject: 'Payment Received',
    body: 'Dear member, we acknowledge receipt of your payment. Thank you for your continued compliance.',
  },
  'AGM Notice': {
    subject: 'Notice of Annual General Meeting',
    body: 'Dear member, you are invited to the Annual General Meeting. Please confirm attendance.',
  },
};

const AUDIENCE_FILTERS = [
  { key: 'all', label: 'All members' },
  { key: 'active', label: 'Active members' },
  { key: 'overdue', label: 'Members with overdue loans' },
  { key: 'defaulted', label: 'Defaulted members' },
  { key: 'highrisk', label: 'High risk members' },
];

export function Comms() {
  const { emailLogs, profiles, loans, currentUser, refresh } = useApp();
  const { push } = useToast();
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState('all');
  const [template, setTemplate] = useState<keyof typeof TEMPLATES>('Payment Reminder');
  const [subject, setSubject] = useState(TEMPLATES['Payment Reminder'].subject);
  const [body, setBody] = useState(TEMPLATES['Payment Reminder'].body);

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms = PERMISSIONS[role];
  const canEdit = canManage(perms, 'comms');

  const recipients = useMemo(() => {
    if (audience === 'all') return profiles;
    if (audience === 'active') return profiles.filter((p) => p.status === 'Active');
    if (audience === 'highrisk') return profiles.filter((p) => p.status === 'High Risk');
    if (audience === 'overdue') {
      const ids = new Set(loans.filter((l) => l.status === 'Overdue').map((l) => l.member_id));
      return profiles.filter((p) => ids.has(p.id));
    }
    if (audience === 'defaulted') {
      const ids = new Set(loans.filter((l) => l.status === 'Defaulted').map((l) => l.member_id));
      return profiles.filter((p) => ids.has(p.id));
    }
    return profiles;
  }, [audience, profiles, loans]);

  const applyTemplate = (t: keyof typeof TEMPLATES) => {
    setTemplate(t);
    setSubject(TEMPLATES[t].subject);
    setBody(TEMPLATES[t].body);
  };

  const send = async () => {
    if (!subject.trim() || !body.trim()) { push({ kind: 'error', message: 'Subject and body required' }); return; }
    setSending(true);
    try {
      const payload: Partial<EmailLog> = {
        recipient_group: AUDIENCE_FILTERS.find((a) => a.key === audience)?.label ?? audience,
        subject, body, template_used: template,
        status: 'Logged',
        sent_by: currentUser?.id ?? null,
        recipient_count: recipients.length,
      };
      const { error } = await supabase.from('email_logs').insert(payload);
      if (error) throw error;
      await logAudit({
        user: currentUser,
        action: 'CREATE',
        target_table: 'email_logs',
        summary: `Sent "${subject}" to ${recipients.length} recipients (${audience})`,
        new_value: payload,
      });
      push({ kind: 'success', message: `Message logged for ${recipients.length} recipients`, description: 'Open the dispatch log to copy content for sending via your email client.' });
      await refresh();
    } catch (err) {
      push({ kind: 'error', message: 'Send failed', description: (err as Error).message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Email & Comms Center" subtitle="Targeted messaging engine" />

      <div className="rounded-2xl border border-warning-200 bg-warning-50 px-5 py-3.5">
        <div className="flex items-start gap-2.5">
          <Mail size={16} className="mt-0.5 flex-none text-warning-600" />
          <p className="text-xs text-warning-800">
            <span className="font-semibold">Email delivery note:</span> Messages are logged and tracked here. To deliver emails to member inboxes, connect an email service provider (e.g. Resend, SendGrid) via an Edge Function. Until then, use the logged content to send via your usual email client.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canEdit && (
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Send size={16} className="text-brand-600" /> Compose message
            </h2>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Audience filter</label>
                <select className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>
                  {AUDIENCE_FILTERS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
                <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
                  <Users size={12} /> {recipients.length} recipients
                </p>
              </div>

              <div>
                <label className="label">Template</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(TEMPLATES).map((t) => (
                    <button
                      key={t}
                      onClick={() => applyTemplate(t as keyof typeof TEMPLATES)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                        template === t ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Subject</label>
                <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <label className="label">Body</label>
                <textarea className="input min-h-[140px]" value={body} onChange={(e) => setBody(e.target.value)} />
              </div>

              <button className="btn-primary w-full" disabled={sending} onClick={send}>
                {sending ? <Spinner label="Sending…" /> : <><Send size={16} /> Send to {recipients.length} recipients</>}
              </button>
            </div>
          </Card>
        )}

        <Card>
          <div className="border-b border-ink-200 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Mail size={16} className="text-ink-500" /> Dispatch log
            </h2>
          </div>
          {emailLogs.length === 0 ? (
            <EmptyState title="No messages logged" />
          ) : (
            <div className="divide-y divide-ink-100">
              {emailLogs.map((l) => (
                <div key={l.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">{l.subject ?? '(no subject)'}</p>
                      <p className="text-xs text-ink-500">To: {l.recipient_group} · {l.recipient_count} recipients</p>
                      {l.template_used && <p className="text-[11px] text-ink-400">Template: {l.template_used}</p>}
                      {l.body && <p className="mt-1 line-clamp-2 text-xs text-ink-600">{l.body}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={l.status} />
                      <span className="text-[11px] text-ink-400">{formatDateTime(l.sent_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
