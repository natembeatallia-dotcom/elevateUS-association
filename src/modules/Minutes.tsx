import { useMemo, useState } from 'react';
import { Plus, ClipboardList, FileText, Clock } from 'lucide-react';
import { useApp } from '../lib/store';
import { supabase } from '../lib/supabase';
import { formatDate, todayISO } from '../lib/finance';
import { logAudit } from '../lib/audit';
import { useToast } from '../lib/toast';
import {
  PageHeader, Card, StatusBadge, EmptyState, Modal, Spinner,
} from '../components/ui';
import { canManage, PERMISSIONS } from '../lib/rbac';
import type { RoleName, Minute } from '../types';

export function Minutes() {
  const { minutes, currentUser, refresh } = useApp();
  const { push } = useToast();
  const [editOpen, setEditOpen] = useState<Minute | null>(null);
  const [viewItem, setViewItem] = useState<Minute | null>(null);

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms = PERMISSIONS[role];
  const canEdit = canManage(perms, 'minutes');

  const sorted = useMemo(
    () => [...minutes].sort((a, b) => b.meeting_date.localeCompare(a.meeting_date)),
    [minutes]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Meeting Minutes"
        subtitle="Secretary-managed meeting records & resolutions"
        actions={canEdit && (
          <button className="btn-primary" onClick={() => setEditOpen(emptyMinute())}>
            <Plus size={16} /> New minutes
          </button>
        )}
      />

      {sorted.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList size={20} />}
            title="No minutes recorded"
            description={canEdit ? 'Create the first meeting minutes.' : 'Minutes will appear here once recorded.'}
            action={canEdit && <button className="btn-primary" onClick={() => setEditOpen(emptyMinute())}><Plus size={16} /> New minutes</button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sorted.map((m) => (
            <Card key={m.id} hover className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink-900">{m.title}</h3>
                    <p className="flex items-center gap-1 text-xs text-ink-500">
                      <Clock size={11} /> {formatDate(m.meeting_date)}
                    </p>
                  </div>
                </div>
                <StatusBadge status={m.status} />
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-ink-600">{m.body || 'No content yet.'}</p>
              {m.attendees && <p className="mt-2 text-xs text-ink-500">Attendees: {m.attendees}</p>}
              <div className="mt-4 flex gap-2">
                <button className="btn-ghost text-xs" onClick={() => setViewItem(m)}>Read</button>
                {canEdit && <button className="btn-ghost text-xs" onClick={() => setEditOpen(m)}>Edit</button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {viewItem && (
        <Modal open onClose={() => setViewItem(null)} title={viewItem.title} size="lg">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={viewItem.status} />
              <span className="text-xs text-ink-500">{formatDate(viewItem.meeting_date)}</span>
            </div>
            {viewItem.attendees && <p className="text-xs text-ink-500">Attendees: {viewItem.attendees}</p>}
            <div className="whitespace-pre-wrap rounded-xl bg-ink-50 p-4 text-sm leading-relaxed text-ink-700">
              {viewItem.body || 'No content recorded.'}
            </div>
          </div>
        </Modal>
      )}

      {editOpen && (
        <MinuteForm
          minute={editOpen}
          currentUser={currentUser}
          onClose={() => setEditOpen(null)}
          onSaved={async () => { await refresh(); setEditOpen(null); }}
          push={push}
        />
      )}
    </div>
  );
}

function MinuteForm({
  minute, currentUser, onClose, onSaved, push,
}: {
  minute: Minute;
  currentUser: { id: string; full_name: string } | null;
  onClose: () => void;
  onSaved: () => void;
  push: (t: { kind: 'success' | 'error'; message: string; description?: string }) => void;
}) {
  const [title, setTitle] = useState(minute.title);
  const [date, setDate] = useState(minute.meeting_date || todayISO());
  const [body, setBody] = useState(minute.body);
  const [attendees, setAttendees] = useState(minute.attendees ?? '');
  const [status, setStatus] = useState(minute.status || 'Draft');
  const [saving, setSaving] = useState(false);

  const isNew = !minute.id;

  const save = async () => {
    if (!title.trim()) { push({ kind: 'error', message: 'Title is required' }); return; }
    setSaving(true);
    try {
      const payload: Partial<Minute> = {
        title, meeting_date: date, body, attendees: attendees || null, status,
        recorded_by: currentUser?.id ?? null,
      };
      let res;
      if (isNew) {
        res = await supabase.from('minutes').insert(payload);
      } else {
        res = await supabase.from('minutes').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', minute.id);
      }
      if (res.error) throw res.error;
      await logAudit({
        user: currentUser,
        action: isNew ? 'CREATE' : 'UPDATE',
        target_table: 'minutes',
        target_id: minute.id || undefined,
        summary: `${isNew ? 'Recorded' : 'Updated'} minutes: "${title}"`,
        new_value: payload,
      });
      push({ kind: 'success', message: `Minutes ${isNew ? 'recorded' : 'updated'}` });
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
      title={isNew ? 'New meeting minutes' : 'Edit minutes'}
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={save}>
            {saving ? <Spinner /> : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Monthly Review Board — June 2026" />
          </div>
          <div>
            <label className="label">Meeting date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Draft</option>
              <option>Published</option>
              <option>Archived</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Attendees</label>
            <input className="input" value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="Dan Simiyu, Cyril Antony, Mercy Machiba…" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Minutes body</label>
            <textarea className="input min-h-[240px] text-sm leading-relaxed" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Record proceedings, resolutions, and action items…" />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function emptyMinute(): Minute {
  return { id: '', meeting_date: todayISO(), title: '', body: '', attendees: null, status: 'Draft', recorded_by: null };
}
