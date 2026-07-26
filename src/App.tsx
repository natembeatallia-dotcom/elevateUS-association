import { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AppProvider, useApp } from './lib/store';
import { ToastProvider } from './lib/toast';
import { AppShell } from './components/AppShell';
import { NAV_ITEMS } from './components/nav';
import { PERMISSIONS, can, type Permission } from './lib/rbac';
import { EmptyState } from './components/ui';
import type { RoleName } from './types';

import { Login } from './modules/Login';
import { Dashboard } from './modules/Dashboard';
import { Members } from './modules/Members';
import { Subscriptions, MembershipFees } from './modules/Subscriptions';
import { Loans } from './modules/Loans';
import { InterestLedger } from './modules/InterestLedger';
import { Fines } from './modules/Fines';
import { Expenses } from './modules/Expenses';
import { Events } from './modules/Events';
import { Leadership } from './modules/Leadership';
import { Comms } from './modules/Comms';
import { Constitution } from './modules/Constitution';
import { Analytics } from './modules/Analytics';
import { Settings } from './modules/Settings';
import { Minutes } from './modules/Minutes';

function Router() {
  const { currentUser, loading, authReady, session } = useApp();
  const [active, setActive] = useState('dashboard');

  useEffect(() => {
    const handler = () => {};
    window.addEventListener('global-search', handler);
    return () => window.removeEventListener('global-search', handler);
  }, []);

  const role = (currentUser?.role?.role_name ?? 'Member') as RoleName;
  const perms: Permission = PERMISSIONS[role];

  useEffect(() => {
    const item = NAV_ITEMS.find((n) => n.id === active);
    if (item && perms[item.module] === 'none') {
      setActive('dashboard');
    }
  }, [perms, active]);

  // Not signed in → login screen
  if (authReady && !session) {
    return <Login />;
  }

  if (!authReady || (loading && !currentUser)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
          <p className="text-sm text-ink-500">Loading ElevateUS…</p>
        </div>
      </div>
    );
  }

  const renderModule = () => {
    const item = NAV_ITEMS.find((n) => n.id === active);
    if (item && !can(perms, item.module)) {
      return (
        <EmptyState
          icon={<ShieldAlert size={22} />}
          title="Access restricted"
          description={`Your role (${role}) does not have access to this module.`}
        />
      );
    }
    switch (active) {
      case 'dashboard': return <Dashboard onNavigate={setActive} />;
      case 'members': return <Members />;
      case 'subscriptions': return <Subscriptions />;
      case 'fees': return <MembershipFees />;
      case 'loans': return <Loans />;
      case 'interest': return <InterestLedger />;
      case 'fines': return <Fines />;
      case 'expenses': return <Expenses />;
      case 'minutes': return <Minutes />;
      case 'events': return <Events />;
      case 'leadership': return <Leadership />;
      case 'comms': return <Comms />;
      case 'constitution': return <Constitution />;
      case 'analytics': return <Analytics />;
      case 'settings': return <Settings />;
      default: return <Dashboard onNavigate={setActive} />;
    }
  };

  return (
    <AppShell active={active} onNavigate={setActive}>
      {renderModule()}
    </AppShell>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <Router />
      </AppProvider>
    </ToastProvider>
  );
}
