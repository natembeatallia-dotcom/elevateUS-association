import {
  LayoutDashboard, Users, CreditCard, UserCheck, Wallet, TrendingUp,
  AlertCircle, Receipt, Calendar, Crown, Mail, FileText, BarChart3, Settings,
  ClipboardList, type LucideIcon,
} from 'lucide-react';
import type { Permission } from '../lib/rbac';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  module: keyof Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { id: 'members', label: 'Members', icon: Users, module: 'members' },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard, module: 'subscriptions' },
  { id: 'fees', label: 'Membership Fees', icon: UserCheck, module: 'membershipFees' },
  { id: 'loans', label: 'Loans', icon: Wallet, module: 'loans' },
  { id: 'interest', label: 'Interest Ledger', icon: TrendingUp, module: 'interest' },
  { id: 'fines', label: 'Fines & Penalties', icon: AlertCircle, module: 'fines' },
  { id: 'expenses', label: 'Expense Tracker', icon: Receipt, module: 'expenses' },
  { id: 'minutes', label: 'Meeting Minutes', icon: ClipboardList, module: 'minutes' },
  { id: 'events', label: 'Event Management', icon: Calendar, module: 'events' },
  { id: 'leadership', label: 'Leadership Portal', icon: Crown, module: 'leadership' },
  { id: 'comms', label: 'Email & Comms Center', icon: Mail, module: 'comms' },
  { id: 'constitution', label: 'Constitution Reader', icon: FileText, module: 'constitution' },
  { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3, module: 'analytics' },
  { id: 'settings', label: 'Global Settings', icon: Settings, module: 'settings' },
];
