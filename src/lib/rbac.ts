import type { RoleName } from '../types';

export interface Permission {
  dashboard: 'full' | 'view' | 'own' | 'none';
  members: 'full' | 'view' | 'none';
  subscriptions: 'full' | 'view' | 'own' | 'none';
  membershipFees: 'full' | 'view' | 'own' | 'none';
  loans: 'full' | 'view' | 'own' | 'none';
  interest: 'full' | 'view' | 'none';
  fines: 'full' | 'view' | 'own' | 'none';
  expenses: 'full' | 'view' | 'none';
  events: 'full' | 'view' | 'none';
  leadership: 'full' | 'view' | 'none';
  comms: 'full' | 'view' | 'none';
  constitution: 'full' | 'view' | 'none';
  analytics: 'full' | 'view' | 'none';
  settings: 'full' | 'view' | 'none';
  audit: 'full' | 'view' | 'none';
  minutes: 'full' | 'view' | 'none';
}

const FULL: Permission = {
  dashboard: 'full', members: 'full', subscriptions: 'full', membershipFees: 'full',
  loans: 'full', interest: 'full', fines: 'full', expenses: 'full', events: 'full',
  leadership: 'full', comms: 'full', constitution: 'full', analytics: 'full',
  settings: 'full', audit: 'full', minutes: 'full',
};

// Members can VIEW the whole system; editing/creating transactions is restricted.
const MEMBER_VIEW_ALL: Permission = {
  dashboard: 'view',
  members: 'view',
  subscriptions: 'view',
  membershipFees: 'view',
  loans: 'view',
  interest: 'view',
  fines: 'view',
  expenses: 'view',
  events: 'view',
  leadership: 'view',
  comms: 'view',
  constitution: 'view',
  analytics: 'view',
  settings: 'view',
  audit: 'view',
  minutes: 'view',
};

export const PERMISSIONS: Record<RoleName, Permission> = {
  Admin: FULL,
  Chairperson: {
    ...MEMBER_VIEW_ALL,
    leadership: 'full',
    settings: 'full',
    constitution: 'full',
  },
  Secretary: {
    ...MEMBER_VIEW_ALL,
    members: 'full',
    minutes: 'full',
    comms: 'full',
    constitution: 'full',
  },
  Treasurer: {
    ...MEMBER_VIEW_ALL,
    subscriptions: 'full',
    membershipFees: 'full',
    loans: 'full',
    interest: 'full',
    fines: 'full',
    expenses: 'full',
  },
  'Organizing Secretary': {
    ...MEMBER_VIEW_ALL,
    events: 'full',
    comms: 'full',
  },
  Member: MEMBER_VIEW_ALL,
};

export function can(
  perms: Permission,
  module: keyof Permission,
  level: 'full' | 'view' | 'own' = 'view'
): boolean {
  const v = perms[module];
  if (v === 'none') return false;
  if (level === 'full') return v === 'full';
  if (level === 'view') return v === 'full' || v === 'view';
  return v === 'full' || v === 'view' || v === 'own';
}

export function canManage(perms: Permission, module: keyof Permission): boolean {
  return perms[module] === 'full';
}
