import { Sequelize, DataTypes, Model } from 'sequelize';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Initialize SQLite database
const storagePath = process.env.DB_PATH || path.resolve(process.cwd(), 'database.sqlite');
const storageDir = path.dirname(storagePath);
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: storagePath,
  logging: false, // Clean console
});

// --- MODELS ---

export interface TenantAttributes {
  id: string;
  name: string;
  created_at?: Date;
}
export class Tenant extends Model<TenantAttributes> implements TenantAttributes {
  public id!: string;
  public name!: string;
  public readonly created_at!: Date;
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
}
export class User extends Model<UserAttributes> implements UserAttributes {
  public id!: string;
  public tenant_id!: string;
  public name!: string;
  public email!: string;
  public password_hash!: string;
  public default_hourly_rate!: number;
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
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    timestamps: true,
  }
);

export interface TimeSessionAttributes {
  id: string;
  tenant_id: string;
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
  is_locked?: boolean;
  locked_at?: Date | null;
  locked_reason?: string | null;
}
export class TimeSession extends Model<TimeSessionAttributes> implements TimeSessionAttributes {
  public id!: string;
  public tenant_id!: string;
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
  name: string;
  company?: string | null;
  email?: string | null;
  hourly_rate?: number | null;
  notes?: string | null;
}
export class Client extends Model<ClientAttributes> implements ClientAttributes {
  public id!: string;
  public tenant_id!: string;
  public name!: string;
  public company!: string | null;
  public email!: string | null;
  public hourly_rate!: number | null;
  public notes!: string | null;
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
    notes: {
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
  created_at?: Date;
}
export class Task extends Model<TaskAttributes> implements TaskAttributes {
  public id!: string;
  public tenant_id!: string;
  public time_session_id!: string;
  public description!: string;
  public notes!: string | null;
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

export interface AiMessageAttributes {
  id: string;
  tenant_id: string;
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

  // Safe synchronization for SQLite (creates tables if they do not exist)
  await sequelize.sync();

  // Helper to ensure a column exists in a SQLite table
  const addColumnIfNotExists = async (table: string, column: string, definition: string) => {
    try {
      const [columns] = (await sequelize.query(`PRAGMA table_info(${table});`)) as [Array<{ name: string }>, any];
      const exists = columns.some((c) => c.name === column);
      if (!exists) {
        await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
        console.log(`Added column ${column} to table ${table}`);
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

  // Ensure default tenant exists
  let defaultTenant = await Tenant.findOne();
  if (!defaultTenant) {
    defaultTenant = await Tenant.create({
      id: 'tenant-default-001',
      name: 'Workspace Principal',
    });
  }

  // Ensure default user exists
  let defaultUser = await User.findOne();
  if (!defaultUser) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);

    defaultUser = await User.create({
      id: 'user-default-001',
      tenant_id: defaultTenant.id,
      name: 'Thiago Pascotto',
      email: 'thiagopascotto94@gmail.com',
      password_hash: passwordHash,
      default_hourly_rate: 150.0,
    });
  }

  // Ensure default clients exist
  let defaultClient = await Client.findOne({ where: { tenant_id: defaultTenant.id } });
  if (!defaultClient) {
    defaultClient = await Client.create({
      id: 'client-default-1',
      tenant_id: defaultTenant.id,
      name: 'Acme Corp',
      company: 'Acme Corporation Ltda',
      email: 'contato@acmecorp.com',
      hourly_rate: 180.0,
      notes: 'Projeto de e-commerce e integrações.',
    });
    await Client.create({
      id: 'client-default-2',
      tenant_id: defaultTenant.id,
      name: 'Globex Software',
      company: 'Globex Inc.',
      email: 'tech@globex.com',
      hourly_rate: 150.0,
      notes: 'Painel administrativo.',
    });
  }

  // Ensure default client contact exists
  const contactCount = await ClientContact.count();
  if (contactCount === 0 && defaultClient) {
    const tempSalt = await bcrypt.genSalt(10);
    const tempHash = await bcrypt.hash('Aprov@2026', tempSalt);
    await ClientContact.create({
      id: 'contact-default-1',
      tenant_id: defaultTenant.id,
      client_id: defaultClient.id,
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
      tenant_id: defaultTenant.id,
      user_id: defaultUser.id,
      title: 'Arquitetura e Configuração Inicial',
      start_time: s1Start,
      end_time: s1End,
      target_minutes: 120,
    });
    await Task.create({
      tenant_id: defaultTenant.id,
      time_session_id: s1.id,
      description: 'Setup do Sequelize com SQLite e modelagem multitenant',
    });
    await Task.create({
      tenant_id: defaultTenant.id,
      time_session_id: s1.id,
      description: 'Criação dos endpoints Express e middleware de sessão',
    });

    // Session 2 (yesterday) - continued from s1
    const s2Start = new Date(yesterday);
    s2Start.setHours(14, 0, 0, 0);
    const s2End = new Date(s2Start.getTime() + 3.25 * 3600 * 1000); // 3h 15m
    const s2 = await TimeSession.create({
      id: 'session-sample-2',
      tenant_id: defaultTenant.id,
      user_id: defaultUser.id,
      title: 'Desenvolvimento do Timer Resiliente e Tarefas',
      start_time: s2Start,
      end_time: s2End,
      target_minutes: 180,
      previous_session_id: s1.id,
    });
    await Task.create({
      tenant_id: defaultTenant.id,
      time_session_id: s2.id,
      description: 'Cálculo de tempo baseado em delta do servidor (anti tab throttling)',
    });
    await Task.create({
      tenant_id: defaultTenant.id,
      time_session_id: s2.id,
      description: 'Interface Shadcn UI de tarefas em tempo real',
    });
    await Task.create({
      tenant_id: defaultTenant.id,
      time_session_id: s2.id,
      description: 'Alertas visuais e sonoros de meta atingida',
    });

    console.log('Default database seeded successfully.');
  }
}
