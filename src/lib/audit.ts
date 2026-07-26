import { supabase } from './supabase';
import type { Profile } from '../types';

export async function logAudit(entry: {
  user: Profile | null;
  action: string;
  target_table?: string;
  target_id?: string;
  summary: string;
  old_value?: unknown;
  new_value?: unknown;
}): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      user_id: entry.user?.id ?? null,
      user_name: entry.user?.full_name ?? 'System',
      action: entry.action,
      target_table: entry.target_table ?? null,
      target_id: entry.target_id ?? null,
      summary: entry.summary,
      old_value: entry.old_value ?? null,
      new_value: entry.new_value ?? null,
    });
  } catch (err) {
    console.warn('Audit log failed:', err);
  }
}
