'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date().toISOString();
    const plans = [
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
        max_storage_mb: 500,
        features: JSON.stringify([
          '1 Workspace',
          '2 Perguntas para a IA por dia por workspace',
          'Até 3 Clientes',
          '50 Sessões por mês',
          'Timer Resiliente e Relatórios Básicos',
          'Integração Git Básica (GitHub / GitLab)',
        ]),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'pro',
        name: 'Pro',
        description: 'Perfeito para profissionais que precisam de múltiplos workspaces e recursos avançados.',
        price_monthly: 9.99,
        price_yearly: 99.9,
        max_workspaces: -1,
        max_users: 1,
        max_clients: -1,
        max_sessions_per_month: -1,
        max_storage_mb: 10240,
        features: JSON.stringify([
          'Workspaces Ilimitados',
          '25 Perguntas para a IA por dia por workspace',
          'Clientes Ilimitados',
          'Sessões de Tempo Ilimitadas',
          'Aprovação Pública de Relatórios com Token e Senha',
          'Exportação de Relatórios em PDF, CSV e Excel',
          'Sincronização Bidirecional com Repositórios Git',
          'Histórico e Filtros Avançados',
        ]),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'team',
        name: 'Team',
        description: 'Para agências, squads e empresas. R$ 4,99 por usuário/mês com mínimo de 5 assentos.',
        price_monthly: 4.99,
        price_yearly: 49.9,
        max_workspaces: -1,
        max_users: -1,
        max_clients: -1,
        max_sessions_per_month: -1,
        max_storage_mb: 51200,
        features: JSON.stringify([
          'Tudo do Plano Pro para todo o time',
          'Mínimo de 5 usuários (R$ 4,99/usuário/mês)',
          '50 Perguntas para a IA por dia por workspace',
          'Workspaces Compartilhados e Colaboração',
          'Controle de Acesso Baseado em Cargos (RBAC: Admin e Membro)',
          'Gestão de Convites com Expiração Segura',
          'Metas Coletivas de Faturamento e Horas por Cliente',
          'Suporte Prioritário e Auditoria de Sessões',
        ]),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ];

    for (const plan of plans) {
      // Check if plan exists
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM plans WHERE id = '${plan.id}' LIMIT 1;`
      );
      if (existing && existing.length > 0) {
        await queryInterface.bulkUpdate('plans', plan, { id: plan.id });
      } else {
        await queryInterface.bulkInsert('plans', [plan]);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('plans', {
      id: ['free', 'pro', 'team'],
    });
  },
};
