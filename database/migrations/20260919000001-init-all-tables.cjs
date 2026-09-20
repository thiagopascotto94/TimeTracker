'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Tenants
    await queryInterface.createTable('tenants', {
      id: { type: Sequelize.STRING, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      plan_id: { type: Sequelize.STRING, allowNull: false, defaultValue: 'free' },
      default_target_minutes: { type: Sequelize.INTEGER, defaultValue: 60 },
      default_client_daily_target_minutes: { type: Sequelize.INTEGER, defaultValue: 120 },
      monthly_billing_goal: { type: Sequelize.FLOAT, defaultValue: 10000.0 },
      git_provider: { type: Sequelize.STRING, defaultValue: 'github' },
      github_token: { type: Sequelize.STRING },
      github_repo: { type: Sequelize.STRING },
      gitlab_url: { type: Sequelize.STRING, defaultValue: 'https://gitlab.com' },
      gitlab_project: { type: Sequelize.STRING },
      gitlab_token: { type: Sequelize.STRING },
      allowed_repositories: { type: Sequelize.TEXT },
      workspace_id: { type: Sequelize.STRING },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 2. Plans
    await queryInterface.createTable('plans', {
      id: { type: Sequelize.STRING, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      price_monthly: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      price_yearly: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      max_workspaces: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      max_users: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      max_clients: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
      max_sessions_per_month: { type: Sequelize.INTEGER, allowNull: false, defaultValue: -1 },
      max_storage_mb: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 500 },
      features: { type: Sequelize.TEXT },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 3. Subscriptions
    await queryInterface.createTable('subscriptions', {
      id: { type: Sequelize.STRING, primaryKey: true },
      tenant_id: { type: Sequelize.STRING, allowNull: false },
      plan_id: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'active' },
      current_period_start: { type: Sequelize.DATE, allowNull: false },
      current_period_end: { type: Sequelize.DATE, allowNull: false },
      cancel_at_period_end: { type: Sequelize.BOOLEAN, defaultValue: false },
      cancel_at: { type: Sequelize.DATE },
      canceled_at: { type: Sequelize.DATE },
      gateway: { type: Sequelize.STRING, defaultValue: 'manual' },
      gateway_subscription_id: { type: Sequelize.STRING },
      gateway_customer_id: { type: Sequelize.STRING },
      payment_method_brand: { type: Sequelize.STRING },
      payment_method_last4: { type: Sequelize.STRING },
      payment_method_exp_month: { type: Sequelize.INTEGER },
      payment_method_exp_year: { type: Sequelize.INTEGER },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 4. Invoices
    await queryInterface.createTable('invoices', {
      id: { type: Sequelize.STRING, primaryKey: true },
      tenant_id: { type: Sequelize.STRING, allowNull: false },
      subscription_id: { type: Sequelize.STRING },
      gateway_invoice_id: { type: Sequelize.STRING },
      amount: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      currency: { type: Sequelize.STRING, defaultValue: 'brl' },
      status: { type: Sequelize.STRING, defaultValue: 'paid' },
      billing_reason: { type: Sequelize.STRING },
      invoice_pdf: { type: Sequelize.STRING(1000) },
      hosted_invoice_url: { type: Sequelize.STRING(1000) },
      paid_at: { type: Sequelize.DATE },
      period_start: { type: Sequelize.DATE },
      period_end: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 5. Users
    await queryInterface.createTable('users', {
      id: { type: Sequelize.STRING, primaryKey: true },
      tenant_id: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING, allowNull: false },
      hourly_rate: { type: Sequelize.FLOAT, defaultValue: 50.0 },
      daily_target_minutes: { type: Sequelize.INTEGER, defaultValue: 60 },
      role: { type: Sequelize.STRING, defaultValue: 'admin' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 6. Workspaces
    await queryInterface.createTable('workspaces', {
      id: { type: Sequelize.STRING, primaryKey: true },
      tenant_id: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      git_provider: { type: Sequelize.STRING, defaultValue: 'github' },
      github_token: { type: Sequelize.STRING },
      github_repo: { type: Sequelize.STRING },
      gitlab_url: { type: Sequelize.STRING, defaultValue: 'https://gitlab.com' },
      gitlab_project: { type: Sequelize.STRING },
      gitlab_token: { type: Sequelize.STRING },
      allowed_repositories: { type: Sequelize.TEXT },
      default_target_minutes: { type: Sequelize.INTEGER, defaultValue: 60 },
      default_client_daily_target_minutes: { type: Sequelize.INTEGER, defaultValue: 120 },
      monthly_billing_goal: { type: Sequelize.FLOAT, defaultValue: 10000.0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 7. WorkspaceMembers
    await queryInterface.createTable('workspace_members', {
      id: { type: Sequelize.STRING, primaryKey: true },
      workspace_id: { type: Sequelize.STRING, allowNull: false },
      user_id: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.STRING, allowNull: false, defaultValue: 'member' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 8. Clients
    await queryInterface.createTable('clients', {
      id: { type: Sequelize.STRING, primaryKey: true },
      tenant_id: { type: Sequelize.STRING, allowNull: false },
      workspace_id: { type: Sequelize.STRING },
      name: { type: Sequelize.STRING, allowNull: false },
      company: { type: Sequelize.STRING },
      email: { type: Sequelize.STRING },
      hourly_rate: { type: Sequelize.FLOAT },
      daily_target_minutes: { type: Sequelize.INTEGER },
      notes: { type: Sequelize.TEXT },
      git_provider: { type: Sequelize.STRING },
      github_repo: { type: Sequelize.STRING },
      github_token: { type: Sequelize.STRING },
      gitlab_url: { type: Sequelize.STRING },
      gitlab_project: { type: Sequelize.STRING },
      gitlab_token: { type: Sequelize.STRING },
      allowed_repositories: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 9. ClientContacts
    await queryInterface.createTable('client_contacts', {
      id: { type: Sequelize.STRING, primaryKey: true },
      client_id: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.STRING },
      phone: { type: Sequelize.STRING },
      password_hash: { type: Sequelize.STRING },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 10. TimeSessions
    await queryInterface.createTable('time_sessions', {
      id: { type: Sequelize.STRING, primaryKey: true },
      tenant_id: { type: Sequelize.STRING, allowNull: false },
      workspace_id: { type: Sequelize.STRING },
      user_id: { type: Sequelize.STRING, allowNull: false },
      client_id: { type: Sequelize.STRING },
      task_name: { type: Sequelize.STRING, allowNull: false },
      start_time: { type: Sequelize.DATE, allowNull: false },
      end_time: { type: Sequelize.DATE },
      duration: { type: Sequelize.INTEGER, defaultValue: 0 },
      is_running: { type: Sequelize.BOOLEAN, defaultValue: false },
      notes: { type: Sequelize.TEXT },
      hourly_rate: { type: Sequelize.FLOAT },
      is_locked: { type: Sequelize.BOOLEAN, defaultValue: false },
      locked_at: { type: Sequelize.DATE },
      locked_reason: { type: Sequelize.STRING },
      public_token: { type: Sequelize.STRING },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 11. Tasks
    await queryInterface.createTable('tasks', {
      id: { type: Sequelize.STRING, primaryKey: true },
      tenant_id: { type: Sequelize.STRING, allowNull: false },
      user_id: { type: Sequelize.STRING, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      status: { type: Sequelize.STRING, defaultValue: 'todo' },
      priority: { type: Sequelize.STRING, defaultValue: 'medium' },
      estimated_minutes: { type: Sequelize.INTEGER },
      due_date: { type: Sequelize.DATE },
      notes: { type: Sequelize.TEXT },
      link: { type: Sequelize.STRING(1000) },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 12. SharedReports
    await queryInterface.createTable('shared_reports', {
      id: { type: Sequelize.STRING, primaryKey: true },
      token: { type: Sequelize.STRING, allowNull: false, unique: true },
      tenant_id: { type: Sequelize.STRING, allowNull: false },
      user_id: { type: Sequelize.STRING, allowNull: false },
      client_id: { type: Sequelize.STRING },
      title: { type: Sequelize.STRING, allowNull: false },
      filter_client_id: { type: Sequelize.STRING },
      start_date: { type: Sequelize.DATE },
      end_date: { type: Sequelize.DATE },
      expires_at: { type: Sequelize.DATE },
      include_cost: { type: Sequelize.BOOLEAN, defaultValue: true },
      allow_approval: { type: Sequelize.BOOLEAN, defaultValue: true },
      approval_code: { type: Sequelize.STRING, defaultValue: 'APPR-1234' },
      status: { type: Sequelize.STRING, defaultValue: 'pending' },
      approved_by: { type: Sequelize.STRING },
      approved_at: { type: Sequelize.DATE },
      approval_ip: { type: Sequelize.STRING },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 13. AiMessages
    await queryInterface.createTable('ai_messages', {
      id: { type: Sequelize.STRING, primaryKey: true },
      tenant_id: { type: Sequelize.STRING, allowNull: false },
      workspace_id: { type: Sequelize.STRING },
      user_id: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.STRING, allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      image_data: { type: Sequelize.TEXT },
      provider: { type: Sequelize.STRING, defaultValue: 'gemini' },
      model: { type: Sequelize.STRING },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 14. WorkspaceAiDailyUsage
    await queryInterface.createTable('workspace_ai_daily_usages', {
      id: { type: Sequelize.STRING, primaryKey: true },
      workspace_id: { type: Sequelize.STRING, allowNull: false },
      date_str: { type: Sequelize.STRING, allowNull: false },
      prompt_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 15. Invites
    await queryInterface.createTable('invites', {
      id: { type: Sequelize.STRING, primaryKey: true },
      tenant_id: { type: Sequelize.STRING, allowNull: false },
      workspace_id: { type: Sequelize.STRING },
      email: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.STRING, defaultValue: 'member' },
      token: { type: Sequelize.STRING, allowNull: false, unique: true },
      invited_by: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: 'pending' },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 16. PasswordResets
    await queryInterface.createTable('password_resets', {
      id: { type: Sequelize.STRING, primaryKey: true },
      user_id: { type: Sequelize.STRING, allowNull: false },
      token: { type: Sequelize.STRING, allowNull: false, unique: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      used_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 17. RefreshTokens
    await queryInterface.createTable('refresh_tokens', {
      id: { type: Sequelize.STRING, primaryKey: true },
      user_id: { type: Sequelize.STRING, allowNull: false },
      token_hash: { type: Sequelize.STRING, allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      revoked: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    const tables = [
      'refresh_tokens',
      'password_resets',
      'invites',
      'workspace_ai_daily_usages',
      'ai_messages',
      'shared_reports',
      'tasks',
      'time_sessions',
      'client_contacts',
      'clients',
      'workspace_members',
      'workspaces',
      'users',
      'invoices',
      'subscriptions',
      'plans',
      'tenants',
    ];
    for (const table of tables) {
      await queryInterface.dropTable(table);
    }
  },
};
