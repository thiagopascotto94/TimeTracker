export interface Tenant {
  id: string;
  name: string;
  created_at?: string;
}

export interface Client {
  id: string;
  tenant_id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  hourly_rate?: number | null;
  notes?: string | null;
  created_at?: string;
}

export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  default_hourly_rate: number;
}

export interface TaskItem {
  id: string;
  tenant_id: string;
  time_session_id: string;
  description: string;
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
  start_time: string;
  end_time?: string | null;
  target_minutes?: number | null;
  previous_session_id?: string | null;
  public_token?: string | null;
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
    billableAmount: number;
    isActive: boolean;
  };
}

export interface ReportSummary {
  totalDurationMs: number;
  totalMinutes: number;
  totalDecimalHours: number;
  hourlyRate: number;
  totalBillableAmount: number;
  totalSessionsCount: number;
  totalTasksCount: number;
  currency: string;
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

export interface PublicSharedReport {
  title: string;
  workspace: string;
  generated_at: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  approved_at?: string | null;
  approval_ip?: string | null;
  summary: ReportSummary;
  sessions: {
    id: string;
    title: string;
    start_time: string;
    end_time?: string | null;
    target_minutes?: number | null;
    tasks: {
      id: string;
      description: string;
      created_at?: string;
    }[];
    metrics: {
      durationMs: number;
      durationMinutes: number;
      decimalHours: number;
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

