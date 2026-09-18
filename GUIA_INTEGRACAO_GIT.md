# Guia Completo de Integração Git: GitHub, GitLab (Cloud) e GitLab Self-Hosted

Este documento orienta passo a passo como obter as credenciais, tokens de acesso pessoal (PAT), URLs de instâncias e identificadores de projetos para conectar o **Cronos Time Tracker & Cronos AI** aos seus repositórios Git.

---

## Sumário
1. [Visão Geral e Segurança](#visão-geral-e-segurança)
2. [GitHub: Como Gerar o Personal Access Token (PAT)](#1-github-como-gerar-o-personal-access-token-pat)
3. [GitLab Cloud (gitlab.com): Como Gerar o Access Token](#2-gitlab-cloud-gitlabcom-como-gerar-o-access-token)
4. [GitLab Self-Hosted / On-Premise (Servidor Próprio)](#3-gitlab-self-hosted--on-premise-servidor-próprio)
5. [Alternativa Sem Token: Via Terminal Git (Logs e Diffs)](#4-alternativa-sem-token-via-terminal-git)
6. [Resolução de Dúvidas e Problemas Frequentes](#5-resolução-de-dúvidas-e-problemas-frequentes)

---

## Visão Geral e Segurança

O Cronos Time Tracker permite vincular automaticamente os commits e entregas de código realizadas pela equipe ou desenvolvedores freelancers às suas sessões de tempo de trabalho.

- **Por que conectar?** Para que a inteligência artificial (Cronos AI) analise as mensagens semânticas (`feat:`, `fix:`, `refactor:`) e o conteúdo do código entregue, sugerindo descrições claras de tarefas com cálculo automático de esforço.
- **Onde ficam os dados?** As credenciais e tokens são salvos com segurança no banco de dados isolado do seu workspace e são utilizados exclusivamente em chamadas autenticadas no servidor para ler histórico de commits.

---

## 1. GitHub: Como Gerar o Personal Access Token (PAT)

### Requisitos de Escopo
- Para repositórios **públicos**: Nenhum escopo específico é estritamente necessário (o token serve para eliminar o limite de requisições de 60/hora para 5.000/hora da API do GitHub).
- Para repositórios **privados** ou de organizações: Escopo `repo` (leitura completa do repositório).

### Passo a Passo
1. Acesse o GitHub: [https://github.com/settings/tokens](https://github.com/settings/tokens)
2. No menu lateral esquerdo, vá em:
   - **Developer settings** &rarr; **Personal access tokens** &rarr; **Tokens (classic)**
3. Clique em **Generate new token** &rarr; **Generate new token (classic)**.
4. Preencha os campos:
   - **Note:** `Cronos AI Tracker` (ou outro nome identificador).
   - **Expiration:** Selecione a validade desejada (ex.: 90 dias ou No expiration).
   - **Select scopes:** Marque a caixa `[x] repo` se você deseja ler commits de repositórios privados.
5. Role até o final da página e clique em **Generate token**.
6. **Copie imediatamente** a chave iniciada por `ghp_...` (o GitHub só exibirá esta chave uma única vez).
7. Cole no Cronos:
   - Acesse **Configurações &rarr; Integrações de Código & Git**
   - Selecione a aba **GitHub**
   - No campo **Repositório Padrão**, insira: `dono/repositorio` (ex: `facebook/react` ou a URL `https://github.com/facebook/react`)
   - Cole o token no campo **Personal Access Token**.

---

## 2. GitLab Cloud (gitlab.com): Como Gerar o Access Token

### Requisitos de Escopo
- Escopo recomendado: `read_api` (permite ler metadados do projeto, branches e commits).
- Alternativa: `read_repository` (leitura dos arquivos e histórico de commits).

### Passo a Passo
1. Acesse o GitLab: [https://gitlab.com/-/user_settings/personal_access_tokens](https://gitlab.com/-/user_settings/personal_access_tokens)
   *(Ou clique na sua foto de perfil no canto superior &rarr; **Preferences** &rarr; menu lateral **Access Tokens**)*.
2. Clique no botão **Add new token**.
3. Preencha os campos:
   - **Token name:** `Cronos Time Tracker`
   - **Expiration date:** Defina uma data de expiração futura.
   - **Select scopes:** Marque `[x] read_api` (ou `[x] read_repository`).
4. Clique em **Create personal access token**.
5. Copie o token iniciado por `glpat-...`.
6. No Cronos:
   - Selecione a aba **GitLab / Self-Hosted**
   - Selecione **GitLab Cloud (gitlab.com)**
   - No campo **Projeto / Repositório**, você pode informar:
     - O caminho do projeto: `grupo/projeto` ou `grupo/subgrupo/projeto`
     - A URL completa copiada do navegador: `https://gitlab.com/meu-grupo/meu-projeto`
     - O **ID Numérico do Projeto** (exibido na home do projeto no GitLab, ex: `2847294`)
   - Cole o token `glpat-...` no campo correspondente e clique em **Testar Conexão**.

---

## 3. GitLab Self-Hosted / On-Premise (Servidor Próprio)

Se a sua empresa utiliza uma instalação própria do GitLab (Community Edition ou Enterprise Edition) em servidores locais, VPS, nuvem privada (AWS, GCP, Azure) ou atrás de VPN corporativa:

### 1. URL da Instância
Informe a URL base em que sua equipe acessa o GitLab no navegador.
- **Formato correto:** `https://gitlab.suaempresa.com.br` ou `https://git.corp.meudominio.com`
- Se sua instalação utilizar porta customizada: `http://192.168.1.100:8080` ou `https://gitlab.local:8443`
- *Importante:* Não coloque barra (`/`) no final.

### 2. Onde Gerar o Token no Servidor Próprio
Acesse diretamente a rota de tokens da sua instância no navegador:
```
https://SEU_DOMINIO_GITLAB/-/user_settings/personal_access_tokens
```
Ou navegue por: **Avatar no canto superior &rarr; Preferences &rarr; Access Tokens &rarr; Add new token**.
- Marque os escopos `read_api` ou `read_repository`.
- Copie o token gerado.

### 3. Opção Recomendada: Project Access Token (Por Repositório)
Se você administra o projeto e prefere não usar um token pessoal vinculado à sua conta de usuário:
1. Abra o repositório específico no GitLab.
2. No menu lateral esquerdo do projeto, vá em **Settings** &rarr; **Access Tokens**.
3. Clique em **Add new token**:
   - **Token name:** `Cronos-Project-Token`
   - **Role:** `Reporter` (suficiente para leitura de código e commits)
   - **Scopes:** `[x] read_repository`
4. Clique em **Create project access token** e utilize o token gerado no Cronos.

### 4. Como Identificar o Projeto no GitLab Self-Hosted
O Cronos aceita qualquer um destes formatos:
- **ID Numérico do Projeto:** Acesse a home do projeto no GitLab. Logo abaixo do título estará escrito `Project ID: 1234`. Digite apenas `1234`.
- **Caminho com Namespaces:** `grupo/projeto` ou `departamento/squad/servico-api`.
- **URL Completa:** Cole a URL direta da barra de navegação (o Cronos extrai o host e o caminho automaticamente).

---

## 4. Alternativa Sem Token: Via Terminal Git

Se você não possui permissão para gerar tokens no repositório da empresa, ou prefere trabalhar de maneira 100% desconectada de APIs externas:

Você pode usar os comandos locais do Git no seu próprio computador e colar a saída na aba **"Colar Logs / Diff Manual"**:

### Comandos Rápidos Prontos para Uso

| Finalidade | Comando no Terminal Git | O que ele traz |
| :--- | :--- | :--- |
| **Histórico Completo** | `git log -n 5` | Mensagens, autor, data e hashes dos últimos 5 commits. |
| **Padrão Semântico** | `git log -n 10 --pretty=format:"%s"` | Lista limpa das mensagens de commit (`feat:`, `fix:`). |
| **Lista Rápida Oneline** | `git log -n 5 --oneline` | Hashes de 7 caracteres e títulos curtos. |
| **Diff com Estatísticas** | `git diff HEAD~1 HEAD --stat -p` | Resumo de arquivos alterados e patch das mudanças. |

O Cronos AI interpreta a formatação padrão do Git nativamente e estrutura as tarefas da mesma forma que faria via API!

---

## 5. Resolução de Dúvidas e Problemas Frequentes

### Erro 404 (Not Found)
- **GitHub:** Verifique se o nome do repositório está no formato `dono/nome-do-repositorio`. Se o repositório for privado, certifique-se de que o token informado possui o escopo `repo`.
- **GitLab:** Verifique se a URL da instância está correta e se o token possui acesso ao grupo/projeto. Em projetos privados, o escopo `read_api` ou `read_repository` é mandatório.

### Erro 401 (Unauthorized)
- O token informado expirou, foi revogado ou digitado com espaços extras. Gere um novo token e salve novamente.

### Limite de Taxa Excedido (Rate Limit)
- Ocorre na API pública do GitHub ao fazer múltiplas requisições sem autenticação. Adicionar qualquer token pessoal do GitHub resolve imediatamente, aumentando o limite para 5.000 requisições/hora.

### Instâncias Self-Hosted atrás de Firewall / VPN
- Como a requisição para listar commits é feita pelo servidor onde o Cronos está hospedado, o servidor do Cronos precisa ter resolução de DNS e conectividade de rede com a URL do GitLab fornecida.
- Se sua rede for 100% isolada e inacessível externamente, utilize a opção **"Colar Logs / Diff Manual"** via comando `git log -n 5`.
