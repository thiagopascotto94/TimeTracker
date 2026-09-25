import { Sequelize, DataTypes, Model } from 'sequelize';
import type { Dialect } from 'sequelize';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Detect database dialect via DB_DIALECT or DATABASE_URL
const rawDialect = (process.env.DB_DIALECT || '').toLowerCase();
const hasPostgresUrl = Boolean(
  process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://'))
);
export const isPostgres = rawDialect === 'postgres' || rawDialect === 'postgresql' || hasPostgresUrl;
export const DB_TYPE: Dialect = isPostgres ? 'postgres' : 'sqlite';

const storagePath = process.env.DB_PATH || path.resolve(process.cwd(), 'database.sqlite');
if (!isPostgres) {
  const storageDir = path.dirname(storagePath);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
}

// Safe SQLite DATE parser to handle integer timestamps, numbers, Date objects, and non-standard strings
// Prevents "TypeError: date.includes is not a function" in Sequelize SQLite dialect
function safeSqliteDateParse(date: unknown, options?: { timezone?: string }): Date | null {
  if (date === null || date === undefined) return null;
  if (typeof date === 'number') {
    return new Date(date);
  }
  if (typeof date === 'string') {
    if (!date.includes('+') && !date.includes('Z')) {
      return new Date(date + (options && options.timezone ? options.timezone : '+00:00'));
    }
    return new Date(date);
  }
  if (date instanceof Date) {
    return date;
  }
  return new Date(String(date));
}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sqliteDataTypes = require('sequelize/lib/dialects/sqlite/data-types')(DataTypes);
  if (sqliteDataTypes && sqliteDataTypes.DATE) {
    sqliteDataTypes.DATE.parse = safeSqliteDateParse;
  }
  if ((DataTypes as any).sqlite?.DATE) {
    (DataTypes as any).sqlite.DATE.parse = safeSqliteDateParse;
  }
  (DataTypes.DATE as any).parse = safeSqliteDateParse;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const parserStore = require('sequelize/lib/dialects/parserStore')('sqlite');
  if (parserStore && sqliteDataTypes?.DATE) {
    parserStore.refresh(sqliteDataTypes.DATE);
  }
} catch (e) {
  // Safe fallback if not applicable
}

export const sequelize =
  isPostgres && process.env.DATABASE_URL
    ? new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
        dialectOptions:
          process.env.DATABASE_SSL === 'true'
            ? {
                ssl: {
                  require: true,
                  rejectUnauthorized: false,
                },
              }
            : {},
      })
    : new Sequelize({
        dialect: 'sqlite',
        storage: storagePath,
        logging: false, // Clean console
      });

if (!isPostgres && (sequelize as any).connectionManager) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sqliteDataTypes = require('sequelize/lib/dialects/sqlite/data-types')(DataTypes);
    if (sqliteDataTypes?.DATE) {
      sqliteDataTypes.DATE.parse = safeSqliteDateParse;
      (sequelize as any).connectionManager.refreshTypeParser(sqliteDataTypes.DATE);
    }
  } catch (e) {
    // ignore
  }
}

// --- MODELS ---

export interface PlanAttributes {
  id: string; // 'free' | 'pro' | 'team'
  name: string;
  description?: string | null;
  price_monthly: number;
  price_yearly: number;
  max_workspaces?: number; // 1 (free), -1 (unlimited)
  max_users: number; // e.g. 1 (free), 5 (pro), 25 (team)
  max_clients: number; // e.g. 3 (free), -1 (pro, team)
  max_sessions_per_month?: number; // 50 (free), -1 (pro, team)
  max_storage_mb: number; // e.g. 500, 10240, 51200
  features?: string | null; // JSON list of features
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}
export class Plan extends Model<PlanAttributes> implements PlanAttributes {
  public id!: string;
  public name!: string;
  public description!: string | null;
  public price_monthly!: number;
  public price_yearly!: number;
  public max_workspaces!: number;
  public max_users!: number;
  public max_clients!: number;
  public max_sessions_per_month!: number;
  public max_storage_mb!: number;
  public features!: string | null;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}
Plan.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price_monthly: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    price_yearly: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    max_workspaces: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    max_users: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    max_clients: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    max_sessions_per_month: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: -1,
    },
    max_storage_mb: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 500,
    },
    features: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'Plan',
    tableName: 'plans',
    underscored: true,
    timestamps: true,
  }
);

export interface SubscriptionAttributes {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string; // 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  cancel_at?: Date | null;
  canceled_at?: Date | null;
  gateway: string; // 'manual' | 'stripe' | 'mercadopago' | 'asaas' | 'none'
  gateway_subscription_id?: string | null;
  gateway_customer_id?: string | null;
  payment_method_brand?: string | null;
  payment_method_last4?: string | null;
  payment_method_exp_month?: number | null;
  payment_method_exp_year?: number | null;
  created_at?: Date;
  updated_at?: Date;
}
export class Subscription extends Model<SubscriptionAttributes> implements SubscriptionAttributes {
  public id!: string;
  public tenant_id!: string;
  public plan_id!: string;
  public status!: string;
  public current_period_start!: Date;
  public current_period_end!: Date;
  public cancel_at_period_end!: boolean;
  public cancel_at!: Date | null;
  public canceled_at!: Date | null;
  public gateway!: string;
  public gateway_subscription_id!: string | null;
  public gateway_customer_id!: string | null;
  public payment_method_brand!: string | null;
  public payment_method_last4!: string | null;
  public payment_method_exp_month!: number | null;
  public payment_method_exp_year!: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly Plan?: Plan;
  public readonly Tenant?: Tenant;
  public readonly Invoices?: Invoice[];
}
Subscription.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    plan_id: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'free',
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active',
    },
    current_period_start: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    current_period_end: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    cancel_at_period_end: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    cancel_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    canceled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    gateway: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'manual',
    },
    gateway_subscription_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gateway_customer_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payment_method_brand: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payment_method_last4: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payment_method_exp_month: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    payment_method_exp_year: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Subscription',
    tableName: 'subscriptions',
    underscored: true,
    timestamps: true,
  }
);

export interface InvoiceAttributes {
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
  paid_at?: Date | null;
  period_start?: Date | null;
  period_end?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}
export class Invoice extends Model<InvoiceAttributes> implements InvoiceAttributes {
  public id!: string;
  public tenant_id!: string;
  public subscription_id!: string | null;
  public gateway_invoice_id!: string | null;
  public amount!: number;
  public currency!: string;
  public status!: string;
  public billing_reason!: string | null;
  public invoice_pdf!: string | null;
  public hosted_invoice_url!: string | null;
  public paid_at!: Date | null;
  public period_start!: Date | null;
  public period_end!: Date | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly Tenant?: Tenant;
  public readonly Subscription?: Subscription;
}
Invoice.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subscription_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gateway_invoice_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'brl',
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'paid',
    },
    billing_reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    invoice_pdf: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hosted_invoice_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    period_start: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    period_end: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Invoice',
    tableName: 'invoices',
    underscored: true,
    timestamps: true,
  }
);

export interface TenantAttributes {
  id: string;
  name: string;
  plan_id?: string;
  default_target_minutes?: number | null;
  default_client_daily_target_minutes?: number | null;
  monthly_billing_goal?: number | null;
  git_provider?: string | null;
  github_token?: string | null;
  github_repo?: string | null;
  gitlab_url?: string | null;
  gitlab_project?: string | null;
  gitlab_token?: string | null;
  allowed_repositories?: string | null;
  timezone?: string | null;
  max_retroactive_minutes?: number | null;
  created_at?: Date;
}
export class Tenant extends Model<TenantAttributes> implements TenantAttributes {
  public id!: string;
  public name!: string;
  public plan_id!: string;
  public default_target_minutes!: number | null;
  public default_client_daily_target_minutes!: number | null;
  public monthly_billing_goal!: number | null;
  public git_provider!: string | null;
  public github_token!: string | null;
  public github_repo!: string | null;
  public gitlab_url!: string | null;
  public gitlab_project!: string | null;
  public gitlab_token!: string | null;
  public allowed_repositories!: string | null;
  public timezone!: string | null;
  public max_retroactive_minutes!: number | null;
  public readonly created_at!: Date;
  public readonly Plan?: Plan;
  public readonly Subscriptions?: Subscription[];
  public readonly CurrentSubscription?: Subscription | null;
  public readonly Invoices?: Invoice[];
}
Tenant.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    plan_id: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'free',
    },
    default_target_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 60,
    },
    default_client_daily_target_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 120,
    },
    monthly_billing_goal: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 10000.0,
    },
    git_provider: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'github',
    },
    github_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    github_repo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gitlab_url: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'https://gitlab.com',
    },
    gitlab_project: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gitlab_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    allowed_repositories: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'America/Sao_Paulo',
    },
    max_retroactive_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 120,
    },
  },
  {
    sequelize,
    modelName: 'Tenant',
    tableName: 'tenants',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  }
);

export interface UserAttributes {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  password_hash: string;
  default_hourly_rate: number;
  role?: string; // 'admin' | 'member'
  can_view_billing?: boolean;
  timezone?: string | null;
}
export class User extends Model<UserAttributes> implements UserAttributes {
  public id!: string;
  public tenant_id!: string;
  public name!: string;
  public email!: string;
  public password_hash!: string;
  public default_hourly_rate!: number;
  public role!: string;
  public can_view_billing!: boolean;
  public timezone!: string | null;
}
User.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    default_hourly_rate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 150.0,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'admin',
    },
    can_view_billing: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'America/Sao_Paulo',
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    timestamps: true,
  }
);

export interface WorkspaceAttributes {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  git_provider?: 'github' | 'gitlab' | null;
  github_repo?: string | null;
  github_token?: string | null;
  gitlab_url?: string | null;
  gitlab_project?: string | null;
  gitlab_token?: string | null;
  allowed_repositories?: string | null;
  default_target_minutes?: number | null;
  default_client_daily_target_minutes?: number | null;
  monthly_billing_goal?: number | null;
  timezone?: string | null;
  max_retroactive_minutes?: number | null;
  created_at?: Date;
  updated_at?: Date;
}
export class Workspace extends Model<WorkspaceAttributes> implements WorkspaceAttributes {
  public id!: string;
  public tenant_id!: string;
  public name!: string;
  public description!: string | null;
  public git_provider!: 'github' | 'gitlab' | null;
  public github_repo!: string | null;
  public github_token!: string | null;
  public gitlab_url!: string | null;
  public gitlab_project!: string | null;
  public gitlab_token!: string | null;
  public allowed_repositories!: string | null;
  public default_target_minutes!: number | null;
  public default_client_daily_target_minutes!: number | null;
  public monthly_billing_goal!: number | null;
  public timezone!: string | null;
  public max_retroactive_minutes!: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly Tenant?: Tenant;
  public readonly Members?: WorkspaceMember[];
}
Workspace.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    git_provider: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'github',
    },
    github_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    github_repo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gitlab_url: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'https://gitlab.com',
    },
    gitlab_project: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gitlab_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    allowed_repositories: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    default_target_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 60,
    },
    default_client_daily_target_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 120,
    },
    monthly_billing_goal: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 10000.0,
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'America/Sao_Paulo',
    },
    max_retroactive_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 120,
    },
  },
  {
    sequelize,
    modelName: 'Workspace',
    tableName: 'workspaces',
    underscored: true,
    timestamps: true,
  }
);

export interface WorkspaceMemberAttributes {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string; // 'owner' | 'admin' | 'member'
  can_view_billing?: boolean;
  weekly_target_hours?: number | null;
  created_at?: Date;
  updated_at?: Date;
}
export class WorkspaceMember extends Model<WorkspaceMemberAttributes> implements WorkspaceMemberAttributes {
  public id!: string;
  public workspace_id!: string;
  public user_id!: string;
  public role!: string;
  public can_view_billing!: boolean;
  public weekly_target_hours?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly Workspace?: Workspace;
  public readonly User?: User;
}
WorkspaceMember.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    workspace_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'member',
    },
    can_view_billing: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    weekly_target_hours: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName: 'WorkspaceMember',
    tableName: 'workspace_members',
    underscored: true,
    timestamps: true,
  }
);

Workspace.hasMany(WorkspaceMember, { foreignKey: 'workspace_id', as: 'Members' });
WorkspaceMember.belongsTo(Workspace, { foreignKey: 'workspace_id', as: 'Workspace' });
WorkspaceMember.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
User.hasMany(WorkspaceMember, { foreignKey: 'user_id', as: 'WorkspaceMemberships' });
Tenant.hasMany(Workspace, { foreignKey: 'tenant_id', as: 'Workspaces' });
Workspace.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'Tenant' });

export interface TimeSessionAttributes {
  id: string;
  tenant_id: string;
  workspace_id?: string | null;
  user_id: string;
  client_id?: string | null;
  title?: string;
  notes?: string | null;
  start_time: Date;
  end_time?: Date | null;
  target_minutes?: number | null;
  previous_session_id?: string | null;
  public_token?: string | null;
  hourly_rate?: number | null;
  is_retroactive?: boolean;
  retroactive_reason?: string | null;
  retroactive_minutes?: number | null;
  is_locked?: boolean;
  locked_at?: Date | null;
  locked_reason?: string | null;
}
export class TimeSession extends Model<TimeSessionAttributes> implements TimeSessionAttributes {
  public id!: string;
  public tenant_id!: string;
  public workspace_id!: string | null;
  public user_id!: string;
  public client_id!: string | null;
  public title!: string;
  public notes!: string | null;
  public start_time!: Date;
  public end_time!: Date | null;
  public target_minutes!: number | null;
  public previous_session_id!: string | null;
  public public_token!: string | null;
  public hourly_rate!: number | null;
  public is_retroactive!: boolean;
  public retroactive_reason!: string | null;
  public retroactive_minutes!: number | null;
  public is_locked!: boolean;
  public locked_at!: Date | null;
  public locked_reason!: string | null;
  public readonly Tasks?: Task[];
  public readonly PreviousSession?: TimeSession | null;
  public readonly Client?: Client | null;
}
TimeSession.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    workspace_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    client_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Sessão de Trabalho',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    target_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    previous_session_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    public_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hourly_rate: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    is_retroactive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    retroactive_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    retroactive_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_locked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    locked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    locked_reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'TimeSession',
    tableName: 'time_sessions',
    underscored: true,
    timestamps: true,
  }
);

export interface ClientAttributes {
  id: string;
  tenant_id: string;
  workspace_id?: string | null;
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
}
export class Client extends Model<ClientAttributes> implements ClientAttributes {
  public id!: string;
  public tenant_id!: string;
  public workspace_id!: string | null;
  public name!: string;
  public company!: string | null;
  public email!: string | null;
  public hourly_rate!: number | null;
  public daily_target_minutes!: number | null;
  public notes!: string | null;
  public git_provider!: 'github' | 'gitlab' | null;
  public github_repo!: string | null;
  public github_token!: string | null;
  public gitlab_url!: string | null;
  public gitlab_project!: string | null;
  public gitlab_token!: string | null;
  public allowed_repositories!: string | null;
}
Client.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    workspace_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    company: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hourly_rate: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    daily_target_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    git_provider: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    github_repo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    github_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gitlab_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gitlab_project: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gitlab_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    allowed_repositories: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Client',
    tableName: 'clients',
    underscored: true,
    timestamps: true,
  }
);

export interface ClientContactAttributes {
  id: string;
  tenant_id: string;
  client_id: string;
  name: string;
  email: string;
  role?: string | null;
  phone?: string | null;
  password_hash: string;
  must_change_password: boolean;
  last_login_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}
export class ClientContact extends Model<ClientContactAttributes> implements ClientContactAttributes {
  public id!: string;
  public tenant_id!: string;
  public client_id!: string;
  public name!: string;
  public email!: string;
  public role!: string | null;
  public phone!: string | null;
  public password_hash!: string;
  public must_change_password!: boolean;
  public last_login_at!: Date | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly Client?: Client | null;
}
ClientContact.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    client_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    must_change_password: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ClientContact',
    tableName: 'client_contacts',
    underscored: true,
    timestamps: true,
  }
);

export interface TaskAttributes {
  id: string;
  tenant_id: string;
  time_session_id: string;
  description: string;
  notes?: string | null;
  link?: string | null;
  created_at?: Date;
}
export class Task extends Model<TaskAttributes> implements TaskAttributes {
  public id!: string;
  public tenant_id!: string;
  public time_session_id!: string;
  public description!: string;
  public notes!: string | null;
  public link!: string | null;
  public readonly created_at!: Date;
}
Task.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    time_session_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    link: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Task',
    tableName: 'tasks',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  }
);

export interface SharedReportAttributes {
  id: string;
  tenant_id: string;
  token: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  session_id?: string | null;
  client_id?: string | null;
  hourly_rate: number;
  include_cost?: boolean;
  allow_approval?: boolean;
  approval_code?: string;
  status?: string;
  approved_by?: string | null;
  approved_at?: Date | null;
  approval_ip?: string | null;
}
export class SharedReport extends Model<SharedReportAttributes> implements SharedReportAttributes {
  public id!: string;
  public tenant_id!: string;
  public token!: string;
  public title!: string;
  public start_date!: string | null;
  public end_date!: string | null;
  public session_id!: string | null;
  public client_id!: string | null;
  public hourly_rate!: number;
  public include_cost!: boolean;
  public allow_approval!: boolean;
  public approval_code!: string;
  public status!: string;
  public approved_by!: string | null;
  public approved_at!: Date | null;
  public approval_ip!: string | null;
  public readonly Client?: Client | null;
}
SharedReport.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Relatório de Horas & Faturamento',
    },
    start_date: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    end_date: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    session_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    client_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hourly_rate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 150.0,
    },
    include_cost: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    allow_approval: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    approval_code: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'APPR-1234',
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
    },
    approved_by: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    approval_ip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'SharedReport',
    tableName: 'shared_reports',
    underscored: true,
    timestamps: true,
  }
);

// --- ASSOCIATIONS ---
Plan.hasMany(Tenant, { foreignKey: 'plan_id' });
Tenant.belongsTo(Plan, { foreignKey: 'plan_id', as: 'Plan' });

Tenant.hasMany(Subscription, { foreignKey: 'tenant_id', as: 'Subscriptions' });
Tenant.hasOne(Subscription, { foreignKey: 'tenant_id', as: 'CurrentSubscription' });
Subscription.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'Tenant' });

Tenant.hasMany(Invoice, { foreignKey: 'tenant_id', as: 'Invoices' });
Invoice.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'Tenant' });

Subscription.hasMany(Invoice, { foreignKey: 'subscription_id', as: 'Invoices' });
Invoice.belongsTo(Subscription, { foreignKey: 'subscription_id', as: 'Subscription' });

Plan.hasMany(Subscription, { foreignKey: 'plan_id' });
Subscription.belongsTo(Plan, { foreignKey: 'plan_id', as: 'Plan' });

Tenant.hasMany(User, { foreignKey: 'tenant_id' });
User.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Tenant.hasMany(TimeSession, { foreignKey: 'tenant_id' });
TimeSession.belongsTo(Tenant, { foreignKey: 'tenant_id' });
TimeSession.belongsTo(User, { foreignKey: 'user_id' });

TimeSession.hasMany(Task, { foreignKey: 'time_session_id', as: 'Tasks' });
Task.belongsTo(TimeSession, { foreignKey: 'time_session_id' });

TimeSession.belongsTo(TimeSession, {
  foreignKey: 'previous_session_id',
  as: 'PreviousSession',
});

Tenant.hasMany(Task, { foreignKey: 'tenant_id' });
Task.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Tenant.hasMany(SharedReport, { foreignKey: 'tenant_id' });
SharedReport.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Client.hasMany(SharedReport, { foreignKey: 'client_id' });
SharedReport.belongsTo(Client, { foreignKey: 'client_id', as: 'Client' });

Tenant.hasMany(Client, { foreignKey: 'tenant_id' });
Client.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Client.hasMany(TimeSession, { foreignKey: 'client_id' });
TimeSession.belongsTo(Client, { foreignKey: 'client_id', as: 'Client' });

Client.hasMany(ClientContact, { foreignKey: 'client_id', as: 'Contacts' });
ClientContact.belongsTo(Client, { foreignKey: 'client_id', as: 'Client' });
Tenant.hasMany(ClientContact, { foreignKey: 'tenant_id' });
ClientContact.belongsTo(Tenant, { foreignKey: 'tenant_id' });

Workspace.hasMany(TimeSession, { foreignKey: 'workspace_id', as: 'TimeSessions' });
TimeSession.belongsTo(Workspace, { foreignKey: 'workspace_id', as: 'Workspace' });
Workspace.hasMany(Client, { foreignKey: 'workspace_id', as: 'Clients' });
Client.belongsTo(Workspace, { foreignKey: 'workspace_id', as: 'Workspace' });

export interface AiMessageAttributes {
  id: string;
  tenant_id: string;
  workspace_id?: string | null;
  user_id: string;
  role: 'user' | 'model';
  content: string;
  images_json?: string | null;
  steps_json?: string | null;
  created_at?: Date;
}
export class AiMessage extends Model<AiMessageAttributes> implements AiMessageAttributes {
  public id!: string;
  public tenant_id!: string;
  public workspace_id!: string | null;
  public user_id!: string;
  public role!: 'user' | 'model';
  public content!: string;
  public images_json!: string | null;
  public steps_json!: string | null;
  public readonly created_at!: Date;
}
AiMessage.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    workspace_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    images_json: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    steps_json: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AiMessage',
    tableName: 'ai_messages',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  }
);

Tenant.hasMany(AiMessage, { foreignKey: 'tenant_id' });
AiMessage.belongsTo(Tenant, { foreignKey: 'tenant_id' });
User.hasMany(AiMessage, { foreignKey: 'user_id' });
AiMessage.belongsTo(User, { foreignKey: 'user_id' });
Workspace.hasMany(AiMessage, { foreignKey: 'workspace_id', as: 'AiMessages' });
AiMessage.belongsTo(Workspace, { foreignKey: 'workspace_id', as: 'Workspace' });

export interface WorkspaceAiDailyUsageAttributes {
  id: string;
  tenant_id: string;
  workspace_id: string;
  date: string; // 'YYYY-MM-DD'
  count: number;
}
export class WorkspaceAiDailyUsage
  extends Model<WorkspaceAiDailyUsageAttributes>
  implements WorkspaceAiDailyUsageAttributes {
  public id!: string;
  public tenant_id!: string;
  public workspace_id!: string;
  public date!: string;
  public count!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}
WorkspaceAiDailyUsage.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    workspace_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    date: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'workspace_ai_daily_usages',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['workspace_id', 'date'],
      },
    ],
  }
);

Workspace.hasMany(WorkspaceAiDailyUsage, { foreignKey: 'workspace_id', as: 'AiDailyUsages' });
WorkspaceAiDailyUsage.belongsTo(Workspace, { foreignKey: 'workspace_id', as: 'Workspace' });
Tenant.hasMany(WorkspaceAiDailyUsage, { foreignKey: 'tenant_id' });
WorkspaceAiDailyUsage.belongsTo(Tenant, { foreignKey: 'tenant_id' });

export interface RefreshTokenAttributes {
  id: string;
  user_id: string;
  tenant_id: string;
  token: string;
  expires_at: Date;
  revoked: boolean;
  created_at?: Date;
  updated_at?: Date;
}
export class RefreshToken extends Model<RefreshTokenAttributes> implements RefreshTokenAttributes {
  public id!: string;
  public user_id!: string;
  public tenant_id!: string;
  public token!: string;
  public expires_at!: Date;
  public revoked!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}
RefreshToken.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revoked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'RefreshToken',
    tableName: 'refresh_tokens',
    underscored: true,
    timestamps: true,
  }
);

export interface PasswordResetAttributes {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  used: boolean;
  created_at?: Date;
  updated_at?: Date;
}
export class PasswordReset extends Model<PasswordResetAttributes> implements PasswordResetAttributes {
  public id!: string;
  public user_id!: string;
  public token!: string;
  public expires_at!: Date;
  public used!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}
PasswordReset.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    used: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'PasswordReset',
    tableName: 'password_resets',
    underscored: true,
    timestamps: true,
  }
);

export interface InviteAttributes {
  id: string;
  tenant_id: string;
  workspace_id?: string | null;
  email: string;
  role: string; // 'admin' | 'member' | 'guest'
  can_view_billing?: boolean;
  token: string;
  invited_by_user_id?: string | null;
  status: string; // 'pending' | 'accepted' | 'expired' | 'canceled'
  expires_at: Date;
  created_at?: Date;
  updated_at?: Date;
}
export class Invite extends Model<InviteAttributes> implements InviteAttributes {
  public id!: string;
  public tenant_id!: string;
  public workspace_id!: string | null;
  public email!: string;
  public role!: string;
  public can_view_billing!: boolean;
  public token!: string;
  public invited_by_user_id!: string | null;
  public status!: string;
  public expires_at!: Date;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly Tenant?: Tenant;
  public readonly Workspace?: Workspace;
  public readonly Inviter?: User;
}
Invite.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    workspace_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'member',
    },
    can_view_billing: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    invited_by_user_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Invite',
    tableName: 'invites',
    underscored: true,
    timestamps: true,
  }
);

Tenant.hasMany(Invite, { foreignKey: 'tenant_id' });
Invite.belongsTo(Tenant, { foreignKey: 'tenant_id' });
User.hasMany(Invite, { foreignKey: 'invited_by_user_id', as: 'SentInvites' });
Invite.belongsTo(User, { foreignKey: 'invited_by_user_id', as: 'Inviter' });

export interface NoteAttributes {
  id: string;
  tenant_id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  content: string;
  is_workspace_shared: boolean;
  is_pinned?: boolean;
  created_at?: Date;
  updated_at?: Date;
}
export class Note extends Model<NoteAttributes> implements NoteAttributes {
  public id!: string;
  public tenant_id!: string;
  public workspace_id!: string;
  public user_id!: string;
  public title!: string;
  public content!: string;
  public is_workspace_shared!: boolean;
  public is_pinned!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly Author?: User;
}
Note.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => crypto.randomUUID(),
    },
    tenant_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    workspace_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Nova Nota',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    is_workspace_shared: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_pinned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'Note',
    tableName: 'notes',
    underscored: true,
    timestamps: true,
  }
);

Tenant.hasMany(Note, { foreignKey: 'tenant_id' });
Note.belongsTo(Tenant, { foreignKey: 'tenant_id' });
Workspace.hasMany(Note, { foreignKey: 'workspace_id' });
Note.belongsTo(Workspace, { foreignKey: 'workspace_id' });
User.hasMany(Note, { foreignKey: 'user_id' });
Note.belongsTo(User, { foreignKey: 'user_id', as: 'Author' });

User.hasMany(RefreshToken, { foreignKey: 'user_id' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(PasswordReset, { foreignKey: 'user_id' });
PasswordReset.belongsTo(User, { foreignKey: 'user_id' });

// --- INITIALIZATION & SEED ---
export async function initDb() {
  // Clean up any orphaned backup tables from previous SQLite alter attempts
  await sequelize.query('DROP TABLE IF EXISTS tenants_backup;').catch(() => {});
  await sequelize.query('DROP TABLE IF EXISTS users_backup;').catch(() => {});
  await sequelize.query('DROP TABLE IF EXISTS time_sessions_backup;').catch(() => {});
  await sequelize.query('DROP TABLE IF EXISTS tasks_backup;').catch(() => {});
  await sequelize.query('DROP TABLE IF EXISTS shared_reports_backup;').catch(() => {});
  await sequelize.query('DROP TABLE IF EXISTS clients_backup;').catch(() => {});
  await sequelize.query('DROP TABLE IF EXISTS client_contacts_backup;').catch(() => {});
  await sequelize.query('DROP TABLE IF EXISTS ai_messages_backup;').catch(() => {});
  await sequelize.query('DROP TABLE IF EXISTS refresh_tokens_backup;').catch(() => {});
  await sequelize.query('DROP TABLE IF EXISTS password_resets_backup;').catch(() => {});
  await sequelize.query('DROP TABLE IF EXISTS invites_backup;').catch(() => {});

  // Safe synchronization (creates tables if they do not exist)
  await sequelize.sync();

  // Helper to ensure a column exists in either PostgreSQL or SQLite table
  const addColumnIfNotExists = async (table: string, column: string, definition: string) => {
    try {
      if (DB_TYPE === 'postgres') {
        const [results] = (await sequelize.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = :table AND column_name = :column;`,
          { replacements: { table, column } }
        )) as [Array<{ column_name: string }>, any];

        if (results.length === 0) {
          const pgDef = definition
            .replace(/DATETIME/gi, 'TIMESTAMP WITH TIME ZONE')
            .replace(/BOOLEAN DEFAULT 1/gi, 'BOOLEAN DEFAULT TRUE')
            .replace(/BOOLEAN DEFAULT 0/gi, 'BOOLEAN DEFAULT FALSE');
          await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${pgDef};`);
          console.log(`[PostgreSQL] Added column ${column} to table ${table}`);
        }
      } else {
        const [columns] = (await sequelize.query(`PRAGMA table_info(${table});`)) as [Array<{ name: string }>, any];
        const exists = columns.some((c) => c.name === column);
        if (!exists) {
          await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
          console.log(`[SQLite] Added column ${column} to table ${table}`);
        }
      }
    } catch (e) {
      console.warn(`Could not add column ${column} to table ${table}:`, e);
    }
  };

  await addColumnIfNotExists('shared_reports', 'include_cost', 'BOOLEAN DEFAULT 1');
  await addColumnIfNotExists('shared_reports', 'allow_approval', 'BOOLEAN DEFAULT 1');
  await addColumnIfNotExists('shared_reports', 'approval_code', "VARCHAR(255) DEFAULT 'APPR-1234'");
  await addColumnIfNotExists('shared_reports', 'status', "VARCHAR(50) DEFAULT 'pending'");
  await addColumnIfNotExists('shared_reports', 'approved_by', 'VARCHAR(255)');
  await addColumnIfNotExists('shared_reports', 'approved_at', 'DATETIME');
  await addColumnIfNotExists('shared_reports', 'approval_ip', 'VARCHAR(255)');
  await addColumnIfNotExists('shared_reports', 'client_id', 'VARCHAR(255)');
  await addColumnIfNotExists('time_sessions', 'client_id', 'VARCHAR(255)');
  await addColumnIfNotExists('time_sessions', 'public_token', 'VARCHAR(255)');
  await addColumnIfNotExists('time_sessions', 'notes', 'TEXT');
  await addColumnIfNotExists('time_sessions', 'hourly_rate', 'FLOAT');
  await addColumnIfNotExists('time_sessions', 'is_locked', 'BOOLEAN DEFAULT 0');
  await addColumnIfNotExists('time_sessions', 'locked_at', 'DATETIME');
  await addColumnIfNotExists('time_sessions', 'locked_reason', 'VARCHAR(255)');
  await addColumnIfNotExists('tasks', 'notes', 'TEXT');
  await addColumnIfNotExists('tasks', 'link', 'VARCHAR(1000)');
  await addColumnIfNotExists('tenants', 'default_target_minutes', 'INTEGER DEFAULT 60');
  await addColumnIfNotExists('tenants', 'default_client_daily_target_minutes', 'INTEGER DEFAULT 120');
  await addColumnIfNotExists('tenants', 'monthly_billing_goal', 'FLOAT DEFAULT 10000.0');
  await addColumnIfNotExists('tenants', 'git_provider', "VARCHAR(50) DEFAULT 'github'");
  await addColumnIfNotExists('tenants', 'github_token', 'VARCHAR(255)');
  await addColumnIfNotExists('tenants', 'github_repo', 'VARCHAR(255)');
  await addColumnIfNotExists('tenants', 'gitlab_url', "VARCHAR(255) DEFAULT 'https://gitlab.com'");
  await addColumnIfNotExists('tenants', 'gitlab_project', 'VARCHAR(255)');
  await addColumnIfNotExists('tenants', 'gitlab_token', 'VARCHAR(255)');
  await addColumnIfNotExists('tenants', 'allowed_repositories', 'TEXT');
  await addColumnIfNotExists('clients', 'daily_target_minutes', 'INTEGER');
  await addColumnIfNotExists('clients', 'git_provider', "VARCHAR(50)");
  await addColumnIfNotExists('clients', 'github_repo', "VARCHAR(255)");
  await addColumnIfNotExists('clients', 'github_token', "VARCHAR(255)");
  await addColumnIfNotExists('clients', 'gitlab_url', "VARCHAR(255)");
  await addColumnIfNotExists('clients', 'gitlab_project', "VARCHAR(255)");
  await addColumnIfNotExists('clients', 'gitlab_token', "VARCHAR(255)");
  await addColumnIfNotExists('clients', 'allowed_repositories', "TEXT");
  await addColumnIfNotExists('tenants', 'plan_id', "VARCHAR(50) DEFAULT 'free'");
  await addColumnIfNotExists('users', 'role', "VARCHAR(50) DEFAULT 'admin'");

  // Subscriptions columns migration
  await addColumnIfNotExists('subscriptions', 'cancel_at_period_end', 'BOOLEAN DEFAULT 0');
  await addColumnIfNotExists('subscriptions', 'cancel_at', 'DATETIME');
  await addColumnIfNotExists('subscriptions', 'canceled_at', 'DATETIME');
  await addColumnIfNotExists('subscriptions', 'gateway', "VARCHAR(50) DEFAULT 'manual'");
  await addColumnIfNotExists('subscriptions', 'gateway_subscription_id', 'VARCHAR(255)');
  await addColumnIfNotExists('subscriptions', 'gateway_customer_id', 'VARCHAR(255)');
  await addColumnIfNotExists('subscriptions', 'payment_method_brand', 'VARCHAR(50)');
  await addColumnIfNotExists('subscriptions', 'payment_method_last4', 'VARCHAR(10)');
  await addColumnIfNotExists('subscriptions', 'payment_method_exp_month', 'INTEGER');
  await addColumnIfNotExists('subscriptions', 'payment_method_exp_year', 'INTEGER');

  // Invoices columns migration
  await addColumnIfNotExists('invoices', 'subscription_id', 'VARCHAR(255)');
  await addColumnIfNotExists('invoices', 'gateway_invoice_id', 'VARCHAR(255)');
  await addColumnIfNotExists('invoices', 'amount', 'FLOAT DEFAULT 0');
  await addColumnIfNotExists('invoices', 'currency', "VARCHAR(10) DEFAULT 'brl'");
  await addColumnIfNotExists('invoices', 'status', "VARCHAR(50) DEFAULT 'paid'");
  await addColumnIfNotExists('invoices', 'billing_reason', 'VARCHAR(255)');
  await addColumnIfNotExists('invoices', 'invoice_pdf', 'VARCHAR(1000)');
  await addColumnIfNotExists('invoices', 'hosted_invoice_url', 'VARCHAR(1000)');
  await addColumnIfNotExists('invoices', 'paid_at', 'DATETIME');
  await addColumnIfNotExists('invoices', 'period_start', 'DATETIME');
  await addColumnIfNotExists('invoices', 'period_end', 'DATETIME');

  await addColumnIfNotExists('time_sessions', 'workspace_id', 'VARCHAR(255)');
  await addColumnIfNotExists('clients', 'workspace_id', 'VARCHAR(255)');
  await addColumnIfNotExists('ai_messages', 'workspace_id', 'VARCHAR(255)');
  await addColumnIfNotExists('tenants', 'workspace_id', 'VARCHAR(255)');
  await addColumnIfNotExists('invites', 'workspace_id', 'VARCHAR(255)');
  await addColumnIfNotExists('workspaces', 'git_provider', "VARCHAR(50) DEFAULT 'github'");
  await addColumnIfNotExists('workspaces', 'github_token', 'VARCHAR(255)');
  await addColumnIfNotExists('workspaces', 'github_repo', 'VARCHAR(255)');
  await addColumnIfNotExists('workspaces', 'gitlab_url', "VARCHAR(255) DEFAULT 'https://gitlab.com'");
  await addColumnIfNotExists('workspaces', 'gitlab_project', 'VARCHAR(255)');
  await addColumnIfNotExists('workspaces', 'gitlab_token', 'VARCHAR(255)');
  await addColumnIfNotExists('workspaces', 'allowed_repositories', 'TEXT');
  await addColumnIfNotExists('workspaces', 'default_target_minutes', 'INTEGER DEFAULT 60');
  await addColumnIfNotExists('workspaces', 'default_client_daily_target_minutes', 'INTEGER DEFAULT 120');
  await addColumnIfNotExists('workspaces', 'monthly_billing_goal', 'FLOAT DEFAULT 10000.0');
  await addColumnIfNotExists('workspaces', 'timezone', "VARCHAR(100) DEFAULT 'America/Sao_Paulo'");
  await addColumnIfNotExists('tenants', 'timezone', "VARCHAR(100) DEFAULT 'America/Sao_Paulo'");
  await addColumnIfNotExists('users', 'timezone', "VARCHAR(100) DEFAULT 'America/Sao_Paulo'");

  // Retroactive timer configuration and session tracking migration
  await addColumnIfNotExists('workspaces', 'max_retroactive_minutes', 'INTEGER DEFAULT 120');
  await addColumnIfNotExists('tenants', 'max_retroactive_minutes', 'INTEGER DEFAULT 120');
  await addColumnIfNotExists('time_sessions', 'is_retroactive', 'BOOLEAN DEFAULT 0');
  await addColumnIfNotExists('time_sessions', 'retroactive_reason', 'TEXT');
  await addColumnIfNotExists('time_sessions', 'retroactive_minutes', 'INTEGER');

  // Plan columns migration
  await addColumnIfNotExists('plans', 'max_workspaces', 'INTEGER DEFAULT 1');
  await addColumnIfNotExists('plans', 'max_sessions_per_month', 'INTEGER DEFAULT -1');

  // Can view billing permissions & goals migration
  await addColumnIfNotExists('users', 'can_view_billing', 'BOOLEAN DEFAULT 1');
  await addColumnIfNotExists('workspace_members', 'can_view_billing', 'BOOLEAN DEFAULT 1');
  await addColumnIfNotExists('workspace_members', 'weekly_target_hours', 'FLOAT DEFAULT NULL');
  await addColumnIfNotExists('invites', 'can_view_billing', 'BOOLEAN DEFAULT 1');

  // Ensure WorkspaceAiDailyUsage table exists
  await WorkspaceAiDailyUsage.sync();

  // Ensure default plans exist (free, pro, team)
  const defaultPlans = [
    {
      id: 'free',
      name: 'Free',
      description: 'Ideal para freelancers e autônomos começando a organizar seu tempo e clientes.',
      price_monthly: 0,
      price_yearly: 0,
      max_workspaces: 1,
      max_users: 1,
      max_clients: 3,
      max_sessions_per_month: 50,
      max_storage_mb: -1,
      features: JSON.stringify([
        '1 Workspace',
        '2 Perguntas para a IA por dia por workspace',
        'Até 3 Clientes',
        '50 Sessões por mês',
        'Timer Resiliente e Relatórios Básicos',
        'Integração Git Básica (GitHub / GitLab)',
      ]),
      is_active: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Plano individual para profissionais autônomos com clientes, sessões ilimitadas, IA e exportação completa.',
      price_monthly: 9.99,
      price_yearly: 99.90,
      max_workspaces: -1,
      max_users: 1, // Individual - não aceita membros adicionais
      max_clients: -1,
      max_sessions_per_month: -1,
      max_storage_mb: -1,
      features: JSON.stringify([
        'Workspaces Ilimitados',
        '25 Mensagens para a IA por dia por workspace',
        'Clientes e Sessões Ilimitadas',
        'Exportação Completa dos Dados do Workspace',
        'Uso Individual (R$ 9,99/mês - 1 usuário)',
        'Assistente de IA Cronos (Visão e Áudio)',
        'Relatórios com Link de Aprovação do Cliente',
      ]),
      is_active: true,
    },
    {
      id: 'team',
      name: 'Team',
      description: 'Para agências e equipes. Cobrança por usuário (R$ 4,99/mês por membro, mínimo de 5 usuários).',
      price_monthly: 4.99,
      price_yearly: 49.90,
      max_workspaces: -1,
      max_users: -1, // Ilimitado - cobrado por membro
      max_clients: -1,
      max_sessions_per_month: -1,
      max_storage_mb: -1,
      features: JSON.stringify([
        'Tudo do Plano Pro Incluso',
        'Cobrança por Usuário (R$ 4,99/mês por membro - Mínimo de 5 usuários)',
        'Convite de Membros de Equipe Ilimitados',
        '100 Mensagens para a IA por dia por workspace',
        'Workspaces e Clientes Ilimitados',
        'Exportação Completa dos Dados do Workspace',
        'Gestão de Membros de Equipe e Funções (Admin, Membro, Financeiro)',
        'Permissões Granulares de Repositórios Git',
        'Integrações Avançadas e Webhooks',
        'Suporte Prioritário & SLA Garantido',
      ]),
      is_active: true,
    },
  ];

  for (const planData of defaultPlans) {
    const existing = await Plan.findByPk(planData.id);
    if (!existing) {
      await Plan.create(planData);
    } else {
      await existing.update(planData);
    }
  }

  // Ensure default tenant exists
  let defaultTenant = await Tenant.findOne();
  if (!defaultTenant) {
    defaultTenant = await Tenant.create({
      id: 'tenant-default-001',
      name: 'Workspace Principal',
    });
  }
  const defaultTenantId = defaultTenant.getDataValue('id') || (defaultTenant as any).id || 'tenant-default-001';

  // Ensure default user exists
  let defaultUser = await User.findOne();
  if (!defaultUser) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);

    defaultUser = await User.create({
      id: 'user-default-001',
      tenant_id: defaultTenantId,
      name: 'Thiago Pascotto',
      email: 'thiagopascotto94@gmail.com',
      password_hash: passwordHash,
      default_hourly_rate: 150.0,
    });
  }
  const defaultUserId = defaultUser.getDataValue('id') || (defaultUser as any).id || 'user-default-001';

  // Ensure default clients exist
  let defaultClient = await Client.findOne({ where: { tenant_id: defaultTenantId } });
  if (!defaultClient) {
    defaultClient = await Client.create({
      id: 'client-default-1',
      tenant_id: defaultTenantId,
      name: 'Acme Corp',
      company: 'Acme Corporation Ltda',
      email: 'contato@acmecorp.com',
      hourly_rate: 180.0,
      notes: 'Projeto de e-commerce e integrações.',
      git_provider: 'github',
      github_repo: 'acmecorp/ecommerce-storefront',
      allowed_repositories: JSON.stringify([
        {
          id: 'github:acmecorp/ecommerce-storefront',
          provider: 'github',
          fullName: 'acmecorp/ecommerce-storefront',
          name: 'ecommerce-storefront',
          owner: 'acmecorp',
          isPrivate: true,
          defaultBranch: 'main',
          description: 'Loja virtual e portal do cliente Acme Corp',
        },
        {
          id: 'github:acmecorp/payment-service',
          provider: 'github',
          fullName: 'acmecorp/payment-service',
          name: 'payment-service',
          owner: 'acmecorp',
          isPrivate: true,
          defaultBranch: 'main',
          description: 'Microsserviço de pagamentos e faturamento',
        },
      ]),
    });
    await Client.create({
      id: 'client-default-2',
      tenant_id: defaultTenantId,
      name: 'Globex Software',
      company: 'Globex Inc.',
      email: 'tech@globex.com',
      hourly_rate: 150.0,
      notes: 'Painel administrativo.',
      git_provider: 'gitlab',
      gitlab_project: 'globex/admin-portal',
      allowed_repositories: JSON.stringify([
        {
          id: 'gitlab:globex/admin-portal',
          provider: 'gitlab',
          fullName: 'globex/admin-portal',
          name: 'admin-portal',
          owner: 'globex',
          isPrivate: false,
          defaultBranch: 'main',
          description: 'Painel administrativo Globex',
        },
      ]),
    });
  } else {
    // If existing clients don't have git repositories configured yet, populate them for Acme Corp
    if (!defaultClient.allowed_repositories && !defaultClient.github_repo) {
      defaultClient.git_provider = 'github';
      defaultClient.github_repo = 'acmecorp/ecommerce-storefront';
      defaultClient.allowed_repositories = JSON.stringify([
        {
          id: 'github:acmecorp/ecommerce-storefront',
          provider: 'github',
          fullName: 'acmecorp/ecommerce-storefront',
          name: 'ecommerce-storefront',
          owner: 'acmecorp',
          isPrivate: true,
          defaultBranch: 'main',
          description: 'Loja virtual e portal do cliente Acme Corp',
        },
        {
          id: 'github:acmecorp/payment-service',
          provider: 'github',
          fullName: 'acmecorp/payment-service',
          name: 'payment-service',
          owner: 'acmecorp',
          isPrivate: true,
          defaultBranch: 'main',
          description: 'Microsserviço de pagamentos e faturamento',
        },
      ]);
      await defaultClient.save().catch(() => {});
    }

    const secondClient = await Client.findOne({ where: { id: 'client-default-2' } });
    if (secondClient && !secondClient.allowed_repositories && !secondClient.gitlab_project) {
      secondClient.git_provider = 'gitlab';
      secondClient.gitlab_project = 'globex/admin-portal';
      secondClient.allowed_repositories = JSON.stringify([
        {
          id: 'gitlab:globex/admin-portal',
          provider: 'gitlab',
          fullName: 'globex/admin-portal',
          name: 'admin-portal',
          owner: 'globex',
          isPrivate: false,
          defaultBranch: 'main',
          description: 'Painel administrativo Globex',
        },
      ]);
      await secondClient.save().catch(() => {});
    }
  }

  // Ensure default client contact exists
  const contactCount = await ClientContact.count();
  const defaultClientId = defaultClient ? (defaultClient.getDataValue('id') || (defaultClient as any).id) : null;
  if (contactCount === 0 && defaultClientId) {
    const tempSalt = await bcrypt.genSalt(10);
    const tempHash = await bcrypt.hash('Aprov@2026', tempSalt);
    await ClientContact.create({
      id: 'contact-default-1',
      tenant_id: defaultTenantId,
      client_id: defaultClientId,
      name: 'Mariana Costa',
      email: 'mariana.costa@acmecorp.com',
      role: 'Diretoria Financeira & Aprovadora',
      phone: '(11) 98765-4321',
      password_hash: tempHash,
      must_change_password: true,
    });
  }

  // Create sample sessions if empty
  const sessionCount = await TimeSession.count();
  if (sessionCount === 0) {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Session 1 (2 days ago)
    const s1Start = new Date(twoDaysAgo);
    s1Start.setHours(9, 0, 0, 0);
    const s1End = new Date(s1Start.getTime() + 2.5 * 3600 * 1000); // 2h 30m
    const s1 = await TimeSession.create({
      id: 'session-sample-1',
      tenant_id: defaultTenantId,
      user_id: defaultUserId,
      title: 'Arquitetura e Configuração Inicial',
      start_time: s1Start,
      end_time: s1End,
      target_minutes: 120,
    });
    await Task.create({
      tenant_id: defaultTenantId,
      time_session_id: s1.id,
      description: 'Setup do Sequelize com SQLite e modelagem multitenant',
    });
    await Task.create({
      tenant_id: defaultTenantId,
      time_session_id: s1.id,
      description: 'Criação dos endpoints Express e middleware de sessão',
    });

    // Session 2 (yesterday) - continued from s1
    const s2Start = new Date(yesterday);
    s2Start.setHours(14, 0, 0, 0);
    const s2End = new Date(s2Start.getTime() + 3.25 * 3600 * 1000); // 3h 15m
    const s2 = await TimeSession.create({
      id: 'session-sample-2',
      tenant_id: defaultTenantId,
      user_id: defaultUserId,
      title: 'Desenvolvimento do Timer Resiliente e Tarefas',
      start_time: s2Start,
      end_time: s2End,
      target_minutes: 180,
      previous_session_id: s1.id,
    });
    await Task.create({
      tenant_id: defaultTenantId,
      time_session_id: s2.id,
      description: 'Cálculo de tempo baseado em delta do servidor (anti tab throttling)',
    });
    await Task.create({
      tenant_id: defaultTenantId,
      time_session_id: s2.id,
      description: 'Interface Shadcn UI de tarefas em tempo real',
    });
    await Task.create({
      tenant_id: defaultTenantId,
      time_session_id: s2.id,
      description: 'Alertas visuais e sonoros de meta atingida',
    });

    console.log('Default database seeded successfully.');
  }

  // Ensure all tenants have plan_id and an active subscription
  try {
    const allTenants = await Tenant.findAll();
    for (const tenant of allTenants) {
      const tenantId = tenant.getDataValue('id') || (tenant as any).id;
      if (!tenantId) continue;

      const currentPlanId = tenant.getDataValue('plan_id') || (tenant as any).plan_id;
      if (!currentPlanId) {
        tenant.setDataValue('plan_id', 'free');
        await tenant.save();
      }

      const existingSub = await Subscription.findOne({ where: { tenant_id: tenantId } });
      if (!existingSub) {
        const now = new Date();
        const oneYearAhead = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        await Subscription.create({
          tenant_id: tenantId,
          plan_id: currentPlanId || 'free',
          status: 'active',
          current_period_start: now,
          current_period_end: oneYearAhead,
          cancel_at_period_end: false,
          gateway: 'manual',
        });
      }
    }
  } catch (err) {
    console.error('Error synchronizing tenant plans/subscriptions:', err);
  }

  // Ensure default workspaces exist for users and backfill legacy data
  try {
    const allUsers = await User.findAll();
    for (const user of allUsers) {
      const userId = user.id;
      const tenantId = user.tenant_id;
      if (!tenantId || !userId) continue;

      const membership = await WorkspaceMember.findOne({ where: { user_id: userId } });
      if (!membership) {
        let workspace = await Workspace.findOne({ where: { tenant_id: tenantId } });
        if (!workspace) {
          const tenant = await Tenant.findByPk(tenantId);
          workspace = await Workspace.create({
            tenant_id: tenantId,
            name: tenant?.name ? `Workspace de ${tenant.name}` : 'Workspace Principal',
            description: 'Workspace padrão',
          });
        }
        await WorkspaceMember.create({
          workspace_id: workspace.id,
          user_id: userId,
          role: 'owner',
        });
      }
    }

    // Backfill legacy clients and time_sessions that have NULL or empty workspace_id
    const allTenants = await Tenant.findAll();
    for (const t of allTenants) {
      let defaultWorkspace = await Workspace.findOne({ where: { tenant_id: t.id } });
      if (!defaultWorkspace) {
        defaultWorkspace = await Workspace.create({
          tenant_id: t.id,
          name: t.name ? `Workspace de ${t.name}` : 'Workspace Principal',
          description: 'Workspace padrão',
        });
      }

      await sequelize.query(
        `UPDATE clients SET workspace_id = :workspaceId WHERE tenant_id = :tenantId AND (workspace_id IS NULL OR workspace_id = '')`,
        { replacements: { workspaceId: defaultWorkspace.id, tenantId: t.id } }
      );

      await sequelize.query(
        `UPDATE time_sessions SET workspace_id = :workspaceId WHERE tenant_id = :tenantId AND (workspace_id IS NULL OR workspace_id = '')`,
        { replacements: { workspaceId: defaultWorkspace.id, tenantId: t.id } }
      );
    }
  } catch (err) {
    console.error('Error seeding default workspaces and backfilling legacy records:', err);
  }
}
