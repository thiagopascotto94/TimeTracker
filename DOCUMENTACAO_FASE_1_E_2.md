# Manual Técnico e Operacional de Faturamento & Recorrência: Fase 1 e Fase 2

> **Projeto:** Cronos Time Tracker & AI Billing System  
> **Versão:** 2.0.0  
> **Escopo:** Documentação consolidada dos recursos, arquitetura, rotas, regras de negócio, integrações com Stripe e procedimentos operacionais das **Fases 1 e 2**.

---

## Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Fase 1: Modelagem de Dados, Planos, Quotas e Travas de Limite](#2-fase-1-modelagem-de-dados-planos-quotas-e-travas-de-limite)
   - [2.1 Estrutura do Banco de Dados](#21-estrutura-do-banco-de-dados)
   - [2.2 Matriz Oficial de Planos e Limites](#22-matriz-oficial-de-planos-e-limites)
   - [2.3 Motor de Consulta e Auditoria de Quotas](#23-motor-de-consulta-e-auditoria-de-quotas)
   - [2.4 Middlewares e Travas Ativas de Bloqueio](#24-middlewares-e-travas-ativas-de-bloqueio)
   - [2.5 Proteção contra Criação Indevida nas Ferramentas de IA](#25-proteção-contra-criação-indevida-nas-ferramentas-de-ia)
3. [Fase 2: Gateway de Pagamentos Stripe, Recorrência e Webhooks](#3-fase-2-gateway-de-pagamentos-stripe-recorrência-e-webhooks)
   - [3.1 Variáveis de Ambiente e Credenciais](#31-variáveis-de-ambiente-e-credenciais)
   - [3.2 Inicialização Segura do Stripe SDK (Lazy Loading)](#32-inicialização-segura-do-stripe-sdk-lazy-loading)
   - [3.3 Stripe Checkout Recorrente (Mensal e Anual)](#33-stripe-checkout-recorrente-mensal-e-anual)
   - [3.4 Modo de Simulação Local (Dev / Testes)](#34-modo-de-simulação-local-dev--testes)
   - [3.5 Stripe Customer Portal](#35-stripe-customer-portal)
   - [3.6 Webhook do Stripe: Processamento de Eventos em Tempo Real](#36-webhook-do-stripe-processamento-de-eventos-em-tempo-real)
   - [3.7 Ciclo de Vida: Cancelamento, Reativação e Downgrade Automático](#37-ciclo-de-vida-cancelamento-reativação-e-downgrade-automático)
   - [3.8 Histórico e Emissão de Faturas](#38-histórico-e-emissão-de-faturas)
4. [Interface do Usuário (Frontend)](#4-interface-do-usuário-frontend)
   - [4.1 Componentes e Recursos Disponibilizados](#41-componentes-e-recursos-disponibilizados)
   - [4.2 Ferramenta de Teste de Webhooks Integrada](#42-ferramenta-de-teste-de-webhooks-integrada)
5. [Guia de Configuração no Stripe Dashboard (Passo a Passo)](#5-guia-de-configuração-no-stripe-dashboard-passo-a-passo)
6. [Referência Completa de Endpoints da API](#6-referência-completa-de-endpoints-da-api)
7. [Resolução de Problemas Frequentes (FAQ & Troubleshooting)](#7-resolução-de-problemas-frequentes-faq--troubleshooting)

---

## 1. Visão Geral da Arquitetura

O sistema de faturamento e monetização do **Cronos** foi concebido em duas etapas complementares:

```
+-----------------------------------------------------------------------------------+
|                                  CRONOS WORKSPACE                                 |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|   [ FASE 1: Core de Quotas & Planos ]       [ FASE 2: Recorrência & Gateway ]    |
|   - Planos Free, Pro e Team                 - Stripe Checkout Recorrente         |
|   - Controles de membros, clientes, MB      - Suporte a Ciclos Mensal e Anual    |
|   - Middlewares de bloqueio na API          - Stripe Customer Portal             |
|   - Validação em Tools de IA (Kilo/Gemini)  - Webhook com assinatura cripto      |
|   - Métricas em tempo real                  - Downgrade automático por expiração |
|                                             - Histórico completo de Faturas      |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
                              +-----------------------+
                              |      STRIPE API       |
                              |  (PCI-DSS Compliant)  |
                              +-----------------------+
```

- **Fase 1**: Estabeleceu as bases do modelo de dados multi-tenant, tabelas de planos, subscrições e faturas, cálculo de utilização em relação a limites e interrupção graciosa de requisições excedentes.
- **Fase 2**: Implementou o gateway de pagamento **Stripe**, gerando sessões de checkout seguras, portal do cliente para gestão de métodos de pagamento, recebimento de webhooks assinados, automação de downgrade por término de ciclo contratado e histórico de faturas para o usuário.

---

## 2. Fase 1: Modelagem de Dados, Planos, Quotas e Travas de Limite

### 2.1 Estrutura do Banco de Dados

A persistência utiliza Sequelize com abstração para SQLite (desenvolvimento/produção em contêiner) ou PostgreSQL. As tabelas centrais do módulo de faturamento são:

#### Tabela `plans`
Armazena a definição estática dos planos comercializados.
- `id` (PK, string): Identificador único (`free`, `pro`, `team`).
- `name` (string): Nome legível (`Free`, `Pro`, `Team`).
- `description` (text): Descrição dos benefícios.
- `price_monthly` (float): Valor mensal em BRL (ex.: `0`, `49.0`, `149.0`).
- `price_yearly` (float): Valor anual em BRL (ex.: `0`, `490.0`, `1490.0`).
- `max_users` (integer): Limite de membros (`1`, `5`, `25`).
- `max_clients` (integer): Limite de clientes (`3`, `25`, `100`).
- `max_storage_mb` (integer): Limite de armazenamento (`500`, `10240`, `51200`).
- `features` (text JSON): Lista de itens e recursos inclusos.
- `is_active` (boolean): Disponibilidade para contratação.

#### Tabela `subscriptions`
Registra o estado da assinatura de cada Tenant.
- `id` (PK, UUID): Identificador da assinatura.
- `tenant_id` (FK, string): Workspace assinante.
- `plan_id` (FK, string): Plano associado.
- `status` (string): Estado atual (`active`, `trialing`, `past_due`, `canceled`, `unpaid`).
- `current_period_start` (datetime): Início do ciclo atual faturado.
- `current_period_end` (datetime): Fim do ciclo atual faturado.
- `cancel_at_period_end` (boolean): Flag indicando se o cancelamento ocorrerá ao fim do ciclo.
- `cancel_at` (datetime | null): Timestamp programado para o cancelamento.
- `canceled_at` (datetime | null): Timestamp do cancelamento efetivo.
- `gateway` (string): Gateway responsável (`stripe`, `stripe_simulated`, `manual`).
- `gateway_subscription_id` (string | null): ID da assinatura no Stripe (`sub_...`).
- `gateway_customer_id` (string | null): ID do cliente no Stripe (`cus_...`).
- `payment_method_brand` (string | null): Bandeira do cartão (`visa`, `mastercard`, etc.).
- `payment_method_last4` (string | null): Últimos 4 dígitos do cartão.
- `payment_method_exp_month` (integer | null): Mês de expiração do cartão.
- `payment_method_exp_year` (integer | null): Ano de expiração do cartão.

#### Tabela `invoices`
Mantém o histórico financeiro e recibos emitidos para o workspace.
- `id` (PK, UUID): Identificador interno da fatura.
- `tenant_id` (FK, string): Workspace pagador.
- `subscription_id` (FK, string | null): Assinatura relacionada.
- `gateway_invoice_id` (string | null): ID no Stripe (`in_...`).
- `amount` (float): Valor cobrado em Reais.
- `currency` (string): Moeda da cobrança (`brl`).
- `status` (string): Status da fatura (`paid`, `pending`, `failed`, `void`).
- `billing_reason` (string | null): Motivo da emissão (`subscription_create`, `subscription_cycle`).
- `invoice_pdf` (string | null): Link direto para o PDF da fatura oficial do Stripe.
- `hosted_invoice_url` (string | null): Link para a página de recibo e pagamento no Stripe.
- `paid_at` (datetime | null): Data da confirmação do pagamento.
- `period_start` (datetime | null): Data de início do período coberto.
- `period_end` (datetime | null): Data final do período coberto.

---

### 2.2 Matriz Oficial de Planos e Limites

| Recurso / Métrica | Plano Free | Plano Pro | Plano Team |
| :--- | :--- | :--- | :--- |
| **Preço Mensal** | R$ 0,00 | R$ 49,00 / mês | R$ 149,00 / mês |
| **Preço Anual** | R$ 0,00 | R$ 490,00 / ano *(17% OFF)* | R$ 1.490,00 / ano *(17% OFF)* |
| **Membros da Equipe** | Até 1 usuário | Até 5 usuários | Até 25 usuários |
| **Clientes Cadastrados** | Até 3 clientes | Até 25 clientes | Até 100 clientes |
| **Armazenamento de Anexos** | 500 MB | 10 GB (10.240 MB) | 50 GB (51.200 MB) |
| **Relatórios e Histórico** | Básico (30 dias) | Ilimitado + Exportação Excel/PDF | Ilimitado + Multi-equipe |
| **IA Cronos Assistant** | Mensagens de texto básicas | Análise Semântica de Commits + OCR | IA Dedicada, Prioritária e Multimodal |
| **Integrações Git** | 1 repositório | Repositórios Ilimitados | Repositórios Ilimitados + Permissões por Membro |

---

### 2.3 Motor de Consulta e Auditoria de Quotas

A função central `/server/billing.ts -> getTenantBillingStatus(tenantId)` realiza em tempo de execução:

1. **Auditoria de Downgrade Automático**: Se o workspace possuir uma assinatura com `cancel_at_period_end: true` e a data atual for posterior a `current_period_end`, o sistema atualiza a assinatura para `canceled` e restaura o plano do Tenant para `free`.
2. **Contagem de Recursos em Uso**:
   - `User.count({ where: { tenant_id } })`
   - `Client.count({ where: { tenant_id } })`
   - `calculateTenantStorageMb(tenantId)`: Varredura de arquivos anexos e comprovantes em disco/banco.
3. **Determinação de Permissões Booleanas**:
   - `can_create_client = currentClients < maxClients` (ou se ilimitado `-1`).
   - `can_create_user = currentUsers < maxUsers` (ou se ilimitado `-1`).
   - `can_upload_storage = currentStorage < maxStorageMb` (ou se ilimitado `-1`).
4. **Retorno Formatado**:
   ```typescript
   {
     plan: { id, name, price_monthly, ... },
     subscription: { status, current_period_end, cancel_at_period_end, ... },
     usage: {
       users: { current: 1, max: 5, percentage: 20, unlimited: false },
       clients: { current: 3, max: 25, percentage: 12, unlimited: false },
       storage_mb: { current: 12, max: 10240, percentage: 0.1, unlimited: false }
     },
     can_create_client: true,
     can_create_user: true,
     can_upload_storage: true,
     is_stripe_configured: true,
     available_plans: [...]
   }
   ```

---

### 2.4 Middlewares e Travas Ativas de Bloqueio

Para garantir a integridade das cotas contratadas, foram desenvolvidos middlewares e guardas de rota no backend:

- **Middleware `enforcePlanLimit(resource)`**:
  - Intercepta chamadas de criação de recursos (`POST /api/clients`, `POST /api/team/invites`, etc.).
  - Consulta `getTenantBillingStatus(req.tenantId)`.
  - Se a cota estiver estourada, retorna HTTP 403 com payload padronizado:
    ```json
    {
      "error": "Limite de clientes atingido para o plano Free (3/3). Faça upgrade para continuar cadastrando.",
      "plan_limit_exceeded": true,
      "resource": "clients",
      "current": 3,
      "max": 3
    }
    ```

---

### 2.5 Proteção contra Criação Indevida nas Ferramentas de IA

O Cronos possui um Assistente de Inteligência Artificial com chamada de ferramentas (Function Calling) via Gemini ou Kilo Gateway. Para impedir que o usuário burle as cotas do plano conversando com o robô (exemplo: *"Cronos, cadastre 10 novos clientes para mim"*):

- A ferramenta `create_client` em `/server/routes/ai.ts` verifica `billingStatus.can_create_client` antes de persistir o novo cliente.
- Caso o limite tenha sido atingido, a ferramenta rejeita a inserção e retorna uma instrução clara para a IA responder educadamente que o limite do plano foi atingido e orientar o upgrade no menu Faturamento.

---

## 3. Fase 2: Gateway de Pagamentos Stripe, Recorrência e Webhooks

### 3.1 Variáveis de Ambiente e Credenciais

No arquivo `.env` da aplicação, configure as variáveis necessárias:

```ini
# Chave Secreta da API do Stripe (Modo Teste ou Live)
STRIPE_SECRET_KEY=sk_test_51...

# Segredo de Assinatura do Webhook do Stripe
STRIPE_WEBHOOK_SECRET=whsec_...

# URL pública da aplicação (injetada automaticamente pelo AI Studio ou Cloud Run)
APP_URL=https://seu-dominio.com

# IDs de Preço dos Planos (Opcional - caso pré-configurados no Dashboard do Stripe)
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_TEAM_MONTHLY=price_...
STRIPE_PRICE_TEAM_YEARLY=price_...
```

---

### 3.2 Inicialização Segura do Stripe SDK (Lazy Loading)

Conforme as diretrizes de segurança da plataforma, o SDK do Stripe **nunca** é inicializado no carregamento do módulo. Em vez disso, é utilizado o padrão de carregamento sob demanda (`server/stripe.ts`):

```typescript
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return null;

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as any,
      typescript: true,
      appInfo: { name: 'Cronos Time & Billing', version: '2.0.0' },
    });
  }
  return stripeClient;
}
```

Isso evita falhas de boot caso o desenvolvedor ainda não tenha informado a `STRIPE_SECRET_KEY`.

---

### 3.3 Stripe Checkout Recorrente (Mensal e Anual)

O fluxo de contratação opera através da criação de uma sessão no Stripe Checkout (`createStripeCheckoutSession`):

1. **Localização ou Criação do Customer**:
   - O sistema verifica se o Tenant já tem um `gateway_customer_id` salvo na tabela `subscriptions`.
   - Se não existir, cria o Customer no Stripe enviando o nome do Tenant, e-mail do administrador e metadados (`tenant_id: ...`).
2. **Criação da Sessão de Checkout**:
   - `mode: 'subscription'`
   - `payment_method_types: ['card']`
   - `line_items`: Preço mensal (R$ 49 / R$ 149) ou anual com 17% de desconto (R$ 490 / R$ 1.490).
   - `success_url`: `{APP_URL}/?billing_success=true&session_id={CHECKOUT_SESSION_ID}`
   - `cancel_url`: `{APP_URL}/?billing_canceled=true`
   - `metadata`: `{ tenant_id: ..., plan_id: ..., interval: ... }`
3. **Redirecionamento**:
   - O frontend recebe `{ url: "https://checkout.stripe.com/c/pay/..." }` e direciona o usuário para a página segura e blindada do Stripe.

---

### 3.4 Modo de Simulação Local (Dev / Testes)

Quando `STRIPE_SECRET_KEY` não estiver presente no ambiente, a rota `POST /api/billing/create-checkout-session` ativa o **Modo de Simulação**:
- Promove o plano do Workspace de forma imediata.
- Simula a emissão da fatura inicial paga.
- Registra um cartão demonstrativo (`Mastercard final 4242`).
- Retorna uma mensagem de sucesso no frontend permitindo testar toda a interface de faturamento sem necessidade de cartões reais ou chaves de API.

---

### 3.5 Stripe Customer Portal

A rota `POST /api/billing/customer-portal` gera uma sessão autenticada no **Stripe Customer Portal**:
- Permite que o cliente altere seu cartão de crédito de renovação.
- Possibilita o download direto de notas fiscais e recibos em PDF emitidos pelo Stripe.
- Redireciona o usuário de volta para o Cronos após a conclusão das alterações.

---

### 3.6 Webhook do Stripe: Processamento de Eventos em Tempo Real

O webhook (`POST /api/billing/webhook`) é o coração da sincronização em produção. Ele opera publicamente (sem middleware de JWT) e valida a autenticidade criptográfica de cada requisição.

#### Captura do `rawBody`
Para que a validação da assinatura HMAC do Stripe funcione, o Express captura o buffer original da requisição antes da serialização JSON:

```typescript
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
```

#### Validação Criptográfica da Assinatura
```typescript
const sig = req.headers['stripe-signature'];
event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
```

#### Tratamento dos Eventos Críticos

| Evento Stripe | Ação no Cronos |
| :--- | :--- |
| `checkout.session.completed` | Atualiza o `plan_id` do Tenant, define a assinatura como `active`, registra datas do ciclo, captura dados do cartão e emite a primeira fatura paga em `invoices`. |
| `invoice.paid` / `invoice.payment_succeeded` | Garante que a assinatura permaneça `active`, avança o ciclo para os próximos 30 ou 365 dias e registra a nova fatura com link do recibo oficial. |
| `invoice.payment_failed` | Altera a assinatura para `past_due` (inadimplente), exibe alerta vermelho na tela do usuário para atualização do cartão e grava a fatura com status `failed`. |
| `customer.subscription.updated` | Sincroniza renovações de datas, flags de cancelamento (`cancel_at_period_end`) e status no Stripe. |
| `customer.subscription.deleted` | Executa o **Downgrade Automático**: define a assinatura como `canceled` e restaura o `plan_id` do Tenant para `free`. |

---

### 3.7 Ciclo de Vida: Cancelamento, Reativação e Downgrade Automático

O sistema oferece total flexibilidade e conformidade com os direitos do consumidor:

1. **Cancelamento no Final do Período (Recomendado)**:
   - Ao solicitar o cancelamento, a flag `cancel_at_period_end` é marcada como `true` no Stripe e no banco local.
   - O usuário **mantém acesso integral** aos recursos do plano pago até a data final do ciclo vigente (`current_period_end`).
   - Um aviso amarelo informativo é exibido na aba de Faturamento informando o término programado.
2. **Reativação da Assinatura**:
   - Enquanto o período pago estiver em vigor, o usuário pode clicar em **Reativar Plano** a qualquer momento.
   - O sistema remove a instrução de cancelamento no Stripe (`cancel_at_period_end = false`) e a renovação automática volta a operar normalmente.
3. **Cancelamento Imediato**:
   - Caso o usuário opte expressamente por rescisão imediata, o plano é rebaixado instantaneamente para `free` e as cotas são travadas de imediato.
4. **Auditoria Contínua de Expiração**:
   - Sempre que qualquer requisição de faturamento é disparada, o método `getTenantBillingStatus` verifica se a data atual superou `current_period_end`. Em caso positivo e se o cancelamento estava programado, o downgrade para `free` é consolidado sem depender exclusivamente da chegada do webhook.

---

### 3.8 Histórico e Emissão de Faturas

Na tabela de Faturas (`invoices`), o sistema armazena o histórico completo de transações:
- **Identificador**: ID interno e ID original do Stripe (`in_...`).
- **Valor e Moeda**: Formatado em moeda local (BRL).
- **Status**: Visualizado por badges de cores distintas:
  - `Pago` (Verde): Cobrança realizada com sucesso.
  - `Pendente` (Amarelo): Aguardando compensação.
  - `Falha` (Vermelho): Cartão recusado ou sem saldo.
- **Comprovante Externo**: Link direto para a página de fatura hospedada pelo Stripe (`hosted_invoice_url`) ou link do PDF oficial para escrituração contábil.

---

## 4. Interface do Usuário (Frontend)

O componente `BillingSettingsTab.tsx` (localizado em `Configurações -> Faturamento & Planos`) fornece uma experiência completa para o usuário:

### 4.1 Componentes e Recursos Disponibilizados

1. **Banner de Alerta Dinâmico**:
   - Sinaliza pendências de pagamento (`past_due`) com botão para regularizar no Stripe Portal.
   - Sinaliza cancelamento agendado com data de término e botão de reativação imediata.
2. **Card de Plano Ativo & Status de Quotas**:
   - Indicador do plano vigente com botão de sincronização manual com o Stripe.
   - Três barras de progresso (gauges) com percentual de consumo em tempo real:
     - Membros da Equipe (`usage.users`).
     - Clientes Cadastrados (`usage.clients`).
     - Armazenamento em MB (`usage.storage_mb`).
3. **Card do Cartão de Pagamento**:
   - Exibição visual estilizada com bandeira, dígitos finais (`•••• 4242`) e data de validade.
   - Botão direto para o **Stripe Customer Portal**.
   - Selo de segurança e conformidade PCI-DSS.
4. **Seletor de Planos com Toggle Mensal / Anual**:
   - Alternador de periodicidade com destaque visual de **-17% OFF** na modalidade anual.
   - Cards comparativos dos planos Free, Pro e Team listando todos os limites e recursos inclusos.
   - Botões contextuais: "Plano Atual", "Assinar Pro via Stripe" e "Mudar para Free".
5. **Tabela de Histórico de Faturas**:
   - Tabela com data, descrição, valor, status e link para visualização de recibo/PDF.
6. **Modal de Confirmação de Cancelamento**:
   - Explica didaticamente as regras de cancelamento ao fim do ciclo versus cancelamento imediato.

---

### 4.2 Ferramenta de Teste de Webhooks Integrada

Na parte inferior da aba de Faturamento, há uma seção dedicada a testes e homologação para desenvolvedores:
- **Simular Pagamento Pro (`checkout.session.completed`)**: Dispara a ativação do plano Pro e cria uma fatura de teste.
- **Simular Renovação Team (`invoice.paid`)**: Dispara a renovação de um ciclo do plano Team.
- **Simular Cancelamento Total & Downgrade (`customer.subscription.deleted`)**: Dispara o rebaixamento automático para o plano Free.

---

## 5. Guia de Configuração no Stripe Dashboard (Passo a Passo)

Para colocar a integração em produção ou em modo de testes reais no Stripe:

### Passo 1: Obter a Chave Secreta
1. Acesse o [Stripe Dashboard](https://dashboard.stripe.com/).
2. No canto superior direito, ative a opção **Test mode** (para testes) ou mantenha desmarcado para produção.
3. Acesse **Developers** &rarr; **API keys**.
4. Copie a **Secret key** (começa com `sk_test_...` ou `sk_live_...`).
5. Insira no arquivo `.env`: `STRIPE_SECRET_KEY=sk_...`.

### Passo 2: Configurar o Webhook
1. No menu lateral, acesse **Developers** &rarr; **Webhooks**.
2. Clique em **Add an endpoint**.
3. No campo **Endpoint URL**, insira:  
   `https://seu-dominio.com/api/billing/webhook`
4. Em **Select events to listen to**, selecione os seguintes eventos:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Salve o endpoint.
6. Clique em **Reveal signing secret** para copiar a chave `whsec_...`.
7. Insira no `.env`: `STRIPE_WEBHOOK_SECRET=whsec_...`.

### Passo 3: Ativar o Stripe Customer Portal
1. No Dashboard do Stripe, acesse **Settings** (ícone de engrenagem) &rarr; **Billing** &rarr; **Customer portal**.
2. Ative as opções:
   - *Allow customers to update payment methods* (Atualizar cartões).
   - *Allow customers to view invoice history* (Visualizar faturas e notas).
   - *Allow customers to cancel subscriptions* (Opcional - caso queira permitir pelo portal externo).
3. Clique em **Save changes**.

### Passo 4: Teste Local com Stripe CLI (Opcional)
Se estiver desenvolvendo em ambiente local na máquina:
```bash
# Login no Stripe via terminal
stripe login

# Encaminhar eventos recebidos para a porta local 3000
stripe listen --forward-to localhost:3000/api/billing/webhook
```
O terminal exibirá o segredo do webhook local para colocar na variável `STRIPE_WEBHOOK_SECRET`.

---

## 6. Referência Completa de Endpoints da API

Todas as rotas (com exceção do Webhook) requerem o cabeçalho `Authorization: Bearer <TOKEN_JWT>`.

| Método | Rota | Descrição | Parâmetros / Body |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/billing/status` | Retorna status do plano, cotas consumidas, dados do cartão e limites | Nenhum |
| `GET` | `/api/billing/plans` | Lista todos os planos disponíveis para contratação | Nenhum |
| `GET` | `/api/billing/invoices` | Histórico de faturas do workspace autenticado | Nenhum |
| `POST` | `/api/billing/create-checkout-session` | Inicia o checkout no Stripe ou upgrade simulado | `{ "plan_id": "pro", "interval": "monthly" }` |
| `POST` | `/api/billing/customer-portal` | Gera URL para o portal de gerenciamento de cartão do Stripe | Nenhum |
| `POST` | `/api/billing/cancel-subscription` | Cancela ou agenda cancelamento da assinatura | `{ "immediately": false }` |
| `POST` | `/api/billing/reactivate-subscription` | Reativa assinatura que estava marcada para cancelar | Nenhum |
| `POST` | `/api/billing/sync` | Força sincronização imediata com os servidores do Stripe | Nenhum |
| `POST` | `/api/billing/change-plan` | Troca manual direta de plano (ex.: downgrade para Free) | `{ "plan_id": "free" }` |
| `POST` | `/api/billing/webhook` | **Público**: Recebe eventos e atualizações do Stripe | Payload assinado pelo Stripe |
| `POST` | `/api/billing/simulate-webhook` | Ferramenta de teste para simular eventos de webhook | `{ "event_type": "checkout.session.completed", "plan_id": "pro" }` |

---

## 7. Resolução de Problemas Frequentes (FAQ & Troubleshooting)

### 1. O que acontece se o pagamento falhar na renovação?
O Stripe envia o evento `invoice.payment_failed`. O Cronos marca a assinatura como `past_due`. O usuário não perde os dados imediatamente, mas recebe um alerta visual de alta prioridade na interface com botão direto para atualizar o cartão no Customer Portal do Stripe.

### 2. Ao cancelar, o usuário perde o acesso imediatamente?
Por padrão, **não**. O cancelamento é registrado com `cancel_at_period_end = true`. O workspace continua desfrutando de todas as cotas e recursos do plano Pro ou Team até a data `current_period_end`. Somente após essa data ocorre o downgrade automático para o plano Free. Se o usuário marcar a opção de cancelamento imediato, o downgrade é aplicado no mesmo instante.

### 3. Como testar pagamentos sem gastar dinheiro real?
Utilize os botões de simulação presentes na parte inferior da aba de Faturamento ou use os cartões de teste oficiais do Stripe em modo de teste:
- **Número do Cartão de Teste:** `4242 4242 4242 4242`
- **Validade:** Qualquer data futura (ex.: `12/28`)
- **CVC:** Qualquer número de 3 dígitos (ex.: `123`)

### 4. O que acontece com os dados ao sofrer downgrade para o plano Free?
Nenhum cliente, projeto ou registro histórico é excluído. No entanto, as travas de limites impedem a inclusão de **novos** clientes ou novos membros até que a quantidade atual fique abaixo da quota do plano Free ou que um novo upgrade seja realizado.

---

*Documento gerado e homologado para a suíte de governança do Cronos Time Tracker & AI.*
