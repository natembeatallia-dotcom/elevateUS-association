import { useMemo, useState } from 'react';
import { Plus, Calendar, MapPin, Users, Check, X, Clock } from 'lucide-react';
import { useApp } from '../lib/store';
import { supabase } from '../lib/supabase';
import { formatDateTime, formatDate, todayISO } from '../lib/finance';
import { logAudit } from '../lib/audit';
import { useToast } from '../lib/toast';
import {
  PageHeader, Card, Avatar, StatusBadge, EmptyState, Modal,
} from '../components/ui';
import { canManage, PERMISSIONS } from '../lib/rbac';
import type { RoleName, EventItem } from '../types';

const EVENT_TYPES = ['Meeting', 'AGM', 'Welfare', 'Review', 'Social', 'Other'];

export function Events() {
  const { events, eventAttendees, profiles, currentUser, refresh } = useApp();
  const { push } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<EventItem | null>(null);

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms = PERMISSIONS[role];
  const canEdit = canManage(perms, 'events');

  const memberMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const upcoming = useMemo(() => events.filter((e) => new Date(e.event_date) >= new Date()), [events]);
  const past = useMemo(() => events.filter((e) => new Date(e.event_date) < new Date()), [events]);

  const rsvp = async (eventId: string, status: 'Confirmed' | 'Declined') => {
    if (!currentUser) return;
    try {
      const existing = eventAttendees.find((a) => a.event_id === eventId && a.member_id === currentUser.id);
      if (existing) {
        const { error } = await supabase.from('event_attendees').update({ attendance_status: status }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('event_attendees').insert({
          event_id: eventId, member_id: currentUser.id, attendance_status: status,
        });
        if (error) throw error;
      }
      await logAudit({
        user: currentUser,
        action: 'UPDATE',
        target_table: 'event_attendees',
        target_id: eventId,
        summary: `RSVP ${status} for event`,
      });
      push({ kind: 'success', message: `RSVP ${status === 'Confirmed' ? 'confirmed' : 'declined'}` });
      await refresh();
    } catch (err) {
      push({ kind: 'error', message: 'RSVP failed', description: (err as Error).message });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Event Management"
        subtitle="Organizational schedule & RSVP"
        actions={canEdit && (
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={16} /> Schedule event
          </button>
        )}
      />

      <div className="space-y-5">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Upcoming</h2>
          {upcoming.length === 0 ? (
            <EmptyState icon={<Calendar size={20} />} title="No upcoming events" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {upcoming.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  attendees={eventAttendees.filter((a) => a.event_id === e.id)}
                  memberMap={memberMap}
                  currentUser={currentUser}
                  canEdit={canEdit}
                  onRsvp={rsvp}
                  onView={() => setDetail(e)}
                />
              ))}
            </div>
          )}
        </div>

        {past.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Past</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {past.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  attendees={eventAttendees.filter((a) => a.event_id === e.id)}
                  memberMap={memberMap}
                  currentUser={currentUser}
                  canEdit={canEdit}
                  onRsvp={rsvp}
                  onView={() => setDetail(e)}
                  past
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {addOpen && (
        <AddEventModal
          currentUser={currentUser}
          onClose={() => setAddOpen(false)}
          onSaved={async () => { await refresh(); setAddOpen(false); }}
          push={push}
        />
      )}

      {detail && (
        <EventDetailModal
          event={detail}
          attendees={eventAttendees.filter((a) => a.event_id === detail.id)}
          memberMap={memberMap}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function EventCard({
  event, attendees, memberMap, currentUser, canEdit, onRsvp, onView, past,
}: {
  event: EventItem;
  attendees: { member_id: string; attendance_status: string }[];
  memberMap: Map<string, { full_name: string }>;
  currentUser: { id: string } | null;
  canEdit: boolean;
  onRsvp: (eventId: string, status: 'Confirmed' | 'Declined') => void;
  onView: () => void;
  past?: boolean;
}) {
  const myRsvp = attendees.find((a) => a.member_id === currentUser?.id);
  const confirmed = attendees.filter((a) => a.attendance_status === 'Confirmed').length;

  return (
    <Card className={`p-5 ${past ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="badge-info">{event.event_type}</span>
          <h3 className="mt-2 text-base font-semibold text-ink-900">{event.title}</h3>
          {event.description && <p className="mt-1 text-xs text-ink-500">{event.description}</p>}
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-xs text-ink-600">
        <div className="flex items-center gap-2"><Clock size={13} className="text-ink-400" /> {formatDateTime(event.event_date)}</div>
        {event.location && <div className="flex items-center gap-2"><MapPin size={13} className="text-ink-400" /> {event.location}</div>}
        <div className="flex items-center gap-2"><Users size={13} className="text-ink-400" /> {confirmed} confirmed</div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button className="btn-ghost text-xs" onClick={onView}>View & RSVP</button>
        {!past && (
          <>
            <button
              className={`text-xs ${myRsvp?.attendance_status === 'Confirmed' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onRsvp(event.id, 'Confirmed')}
            >
              <Check size={14} /> Confirm
            </button>
            <button
              className={`text-xs ${myRsvp?.attendance_status === 'Declined' ? 'btn-danger' : 'btn-ghost'}`}
              onClick={() => onRsvp(event.id, 'Declined')}
            >
              <X size={14} /> Decline
            </button>
          </>
        )}
      </div>
    </Card>
  );
}

function EventDetailModal({
  event, attendees, memberMap, onClose,
}: {
  event: EventItem;
  attendees: { member_id: string; attendance_status: string }[];
  memberMap: Map<string, { full_name: string }>;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title={event.title} size="md">
      <div className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-ink-600"><Clock size={14} /> {formatDateTime(event.event_date)}</div>
          {event.location && <div className="flex items-center gap-2 text-ink-600"><MapPin size={14} /> {event.location}</div>}
          <div><span className="badge-info">{event.event_type}</span></div>
          {event.description && <p className="text-ink-700">{event.description}</p>}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Attendance registry</p>
          <div className="space-y-1.5">
            {attendees.length === 0 ? (
              <p className="text-xs text-ink-500">No RSVPs yet</p>
            ) : (
              attendees.map((a, i) => {
                const m = memberMap.get(a.member_id);
                return (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Avatar name={m?.full_name ?? '?'} size={26} />
                      <span className="font-medium text-ink-800">{m?.full_name ?? 'Unknown'}</span>
                    </div>
                    <StatusBadge status={a.attendance_status} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function AddEventModal({
  currentUser, onClose, onSaved, push,
}: {
  currentUser: { id: string; full_name: string } | null;
  onClose: () => void;
  onSaved: () => void;
  push: (t: { kind: 'success' | 'error'; message: string; description?: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState(EVENT_TYPES[0]);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('18:00');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) { push({ kind: 'error', message: 'Title is required' }); return; }
    setSaving(true);
    try {
      const eventDate = new Date(`${date}T${time}:00`).toISOString();
      const payload: Partial<EventItem> = {
        title, description: description || null, event_type: type,
        event_date: eventDate, location: location || null,
        created_by: currentUser?.id ?? null,
      };
      const { error } = await supabase.from('events').insert(payload);
      if (error) throw error;
      await logAudit({
        user: currentUser,
        action: 'CREATE',
        target_table: 'events',
        summary: `Scheduled event "${title}"`,
        new_value: payload,
      });
      push({ kind: 'success', message: 'Event scheduled' });
      onSaved();
    } catch (err) {
      push({ kind: 'error', message: 'Failed to schedule', description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Schedule event"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Schedule'}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[70px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Time</label>
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
