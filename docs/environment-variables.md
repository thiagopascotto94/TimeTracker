# Documentação de Variáveis de Ambiente — Cronos

Este documento detalha todas as variáveis de ambiente (`.env`) suportadas pela aplicação Cronos, explicando a finalidade de cada uma, onde obter as credenciais necessárias e orientações para configuração em ambiente de produção (VPS de baixo desempenho com PM2, PostgreSQL e Redis).

---

## Sumário
1. [Configurações Básicas de Servidor](#1-configurações-básicas-de-servidor)
2. [Banco de Dados e Cache](#2-banco-de-dados-e-cache)
3. [Segurança e Autenticação](#3-segurança-e-autenticação)
4. [Inteligência Artificial (IA)](#4-inteligência-artificial-ia)
5. [Notificações e E-mails](#5-notificações-e-e-mails)
6. [Gateway de Pagamento (Stripe)](#6-gateway-de-pagamento-stripe)
7. [Monitoramento (Sentry)](#7-monitoramento-sentry)

---

## 1. Configurações Básicas de Servidor

| Variável | Descrição | Exemplo | Obrigatória |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Define o ambiente de execução (`production` ou `development`). | `production` | Sim |
| `PORT` | Porta TCP em que o servidor HTTP irá escutar. | `3000` | Sim |
| `APP_URL` | URL pública principal onde a aplicação está hospedada. | `https://meudominio.com` | Sim |

---

## 2. Banco de Dados e Cache

| Variável | Descrição | Onde Obter / Como Configurar | Obrigatória |
| :--- | :--- | :--- | :--- |
| `DB_DIALECT` | Dialect do banco (`postgres` para nuvem/produção ou `sqlite` local). | `postgres` | Sim (em prod) |
| `DATABASE_URL` | String de conexão completa do PostgreSQL. | Fornecido pelo seu provedor de banco em nuvem (Supabase, Neon, AWS RDS, etc.). | Sim (se postgres) |
| `DB_PATH` | Caminho do arquivo SQLite (caso utilize SQLite local). | `./database.sqlite` | Não |
| `REDIS_URL` | URL de conexão do Redis para sessões e cache. | Instalação local (`redis://localhost:6379`) ou Redis em nuvem (Redis Cloud, Upstash). | Não (possui fallback em memória) |

---

## 3. Segurança e Autenticação

| Variável | Descrição | Como Gerar / Obter | Obrigatória |
| :--- | :--- | :--- | :--- |
| `JWT_SECRET` | Chave secreta para assinar e validar tokens JWT de acesso. | Gere uma string aleatória segura (ex: `openssl rand -hex 32`). | Sim |
| `SESSION_SECRET` | Chave secreta para criptografar cookies de sessão do Express. | Gere uma string aleatória segura. | Sim |

---

## 4. Inteligência Artificial (IA)

A aplicação suporta múltiplos provedores de IA (Google Gemini oficial ou Kilo AI Gateway compatível com OpenAI).

| Variável | Descrição | Onde Obter | Obrigatória |
| :--- | :--- | :--- | :--- |
| `AI_PROVIDER` | Provedor preferencial (`gemini` ou `kilo`). | Defina conforme sua preferência. | Não |
| `GEMINI_API_KEY` | Chave da API oficial do Google Gemini. | [Google AI Studio](https://aistudio.google.com/) | Sim (se usar Gemini) |
| `KILO_API_KEY` | Chave de API do Kilo AI Gateway. | [Kilo AI Console](https://kilo.ai/) | Sim (se usar Kilo) |
| `KILO_MODEL` | Modelo de IA a ser invocado pelo Gateway. | Ex: `anthropic/claude-3-5-sonnet`, `openai/gpt-4o`, `google/gemini-2.5-flash`. | Não |
| `KILO_BASE_URL` | URL base da API do Kilo Gateway. | `https://api.kilo.ai/api/gateway` | Não |

---

## 5. Notificações e E-mails

| Variável | Descrição | Onde Obter | Obrigatória |
| :--- | :--- | :--- | :--- |
| `RESEND_API_KEY` | Chave de API da Resend para disparo de e-mails transacionais (convites, recuperação de senha). | [Resend Dashboard](https://resend.com/) | Não |
| `RESEND_FROM` | Endereço de remetente verificado. | `Cronos <onboarding@resend.dev>` ou seu domínio verificado. | Não |

---

## 6. Gateway de Pagamento (Stripe)

| Variável | Descrição | Onde Obter | Obrigatória |
| :--- | :--- | :--- | :--- |
| `STRIPE_SECRET_KEY` | Chave secreta da API do Stripe (`sk_test_...` ou `sk_live_...`). | [Stripe Dashboard](https://dashboard.stripe.com/) -> Desenvolvedores -> Chaves de API | Sim (se usar Stripe) |
| `STRIPE_WEBHOOK_SECRET` | Segredo de assinatura para validar webhooks do Stripe (`whsec_...`). | Stripe Dashboard -> Webhooks -> Chave secreta de assinatura | Sim (se usar webhooks) |

---

## 7. Monitoramento (Sentry)

| Variável | Descrição | Onde Obter | Obrigatória |
| :--- | :--- | :--- | :--- |
| `SENTRY_DSN` | URL DSN para captura de erros e exceções em tempo real. | [Sentry.io](https://sentry.io/) -> Criar Projeto Node.js -> Configurações do Projeto -> Client Keys (DSN). | Não (Possui fallback com logs locais via Pino) |

---
*Nota: A aplicação possui tratamento de erros defensivo e fallbacks automáticos para serviços opcionais (como Sentry, Redis e Resend), garantindo estabilidade mesmo em servidores de baixo desempenho (low-end VPS).*
