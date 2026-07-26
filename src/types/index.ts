export type RoleName =
  | 'Admin'
  | 'Chairperson'
  | 'Secretary'
  | 'Treasurer'
  | 'Organizing Secretary'
  | 'Member';

export type MemberStatus = 'Active' | 'High Risk' | 'Suspended' | 'Inactive';

export interface Role {
  id: number;
  role_name: RoleName;
  permission_matrix: Record<string, boolean>;
}

export interface Profile {
  id: string;
  user_id: string | null;
  full_name: string;
  role_id: number | null;
  phone_number: string | null;
  email: string | null;
  join_date: string;
  credit_score: number;
  status: MemberStatus;
  avatar_url: string | null;
  notes: string | null;
  is_system: boolean;
  leadership_position: string | null;
  created_at?: string;
  updated_at?: string;
  role?: Role | null;
}

export type SubscriptionStatus = 'Paid' | 'Partial' | 'Unpaid';

export interface Subscription {
  id: string;
  member_id: string;
  billing_month: string;
  expected_amount: number;
  amount_paid: number;
  payment_date: string | null;
  status: SubscriptionStatus;
  recorded_by: string | null;
  reference_number: string | null;
  notes: string | null;
  member?: Profile | null;
}

export interface MembershipFee {
  id: string;
  member_id: string;
  fee_type: string;
  amount: number;
  payment_date: string | null;
  valid_until: string | null;
  status: string;
  reference_number: string | null;
  recorded_by: string | null;
  notes: string | null;
  member?: Profile | null;
}

export type LoanStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'
  | 'Disbursed'
  | 'Active'
  | 'Paid'
  | 'Overdue'
  | 'Defaulted'
  | 'Carried Forward';

export interface Loan {
  id: string;
  member_id: string;
  principal: number;
  interest_rate: number;
  interest_amount: number;
  transaction_cost: number;
  total_repayable: number;
  amount_paid: number;
  current_balance: number;
  principal_balance: number;
  accrued_interest: number;
  carry_forward_from: string | null;
  carried_forward_at: string | null;
  due_date: string | null;
  status: LoanStatus;
  credit_snapshot: string | null;
  purpose: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  disbursed_at: string | null;
  created_at?: string;
  updated_at?: string;
  member?: Profile | null;
}

export interface LoanPayment {
  id: string;
  loan_id: string;
  amount_paid: number;
  principal_paid: number;
  interest_paid: number;
  is_carry_forward: boolean;
  payment_date: string;
  recorded_by: string | null;
  notes: string | null;
}

export interface InterestRecord {
  id: string;
  loan_id: string | null;
  member_id: string;
  principal_basis: number;
  interest_earned: number;
  date_earned: string;
  status: string;
  notes: string | null;
  member?: Profile | null;
}

export interface Fine {
  id: string;
  member_id: string;
  fine_type: string;
  amount: number;
  date_issued: string;
  status: string;
  notes: string | null;
  issued_by: string | null;
  waived_by: string | null;
  member?: Profile | null;
}

export interface Expense {
  id: string;
  amount: number;
  date_spent: string;
  category: string;
  description: string | null;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  event_date: string;
  location: string | null;
  rsvp_count: number;
  created_by: string | null;
}

export interface EventAttendee {
  id: string;
  event_id: string;
  member_id: string;
  attendance_status: string;
  notes: string | null;
  member?: Profile | null;
}

export interface EmailLog {
  id: string;
  recipient_group: string;
  subject: string | null;
  body: string | null;
  template_used: string | null;
  sent_at: string;
  status: string;
  sent_by: string | null;
  recipient_count: number;
}

export interface ConstitutionVersion {
  id: string;
  version_number: string;
  title: string;
  content: ConstitutionArticle[];
  changelog: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface ConstitutionArticle {
  article: number;
  title: string;
  sections: { section: string; title: string; body: string }[];
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  old_value: unknown;
  new_value: unknown;
  summary: string | null;
  created_at: string;
}

export interface OrganizationSettings {
  [key: string]: unknown;
}

export interface FinancialSnapshot {
  total_assets: number;
  cash_at_hand: number;
  fixed_reserve: number;
  loanable_pool: number;
  as_of: string;
}

export interface Minute {
  id: string;
  meeting_date: string;
  title: string;
  body: string;
  attendees: string | null;
  status: string;
  recorded_by: string | null;
  created_at?: string;
  updated_at?: string;
}
