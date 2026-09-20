'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const addIndexSafe = async (table, fields, name) => {
      try {
        await queryInterface.addIndex(table, fields, { name });
      } catch (e) {
        // Safe if already exists
      }
    };

    await addIndexSafe('users', ['tenant_id'], 'idx_users_tenant_id');
    await addIndexSafe('workspaces', ['tenant_id'], 'idx_workspaces_tenant_id');
    await addIndexSafe('workspace_members', ['workspace_id'], 'idx_ws_members_ws_id');
    await addIndexSafe('workspace_members', ['user_id'], 'idx_ws_members_user_id');
    await addIndexSafe('clients', ['tenant_id'], 'idx_clients_tenant_id');
    await addIndexSafe('clients', ['workspace_id'], 'idx_clients_workspace_id');
    await addIndexSafe('time_sessions', ['tenant_id'], 'idx_sessions_tenant_id');
    await addIndexSafe('time_sessions', ['workspace_id'], 'idx_sessions_workspace_id');
    await addIndexSafe('time_sessions', ['user_id'], 'idx_sessions_user_id');
    await addIndexSafe('time_sessions', ['client_id'], 'idx_sessions_client_id');
    await addIndexSafe('time_sessions', ['start_time'], 'idx_sessions_start_time');
    await addIndexSafe('subscriptions', ['tenant_id'], 'idx_subscriptions_tenant_id');
    await addIndexSafe('invoices', ['tenant_id'], 'idx_invoices_tenant_id');
    await addIndexSafe('ai_messages', ['tenant_id', 'workspace_id'], 'idx_ai_messages_tenant_ws');
  },

  async down(queryInterface) {
    const removeIndexSafe = async (table, name) => {
      try {
        await queryInterface.removeIndex(table, name);
      } catch (e) {}
    };

    await removeIndexSafe('users', 'idx_users_tenant_id');
    await removeIndexSafe('workspaces', 'idx_workspaces_tenant_id');
    await removeIndexSafe('workspace_members', 'idx_ws_members_ws_id');
    await removeIndexSafe('workspace_members', 'idx_ws_members_user_id');
    await removeIndexSafe('clients', 'idx_clients_tenant_id');
    await removeIndexSafe('clients', 'idx_clients_workspace_id');
    await removeIndexSafe('time_sessions', 'idx_sessions_tenant_id');
    await removeIndexSafe('time_sessions', 'idx_sessions_workspace_id');
    await removeIndexSafe('time_sessions', 'idx_sessions_user_id');
    await removeIndexSafe('time_sessions', 'idx_sessions_client_id');
    await removeIndexSafe('time_sessions', 'idx_sessions_start_time');
    await removeIndexSafe('subscriptions', 'idx_subscriptions_tenant_id');
    await removeIndexSafe('invoices', 'idx_invoices_tenant_id');
    await removeIndexSafe('ai_messages', 'idx_ai_messages_tenant_ws');
  },
};
