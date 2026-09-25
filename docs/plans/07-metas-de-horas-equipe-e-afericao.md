# Etapa 07: Metas de Horas por Membro (Diária / Semanal) & Painel de Aferição

## 1. Visão Geral & Problema

- **Contexto**: Em workspaces compartilhados (agências, consultorias, startups e equipes de desenvolvimento), gestores e proprietários precisam garantir que os membros da equipe atinjam a carga horária combinada (seja em regime de dedicação integral de 8h/dia ou 40h/sem, meio-período de 4h/dia ou contratos sob demanda de 20h/semana).
- **Problema Atual**:
  - O sistema permite definir meta de faturamento mensal do workspace e meta diária por cliente no timer pessoal, mas **não possui suporte para estipular metas de horas trabalhadas por colaborador** (membro da equipe).
  - O proprietário do workspace não tem uma visualização consolidada para acompanhar quem já bateu a meta do dia/semana, quem está no ritmo esperado e quem está abaixo do esperado.
- **Solução Proposta**:
  1. **Configuração Flexível de Metas**: O Dono/Admin define no painel de equipe a meta diária e/ou semanal em horas para cada membro (com suporte a horas decimais, ex: `8.0h`, `6.5h`, `40.0h`).
  2. **Aferição Analítica em Relatórios**: Um novo painel em **Relatórios > Metas da Equipe** com visão diária (Hoje) e semanal (Semana Atual), exibindo barras de progresso, taxa de cumprimento, saldo de horas e indicadores visuais.
  3. **Aferição Operacional em Tempo Real no Team Pulse**: Indicador de progresso diário sutil no widget do topo do Timer para que gestores vejam rapidamente o ritmo do dia sem sair da tela operacional.
  4. **Autonomia do Colaborador**: Cada membro visualiza sua meta pessoal e seu progresso diário/semanal no Timer, estimulando autogestão e transparência.

---

## 2. Avaliação dos Locais de Aferição

| Local de Aferição | Papel no Fluxo de Trabalho | Prós & Funcionalidades | Recomendação |
| :--- | :--- | :--- | :---: |
| **Aba "Relatórios" > "Metas da Equipe"** | **Principal (Analítico / Histórico)** | • Filtro por período: **Hoje** vs **Esta Semana** vs **Semana Passada**.<br>• Métricas consolidadas: Taxa média de cumprimento do time, total de horas realizadas vs meta total.<br>• Tabela comparativa com avatares, barras de progresso coloridas, horas faltantes/excedentes e status.<br>• Exportação de relatório em PDF/CSV. | ⭐⭐⭐⭐⭐ **(Principal)** |
| **Widget "Team Pulse" (Topo do Timer)** | **Complementar (Operacional / Tempo Real)** | • Visibilidade instantânea para o Dono/Admin enquanto trabalha no Timer.<br>• Mini-barra de progresso ou badge ao lado de cada membro ativo (ex: `Carlos: 6.2h / 8h (78%)`).<br>• Zero cliques adicionais para saber quem está perto de bater a meta hoje. | ⭐⭐⭐⭐ **(Complementar)** |
| **Timer Pessoal do Membro** | **Auto-gestão do Colaborador** | • O próprio membro vê sua meta estipulada pelo gestor no timer.<br>• Anel SVG ou barra de progresso diária pessoal.<br>• Transparência e motivação mútua sem necessidade de microgerenciamento. | ⭐⭐⭐⭐⭐ **(Essencial)** |

---

## 3. Especificação Técnica & Arquitetura

### 3.1. Modelo de Dados & Banco de Dados (Sequelize)
- **Tabela `workspace_members`**:
  - `daily_target_hours`: `DataTypes.DECIMAL(4, 2)` (permite nulo, default: `null`, ex: `8.00`).
  - `weekly_target_hours`: `DataTypes.DECIMAL(5, 2)` (permite nulo, default: `null`, ex: `40.00`).
- **Tabela `workspaces` (Opcional para Padrão do Workspace)**:
  - `default_member_daily_hours`: `DataTypes.DECIMAL(4, 2)` (default: `8.00`).
  - `default_member_weekly_hours`: `DataTypes.DECIMAL(5, 2)` (default: `40.00`).

### 3.2. Interfaces TypeScript (`src/types.ts`)
```typescript
export interface WorkspaceMemberGoal {
  userId: string;
  name: string;
  email: string;
  role: string;
  daily_target_hours: number | null;
  weekly_target_hours: number | null;
  logged_hours_today: number;
  logged_hours_week: number;
  today_progress_percent: number;
  week_progress_percent: number;
  today_status: 'met' | 'on_track' | 'behind' | 'no_goal';
  week_status: 'met' | 'on_track' | 'behind' | 'no_goal';
}

export interface TeamGoalsSummary {
  period: 'today' | 'week';
  total_members_with_goals: number;
  members_met_goal: number;
  team_overall_completion_rate: number;
  total_logged_hours: number;
  total_target_hours: number;
  members: WorkspaceMemberGoal[];
}
```

### 3.3. Endpoints da API Backend
1. **Configuração de Metas (Dono/Admin)**:
   - `PATCH /api/workspaces/:id/members/:targetUserId`
   - *Payload*:
     ```json
     {
       "daily_target_hours": 8.0,
       "weekly_target_hours": 40.0
     }
     ```
   - *Permissão*: Exclusivo para papéis `owner` e `admin`.
2. **Consulta e Aferição de Metas da Equipe**:
   - `GET /api/workspaces/:id/team-goals-progress?period=today|week`
   - Realiza agregação das sessões de tempo (`TimeSession`) de cada membro no workspace no período especificado e calcula o percentual de atingimento das metas configuradas.
   - Retorna a estrutura `TeamGoalsSummary`.
3. **Meta Pessoal do Membro Conectado**:
   - Incluída no payload de sessão ativa ou no perfil de membro (`/api/auth/me` ou `/api/workspaces/current`), permitindo renderizar o progresso pessoal no `TimerView`.

### 3.4. Componentes Frontend
1. **Configuração (`TeamMembersSettingsTab.tsx`)**:
   - Colunas na tabela de membros: "Meta Diária" e "Meta Semanal".
   - Modal ou formulário inline para o gestor ajustar facilmente as horas de cada membro.
2. **Painel de Aferição (`TeamGoalsReportTab.tsx` dentro de `ReportsView.tsx`)**:
   - Seletor de período: **Hoje** / **Esta Semana**.
   - Cards de métricas principais no topo (Taxa Média de Cumprimento, Membros com Meta Atingida, Total de Horas).
   - Tabela detalhada de colaboradores com:
     - Avatar e Nome do Membro.
     - Horas Registradas vs Meta (ex: `32.5h / 40.0h`).
     - Barra de progresso com coloração semântica:
       - Verde: Meta atingida (≥ 100%).
       - Azul / Índigo: Em andamento saudável.
       - Âmbar / Laranja: Abaixo do ritmo esperado.
     - Saldo de horas (ex: `+2.5h` de hora extra ou `-7.5h` restantes).
3. **Exibição no `TeamPulseWidget.tsx`**:
   - Exibição de mini-indicador circular ou barra fina sob cada colaborador ativo no widget.

---

## 4. Checklist de Implementação

- [ ] Adicionar colunas `daily_target_hours` e `weekly_target_hours` no modelo `WorkspaceMember` em `server/db.ts`.
- [ ] Atualizar tipagens em `src/types.ts` (`WorkspaceMember`, `User`, `TeamGoalsSummary`).
- [ ] Atualizar endpoint `PATCH /api/workspaces/:id/members/:targetUserId` para salvar as metas diárias e semanais.
- [ ] Criar endpoint `GET /api/workspaces/:id/team-goals-progress` com cálculo agregado das horas por período.
- [ ] Implementar campos de edição de metas em `src/components/TeamMembersSettingsTab.tsx`.
- [ ] Criar a visão analítica `TeamGoalsReportTab.tsx` integrada em `src/components/ReportsView.tsx`.
- [ ] Adicionar indicador de progresso no `TeamPulseWidget.tsx` para administradores e gestores.
- [ ] Exibir meta e progresso pessoal no `TimerView.tsx` para o colaborador logado.
- [ ] Validar controle de acesso (membros comuns não podem ver nem editar metas de outros membros).

---

## 5. Critérios de Aceite

1. **Permissões Rígidas**: Apenas o Dono (`owner`) e Administradores (`admin`) do workspace conseguem definir as metas e visualizar o painel geral da equipe.
2. **Precisão de Cálculo**: Horas decimais são calculadas com exatidão matemática (ex: 1 hora e 30 minutos = 1.5 horas).
3. **Filtros Temporais Fluidos**: Alternar entre "Hoje" e "Esta Semana" atualiza instantaneamente as métricas sem recarregar a página.
4. **Respeito ao Layout**: Não há quebra de layout em telas menores ou dispositivos móveis.
