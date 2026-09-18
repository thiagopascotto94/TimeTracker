# 🗺️ Roadmap SaaS — TimeTracker → Produto

Roadmap para transformar o projeto TimeTracker em um produto SaaS com assinatura.

**Data de criação:** 2026-09-16
**Versão:** 1.0

---

## Fase 0 — Fundação (Semanas 1-2)

**Objetivo:** Preparar o terreno sem quebrar o que funciona.

- [ ] Criar tabela `plans` (free, pro, team) com limites (usuários, clientes, storage)
- [ ] Adicionar coluna `plan_id` em `tenants`
- [ ] Criar tabela `subscriptions` (status, período, gateway)
- [ ] Implementar middleware de verificação de limites
- [ ] Adicionar endpoint `GET /api/billing/status` (uso atual vs limite)

---

## Fase 1 — Autenticação Real (Semanas 2-3)

**Objetivo:** Login seguro, recuperação de senha, convites.

- [ ] JWT com refresh tokens (já tem `jwt.ts` parcial — completar)
- [ ] Endpoint de recuperação de senha (`POST /api/auth/forgot-password`)
- [ ] Endpoint de reset de senha (`POST /api/auth/reset-password`)
- [ ] Envio de email (Resend ou SES)
- [ ] Convite por email (`POST /api/invites` + token de aceite)
- [ ] Aceite de convite (`POST /api/invites/:token/accept`)

---

## Fase 2 — Billing (Semanas 3-5)

**Objetivo:** Cobrar de forma recorrente.

- [ ] Integrar Stripe Checkout (ou Pagar.me)
- [ ] Webhook para confirmação de pagamento
- [ ] Sincronizar status da assinatura com `subscriptions`
- [ ] Downgrade automático ao cancelar
- [ ] Página de billing no frontend (gerenciar cartão, ver faturas)
- [ ] Bloqueio de funcionalidades ao atingir limites do plano

---

## Fase 3 — Multi-Workspace (Semanas 4-6)

**Objetivo:** Permitir que o usuário tenha vários workspaces.

- [ ] Tabela `workspace_members` (user_id, workspace_id, role)
- [ ] Trocar `tenant_id` → `workspace_id` nos models
- [ ] Seletor de workspace no frontend
- [ ] Isolamento total de dados por workspace
- [ ] Permissões por papel (owner/admin/member)

---

## Fase 4 — Migração PostgreSQL (Semanas 5-7)

**Objetivo:** Escalar para múltiplos usuários.

- [ ] Trocar SQLite → PostgreSQL (usar Sequelize, já suporta)
- [ ] Variáveis de ambiente para `DATABASE_URL`
- [ ] Migrations versionadas (em vez de `sync()`)
- [ ] Redis para sessões (substituir `MemoryStore`)
- [ ] Redis para cache de consultas frequentes

---

## Fase 5 — Infraestrutura (Semanas 6-8)

**Objetivo:** Deploy confiável e monitorado.

- [ ] Dockerfile + docker-compose (PostgreSQL + Redis + App)
- [ ] CI/CD simples (GitHub Actions → deploy automático)
- [ ] Monitoramento de erros (Sentry)
- [ ] Logs centralizados
- [ ] Backup automático do PostgreSQL (pg_dump diário)

---

## Fase 6 — Produto (Semanas 7-10)

**Objetivo:** Experiência de compra e uso.

- [ ] Landing page de vendas
- [ ] Onboarding guiado (criar primeiro workspace, primeiro timer)
- [ ] Tour interativo (apresentar features)
- [ ] Notificações (timer finalizado, meta atingida)
- [ ] Exportação de relatórios (PDF, CSV)

---

## Fase 7 — Integrações (Semanas 9-12)

**Objetivo:** Aumentar o valor percebido.

- [ ] Slack (notificações e slash commands)
- [ ] Google Calendar (sincronizar sessões como eventos)
- [ ] GitHub/GitHub Projects (importar issues como tarefas)
- [ ] Webhooks customizados (zapier-style)

---

## Fase 8 — Lançamento (Semanas 11-14)

**Objetivo:** Colocar no ar e começar a cobrar.

- [ ] Domínio próprio + Cloudflare
- [ ] Política de privacidade e termos de uso
- [ ] Criar conta no Stripe e configurar produtos
- [ ] Beta fechado (10-20 pessoas)
- [ ] Coletar feedback e iterar
- [ ] Lançamento público

---

## 📊 Priorização

| Prioridade | Fase | Por quê |
|------------|------|---------|
| **P0** | Fase 1 (Auth) | Sem login seguro, não há SaaS |
| **P0** | Fase 2 (Billing) | Sem cobrar, não é negócio |
| **P1** | Fase 4 (PostgreSQL) | SQLite vai travar rápido |
| **P1** | Fase 3 (Multi-workspace) | Essencial para equipes |
| **P2** | Fase 5 (Infra) | Necessário quando escalar |
| **P2** | Fase 6 (Produto) | Polimento para lançamento |
| **P3** | Fase 7 (Integrações) | Diferencial competitivo |

---

## 💰 Modelo de Preços Sugerido

| Plano | Preço | Limites |
|-------|-------|---------|
| **Free** | R$ 0 | 1 workspace, 3 clientes, 50 sessões/mês |
| **Pro** | R$ 29/mês | Workspaces ilimitados, clientes ilimitados, IA |
| **Team** | R$ 79/mês | Tudo de Pro + membros, permissões, integrações |
