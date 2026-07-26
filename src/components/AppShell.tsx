import { useState, useMemo, type ReactNode } from 'react';
import { Menu, X, Bell, ChevronDown, Search, Crown, LogOut, User } from 'lucide-react';
import { NAV_ITEMS } from './nav';
import { useApp } from '../lib/store';
import { PERMISSIONS, can } from '../lib/rbac';
import { Avatar } from './ui';
import type { RoleName } from '../types';

export function AppShell({
  active, onNavigate, children,
}: {
  active: string;
  onNavigate: (id: string) => void;
  children: ReactNode;
}) {
  const { currentUser, signOut } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const perms = currentUser
    ? PERMISSIONS[(currentUser.role?.role_name ?? 'Member') as RoleName]
    : PERMISSIONS['Member'];

  const visibleItems = useMemo(
    () => NAV_ITEMS.filter((n) => perms[n.module] !== 'none'),
    [perms]
  );

  const notifs = useMemo(() => buildNotifications(), []);

  const activeItem = NAV_ITEMS.find((n) => n.id === active);

  const SidebarContent = (
    <div className="flex h-full flex-col text-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}>
          <Crown size={18} />
        </div>
        <div>
          <p className="text-base font-bold tracking-tight text-white">ElevateUS</p>
          <p className="text-[11px] font-medium text-slate-400">Association Management</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setDrawerOpen(false);
              }}
              className={`nav-item w-full text-left ${isActive ? 'nav-item-active' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
            >
              <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
              <span>{item.label}</span>
              {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <div className="rounded-xl bg-white/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Signed in as</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-white">
            {currentUser?.full_name ?? '—'}
          </p>
          <p className="text-xs text-slate-400">{currentUser?.role?.role_name ?? 'Member'}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block" style={{ background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)' }}>
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-md animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] animate-slide-in shadow-pop" style={{ background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)' }}>
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/10"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/80 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-2 text-ink-600 transition hover:bg-ink-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>

            <div className="flex items-center gap-2.5 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Crown size={16} />
              </div>
              <span className="text-sm font-bold text-ink-900">ElevateUS</span>
            </div>

            <div className="ml-auto hidden items-center gap-2 sm:flex">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  className="input w-64 pl-9"
                  placeholder="Search members, loans…"
                  onChange={(e) => {
                    const ev = new CustomEvent('global-search', { detail: e.target.value });
                    window.dispatchEvent(ev);
                  }}
                />
              </div>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative rounded-lg p-2 text-ink-600 transition hover:bg-ink-100"
                aria-label="Notifications"
              >
                <Bell size={20} />
                {notifs.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-danger-500" />
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-2 w-80 animate-scale-in rounded-xl border border-ink-200 bg-white shadow-pop">
                    <div className="border-b border-ink-200 px-4 py-3">
                      <p className="text-sm font-semibold text-ink-900">Notifications</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifs.length === 0 ? (
                        <p className="px-4 py-6 text-center text-xs text-ink-500">No new notifications</p>
                      ) : (
                        notifs.map((n, i) => (
                          <div key={i} className="border-b border-ink-100 px-4 py-3 last:border-0">
                            <div className="flex items-start gap-2">
                              <span className={`mt-1 h-2 w-2 flex-none rounded-full ${n.color}`} />
                              <div>
                                <p className="text-sm font-medium text-ink-800">{n.title}</p>
                                <p className="text-xs text-ink-500">{n.detail}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-2 py-1.5 transition hover:bg-ink-50"
              >
                <Avatar name={currentUser?.full_name ?? 'Guest'} size={28} />
                <span className="hidden text-sm font-semibold text-ink-800 sm:block">
                  {currentUser?.full_name ?? 'Guest'}
                </span>
                <ChevronDown size={16} className="text-ink-400" />
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-2 w-64 animate-scale-in overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop">
                    <div className="border-b border-ink-200 px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={currentUser?.full_name ?? 'Guest'} size={36} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-900">{currentUser?.full_name ?? 'Guest'}</p>
                          <p className="text-xs text-ink-500">{currentUser?.role?.role_name ?? 'Member'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="py-1">
                      <div className="px-4 py-2 text-xs text-ink-500">
                        <p className="flex items-center gap-1.5"><User size={12} /> {currentUser?.email ?? '—'}</p>
                      </div>
                      <button
                        onClick={() => { setUserMenuOpen(false); signOut(); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-danger-600 transition hover:bg-danger-50"
                      >
                        <LogOut size={16} /> Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {activeItem && (
            <div className="mb-5 flex items-center gap-2 text-xs text-ink-400">
              <activeItem.icon size={14} />
              <span>{activeItem.label}</span>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

function buildNotifications(): { title: string; detail: string; color: string }[] {
  return [
    { title: 'Loan overdue', detail: 'Kenneth — KES 601.65 delinquent 30+ days', color: 'bg-danger-500' },
    { title: 'Membership expired', detail: 'Kenneth annual coverage lapsed', color: 'bg-warning-500' },
    { title: 'Partial subscription', detail: 'Kenneth May 2026 — KES 1,200 of 2,400', color: 'bg-warning-500' },
  ];
}
