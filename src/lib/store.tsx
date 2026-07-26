import {
  createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode,
} from 'react';
import { supabase } from './supabase';
import type {
  Profile, Role, Subscription, MembershipFee, Loan, InterestRecord,
  Fine, Expense, EventItem, EventAttendee, EmailLog, ConstitutionVersion,
  AuditLog, OrganizationSettings, FinancialSnapshot, Minute,
} from '../types';

interface AppContextValue {
  currentUser: Profile | null;
  setCurrentUser: (p: Profile | null) => void;
  session: { user: { id: string; email?: string } } | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  authReady: boolean;
  roles: Role[];
  profiles: Profile[];
  subscriptions: Subscription[];
  membershipFees: MembershipFee[];
  loans: Loan[];
  interestRecords: InterestRecord[];
  fines: Fine[];
  expenses: Expense[];
  events: EventItem[];
  eventAttendees: EventAttendee[];
  emailLogs: EmailLog[];
  constitution: ConstitutionVersion[];
  auditLogs: AuditLog[];
  minutes: Minute[];
  settings: OrganizationSettings;
  snapshot: FinancialSnapshot | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [session, setSession] = useState<{ user: { id: string; email?: string } } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [membershipFees, setMembershipFees] = useState<MembershipFee[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [interestRecords, setInterestRecords] = useState<InterestRecord[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventAttendees, setEventAttendees] = useState<EventAttendee[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [constitution, setConstitution] = useState<ConstitutionVersion[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [minutes, setMinutes] = useState<Minute[]>([]);
  const [settings, setSettings] = useState<OrganizationSettings>({});
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [
        rolesR, profilesR, subsR, feesR, loansR, interestR, finesR, expensesR,
        eventsR, attendeesR, emailR, constitutionR, auditR, settingsR, minutesR,
      ] = await Promise.all([
        supabase.from('roles').select('*').order('id'),
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('subscriptions').select('*').order('billing_month', { ascending: false }),
        supabase.from('membership_fees').select('*').order('payment_date', { ascending: false }),
        supabase.from('loans').select('*').order('created_at', { ascending: false }),
        supabase.from('interest_records').select('*').order('date_earned', { ascending: false }),
        supabase.from('fines').select('*').order('date_issued', { ascending: false }),
        supabase.from('expenses').select('*').order('date_spent', { ascending: false }),
        supabase.from('events').select('*').order('event_date'),
        supabase.from('event_attendees').select('*'),
        supabase.from('email_logs').select('*').order('sent_at', { ascending: false }),
        supabase.from('constitution_versions').select('*').order('updated_at', { ascending: false }),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('organization_settings').select('*'),
        supabase.from('minutes').select('*').order('meeting_date', { ascending: false }),
      ]);

      const rolesList = (rolesR.data as Role[]) ?? [];
      setRoles(rolesList);
      const roleMap = new Map(rolesList.map((r) => [r.id, r]));
      const profilesList = ((profilesR.data as Profile[]) ?? []).map((p) => ({
        ...p,
        role: p.role_id != null ? roleMap.get(p.role_id) ?? null : null,
      }));
      setProfiles(profilesList);
      setSubscriptions((subsR.data as Subscription[]) ?? []);
      setMembershipFees((feesR.data as MembershipFee[]) ?? []);
      setLoans((loansR.data as Loan[]) ?? []);
      setInterestRecords((interestR.data as InterestRecord[]) ?? []);
      setFines((finesR.data as Fine[]) ?? []);
      setExpenses((expensesR.data as Expense[]) ?? []);
      setEvents((eventsR.data as EventItem[]) ?? []);
      setEventAttendees((attendeesR.data as EventAttendee[]) ?? []);
      setEmailLogs((emailR.data as EmailLog[]) ?? []);
      setConstitution((constitutionR.data as ConstitutionVersion[]) ?? []);
      setAuditLogs((auditR.data as AuditLog[]) ?? []);
      setMinutes((minutesR.data as Minute[]) ?? []);

      const settingsObj: OrganizationSettings = {};
      for (const row of (settingsR.data as { key: string; value: unknown }[]) ?? []) {
        settingsObj[row.key] = row.value;
      }
      setSettings(settingsObj);
      setSnapshot((settingsObj.financial_snapshot as FinancialSnapshot) ?? null);

      // Reconcile current user with refreshed profiles (so role updates reflect)
      if (currentUser) {
        const updated = profilesList.find((p) => p.id === currentUser.id);
        if (updated && JSON.stringify(updated) !== JSON.stringify(currentUser)) {
          setCurrentUser(updated);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Auth: restore session + listen for changes
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session as { user: { id: string; email?: string } } | null);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess as { user: { id: string; email?: string } } | null);
        if (!sess) {
          setCurrentUser(null);
        }
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load data once auth is ready
  useEffect(() => {
    if (authReady) refresh();
  }, [authReady, refresh]);

  // Resolve current user profile from session
  useEffect(() => {
    if (session?.user?.id && profiles.length > 0 && !currentUser) {
      const profile = profiles.find((p) => p.user_id === session.user.id);
      if (profile) setCurrentUser(profile);
    }
    if (!session && currentUser) setCurrentUser(null);
  }, [session, profiles, currentUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSession(null);
  }, []);

  const value: AppContextValue = {
    currentUser, setCurrentUser, session, signIn, signOut, authReady,
    roles, profiles, subscriptions, membershipFees, loans, interestRecords,
    fines, expenses, events, eventAttendees, emailLogs, constitution, auditLogs,
    minutes, settings, snapshot, loading, refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

/** Returns only non-system (non-admin) profiles — use for member dropdowns in transactions. */
export function useMembers(): Profile[] {
  const { profiles } = useApp();
  return useMemo(() => profiles.filter((p) => !p.is_system), [profiles]);
}
