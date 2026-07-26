import { useMemo, useState } from 'react';
import { Search, FileText, History, BookOpen, Plus } from 'lucide-react';
import { useApp } from '../lib/store';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/finance';
import { logAudit } from '../lib/audit';
import { useToast } from '../lib/toast';
import {
  PageHeader, Card, EmptyState, Modal,
} from '../components/ui';
import { canManage, PERMISSIONS } from '../lib/rbac';
import type { RoleName, ConstitutionVersion, ConstitutionArticle } from '../types';

export function Constitution() {
  const { constitution, profiles, currentUser, refresh, auditLogs } = useApp();
  const { push } = useToast();
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState<ConstitutionVersion | null>(constitution[0] ?? null);
  const [amendOpen, setAmendOpen] = useState(false);

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms = PERMISSIONS[role];
  const canEdit = canManage(perms, 'constitution');

  const memberMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const amendments = auditLogs.filter((l) => l.target_table === 'constitution_versions').slice(0, 8);

  // Sync version when constitution loads
  if (!version && constitution.length > 0) {
    setVersion(constitution[0]);
  }

  const matches = useMemo(() => {
    if (!version || !query) return null;
    const q = query.toLowerCase();
    const results: { article: number; articleTitle: string; section: string; sectionTitle: string; body: string }[] = [];
    for (const art of version.content as ConstitutionArticle[]) {
      for (const sec of art.sections) {
        if (
          sec.body.toLowerCase().includes(q) ||
          sec.title.toLowerCase().includes(q) ||
          art.title.toLowerCase().includes(q)
        ) {
          results.push({ article: art.article, articleTitle: art.title, section: sec.section, sectionTitle: sec.title, body: sec.body });
        }
      }
    }
    return results;
  }, [version, query]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Constitution Digital Reader"
        subtitle="Articles, sections, change-log & amendments"
        actions={canEdit && (
          <button className="btn-primary" onClick={() => setAmendOpen(true)}>
            <Plus size={16} /> New amendment
          </button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Article index */}
        <Card className="lg:col-span-1">
          <div className="border-b border-ink-200 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <BookOpen size={16} className="text-brand-600" /> Articles
            </h2>
            <select
              className="input mt-3"
              value={version?.id ?? ''}
              onChange={(e) => setVersion(constitution.find((c) => c.id === e.target.value) ?? null)}
            >
              {constitution.map((c) => (
                <option key={c.id} value={c.id}>v{c.version_number} · {formatDate(c.updated_at)}</option>
              ))}
            </select>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {(version?.content as ConstitutionArticle[] | undefined)?.map((art) => (
              <a
                key={art.article}
                href={`#art-${art.article}`}
                className="block rounded-lg px-3 py-2 text-sm transition hover:bg-ink-50"
              >
                <p className="font-medium text-ink-800">Art. {art.article} — {art.title}</p>
                <p className="text-[11px] text-ink-500">{art.sections.length} sections</p>
              </a>
            ))}
          </div>
        </Card>

        {/* Reader */}
        <Card className="lg:col-span-2">
          <div className="border-b border-ink-200 px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-900">{version?.title ?? 'Constitution'}</h2>
              <span className="badge-info">v{version?.version_number}</span>
            </div>
            <div className="relative mt-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9 text-sm"
                placeholder="Search articles & sections…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
            {matches ? (
              matches.length === 0 ? (
                <EmptyState title="No matches" description={`No results for "${query}"`} />
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-ink-500">{matches.length} matches</p>
                  {matches.map((m, i) => (
                    <div key={i} className="rounded-xl border border-ink-200 p-3">
                      <p className="text-xs font-semibold text-brand-700">Art. {m.article} · {m.section} {m.sectionTitle}</p>
                      <p className="mt-1 text-sm text-ink-700">{m.body}</p>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-6">
                {(version?.content as ConstitutionArticle[] | undefined)?.map((art) => (
                  <div key={art.article} id={`art-${art.article}`} className="scroll-mt-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                        {art.article}
                      </span>
                      <h3 className="text-base font-semibold text-ink-900">{art.title}</h3>
                    </div>
                    <div className="mt-3 space-y-3 pl-9">
                      {art.sections.map((sec) => (
                        <div key={sec.section} className="border-l-2 border-ink-200 pl-3">
                          <p className="text-xs font-semibold text-ink-500">{sec.section} {sec.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-ink-700">{sec.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Change log */}
      <Card>
        <div className="border-b border-ink-200 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <History size={16} className="text-ink-500" /> Change-log history
          </h2>
        </div>
        {amendments.length === 0 ? (
          <EmptyState icon={<FileText size={20} />} title="No amendments recorded" />
        ) : (
          <div className="divide-y divide-ink-100">
            {amendments.map((l) => (
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

      {amendOpen && (
        <AmendModal
          latest={constitution[0] ?? null}
          currentUser={currentUser}
          onClose={() => setAmendOpen(false)}
          onSaved={async () => { await refresh(); setAmendOpen(false); }}
          push={push}
        />
      )}
    </div>
  );
}

function AmendModal({
  latest, currentUser, onClose, onSaved, push,
}: {
  latest: ConstitutionVersion | null;
  currentUser: { id: string; full_name: string } | null;
  onClose: () => void;
  onSaved: () => void;
  push: (t: { kind: 'success' | 'error'; message: string; description?: string }) => void;
}) {
  const [versionNumber, setVersionNumber] = useState('');
  const [changelog, setChangelog] = useState('');
  const [content, setContent] = useState<string>(JSON.stringify(latest?.content ?? [], null, 2));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!versionNumber.trim()) { push({ kind: 'error', message: 'Version number required' }); return; }
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { push({ kind: 'error', message: 'Invalid JSON content' }); return; }
    setSaving(true);
    try {
      const payload: Partial<ConstitutionVersion> = {
        version_number: versionNumber,
        title: latest?.title ?? 'ElevateUS Constitution',
        content: parsed as ConstitutionArticle[],
        changelog: changelog || null,
        updated_by: currentUser?.id ?? null,
      };
      const { error } = await supabase.from('constitution_versions').insert(payload);
      if (error) throw error;
      await logAudit({
        user: currentUser,
        action: 'CREATE',
        target_table: 'constitution_versions',
        summary: `Published constitution amendment v${versionNumber}`,
        new_value: payload,
      });
      push({ kind: 'success', message: 'Amendment published' });
      onSaved();
    } catch (err) {
      push({ kind: 'error', message: 'Publish failed', description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New constitution amendment"
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Publishing…' : 'Publish'}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Version number</label>
            <input className="input" value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)} placeholder="1.2" />
          </div>
          <div>
            <label className="label">Changelog summary</label>
            <input className="input" value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="What changed…" />
          </div>
        </div>
        <div>
          <label className="label">Content (JSON)</label>
          <textarea className="input min-h-[240px] font-mono text-xs" value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
