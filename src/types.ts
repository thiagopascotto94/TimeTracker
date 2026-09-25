export interface Tenant {
  id: string;
  name: string;
  plan_id?: string;
  default_target_minutes?: number | null;
  default_client_daily_target_minutes?: number | null;
  monthly_billing_goal?: number | null;
  max_retroactive_minutes?: number | null;
  git_provider?: 'github' | 'gitlab' | null;
  github_repo?: string | null;
  github_token?: string | null;
  gitlab_url?: string | null;
  gitlab_project?: string | null;
  gitlab_token?: string | null;
  allowed_repositories?: string | null;
  timezone?: string;
  created_at?: string;
}

export interface ClientContact {
  id: string;
  tenant_id?: string;
  client_id: string;
  name: string;
  email: string;
  role?: string | null;
  phone?: string | null;
  must_change_password: boolean;
  last_login_at?: string | null;
  created_at?: string;
}

export interface Client {
  id: string;
  tenant_id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  hourly_rate?: number | null;
  daily_target_minutes?: number | null;
  notes?: string | null;
  git_provider?: 'github' | 'gitlab' | null;
  github_repo?: string | null;
  github_token?: string | null;
  gitlab_url?: string | null;
  gitlab_project?: string | null;
  gitlab_token?: string | null;
  allowed_repositories?: string | null;
  contacts?: ClientContact[];
  Contacts?: ClientContact[];
  created_at?: string;
}

export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role?: string;
  can_view_billing?: boolean;
  default_hourly_rate: number;
  timezone?: string;
}

export interface WorkspaceInvite {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  can_view_billing?: boolean;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'canceled';
  expires_at: string;
  created_at: string;
  Inviter?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: string;
  can_view_billing?: boolean;
  default_hourly_rate: number;
  weekly_target_hours?: number | null;
  created_at: string;
}

export interface WorkspaceItem {
  id: string;
  name: string;
  description?: string | null;
  role: string;
  can_view_billing?: boolean;
  members_count: number;
  is_active: boolean;
  order_index?: number;
  timezone?: string;
  max_retroactive_minutes?: number | null;
  is_locked?: boolean;
  lock_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TaskItem {
  id: string;
  tenant_id: string;
  time_session_id: string;
  description: string;
  notes?: string | null;
  link?: string | null;
  created_at?: string;
}

export interface PreviousSessionInfo {
  id: string;
  title: string;
  start_time: string;
  end_time?: string | null;
}

export interface TimeSession {
  id: string;
  tenant_id: string;
  user_id: string;
  client_id?: string | null;
  title: string;
  notes?: string | null;
  start_time: string;
  end_time?: string | null;
  target_minutes?: number | null;
  previous_session_id?: string | null;
  public_token?: string | null;
  hourly_rate?: number | null;
  is_retroactive?: boolean;
  retroactive_reason?: string | null;
  retroactive_minutes?: number | null;
  is_locked?: boolean;
  locked_at?: string | null;
  locked_reason?: string | null;
  Client?: Client | null;
  client?: Client | null;
  Tasks?: TaskItem[];
  tasks?: TaskItem[];
  PreviousSession?: PreviousSessionInfo | null;
  previous_session?: PreviousSessionInfo | null;
  metrics?: {
    durationMs: number;
    durationMinutes: number;
    decimalHours: number;
    hourlyRate?: number;
    appliedHourlyRate?: number;
    billableAmount: number;
    isActive: boolean;
  };
}

export interface ReportSummary {
  can_view_billing?: boolean;
  totalDurationMs: number;
  totalMinutes: number;
  totalDecimalHours: number;
  hourlyRate: number;
  defaultHourlyRate?: number;
  hasMultipleRates?: boolean;
  totalBillableAmount: number;
  totalSessionsCount: number;
  totalTasksCount: number;
  currency: string;
  selectedClient?: {
    id: string;
    name: string;
    hourlyRate?: number;
    hourly_rate?: number;
  } | null;
}

export interface DayGroup {
  date: string;
  decimalHours: number;
  billableAmount: number;
  sessionsCount: number;
}

export interface ReportData {
  summary: ReportSummary;
  groupedByDay: DayGroup[];
  sessions: TimeSession[];
}

export interface MonthlyBillingGoalData {
  monthlyGoal: number;
  currentMonthBilling: number;
  currentMonthHours: number;
  monthKey: string;
  monthLabel: string;
  daysInMonth: number;
  currentDay: number;
  daysRemaining: number;
  dailyAverage: number;
  dailyNeeded: number;
  percentage: number;
  remaining: number;
  isCompleted: boolean;
  sessionsCount: number;
}

export interface ManagedSharedReport {
  id: string;
  tenant_id: string;
  token: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  session_id?: string | null;
  client_id?: string | null;
  hourly_rate: number;
  include_cost: boolean;
  allow_approval: boolean;
  approval_code?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  approved_at?: string | null;
  approval_ip?: string | null;
  created_at: string;
  updated_at: string;
  Client?: {
    id: string;
    name: string;
    hourly_rate?: number | null;
  } | null;
  Session?: {
    id: string;
    title: string;
    is_locked?: boolean;
    locked_reason?: string | null;
    locked_at?: string | null;
  } | null;
}

export interface PublicSharedReport {
  title: string;
  workspace: string;
  generated_at: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  approved_at?: string | null;
  approval_ip?: string | null;
  include_cost: boolean;
  allow_approval: boolean;
  summary: ReportSummary;
  sessions: {
    id: string;
    title: string;
    notes?: string | null;
    start_time: string;
    end_time?: string | null;
    target_minutes?: number | null;
    client?: {
      id: string;
      name: string;
      hourly_rate?: number | null;
    } | null;
    tasks: {
      id: string;
      description: string;
      notes?: string | null;
      link?: string | null;
      created_at?: string;
    }[];
    metrics: {
      durationMs: number;
      durationMinutes: number;
      decimalHours: number;
      hourlyRate?: number;
      appliedHourlyRate?: number;
      billableAmount: number;
      isActive: boolean;
    };
  }[];
}

export interface AiStep {
  step: number;
  tool: string;
  args: any;
  result: any;
  timestamp?: string;
}

export interface AiImageAttachment {
  name: string;
  mimeType: string;
  data: string; // base64
  preview?: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  images?: AiImageAttachment[];
  steps?: AiStep[];
  provider?: string;
  model?: string;
  created_at?: string;
  isPending?: boolean;
}

export interface WorkspaceAiDailyUsageInfo {
  workspace_id: string;
  workspace_name?: string;
  tenant_id: string;
  date: string;
  current: number;
  max: number;
  remaining: number;
  plan_id: string;
  plan_name: string;
  is_limit_reached: boolean;
}

export interface GitCommitItem {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorAvatar?: string | null;
  date: string;
  url?: string;
  selected?: boolean;
}

export interface SuggestedTaskItem {
  id: string;
  description: string;
  notes: string;
  link?: string | null;
  selected: boolean;
}

export interface GitRepositoryItem {
  id: string;
  provider: 'github' | 'gitlab';
  fullName: string;
  name: string;
  owner?: string;
  projectId?: string;
  isPrivate?: boolean;
  description?: string | null;
  defaultBranch?: string;
  url?: string;
  gitlabUrl?: string;
  updatedAt?: string;
  selected?: boolean;
}

export interface Plan {
  id: string; // 'free' | 'pro' | 'team'
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_workspaces?: number;
  max_users: number;
  max_clients: number;
  max_sessions_per_month?: number;
  features: string[];
  is_active: boolean;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string; // 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  cancel_at?: string | null;
  canceled_at?: string | null;
  gateway: string;
  gateway_subscription_id?: string | null;
  gateway_customer_id?: string | null;
  payment_method_brand?: string | null;
  payment_method_last4?: string | null;
  payment_method_exp_month?: number | null;
  payment_method_exp_year?: number | null;
}

export interface InvoiceItem {
  id: string;
  tenant_id: string;
  subscription_id?: string | null;
  gateway_invoice_id?: string | null;
  amount: number;
  currency: string;
  status: string; // 'paid' | 'pending' | 'failed' | 'void'
  billing_reason?: string | null;
  invoice_pdf?: string | null;
  hosted_invoice_url?: string | null;
  paid_at?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  created_at?: string;
}

export interface PlanLimitInfo {
  current: number;
  max: number;
  percentage: number;
  unlimited: boolean;
}

export interface BillingStatus {
  plan: Plan;
  subscription: Subscription | null;
  usage: {
    workspaces?: PlanLimitInfo;
    users: PlanLimitInfo;
    clients: PlanLimitInfo;
    sessions_monthly?: PlanLimitInfo;
  };
  team_billing?: {
    price_per_user_monthly: number;
    price_per_user_yearly: number;
    active_users: number;
    pending_invites: number;
    total_seats: number;
    total_monthly: number;
    total_yearly: number;
  };
  can_export_workspace?: boolean;
  can_create_client: boolean;
  can_create_user: boolean;
  can_create_session?: boolean;
  is_stripe_configured: boolean;
  available_plans: Plan[];
}

export interface LinkedClientSession {
  id: string;
  title?: string;
  start_time: string;
  end_time?: string | null;
  duration_seconds: number;
  duration_formatted: string;
}

export interface LinkedClientItem {
  id: string;
  matched_as: 'client' | 'contact';
  contact?: {
    id: string;
    name: string;
    email: string;
    role?: string | null;
    phone?: string | null;
  } | null;
  client: {
    id: string;
    name: string;
    company?: string | null;
    email?: string | null;
    notes?: string | null;
    created_at?: string;
  };
  workspace: {
    id: string;
    name: string;
    description?: string | null;
  };
  tenant: {
    id: string;
    name: string;
  };
  owner: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar_url?: string | null;
  };
  stats: {
    total_sessions: number;
    total_seconds: number;
    total_hours_formatted: string;
    recent_sessions: LinkedClientSession[];
  };
}

export interface LinkedClientsResponse {
  user_email: string;
  linked_clients_count: number;
  linked_clients: LinkedClientItem[];
}

export interface NoteItem {
  id: string;
  tenant_id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  content: string;
  is_workspace_shared: boolean;
  is_pinned?: boolean;
  created_at?: string;
  updated_at?: string;
  Author?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string | null;
  };
}

export interface WorkspaceMemberGoal {
  userId: string;
  name: string;
  email: string;
  role: string;
  weekly_target_hours: number | null;
  logged_hours_week: number;
  projected_hours_week: number;
  week_progress_percent: number;
  week_status: 'met' | 'on_track' | 'behind' | 'no_goal';
}

export interface TeamGoalsSummary {
  total_members_with_goals: number;
  members_met_goal: number;
  team_overall_completion_rate: number;
  total_logged_hours: number;
  total_target_hours: number;
  projected_team_hours: number;
  members: WorkspaceMemberGoal[];
}
