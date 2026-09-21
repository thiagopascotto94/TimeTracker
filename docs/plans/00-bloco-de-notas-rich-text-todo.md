# Etapa 00: Bloco de Notas com Texto Rico, TODOs e Controle de Privacidade

> **Decisão de Arquitetura**:
> - **Localização**: Scratchpad Global do Workspace (Acesso direto via nova aba principal no menu e gaveta rápida no Timer).
> - **Formato**: Editor de Texto Rico / Markdown com Checklists Interativos (`[ ]` e `[x]`), barra de ferramentas de formatação rápida (Negrito, Itálico, Títulos H1/H2, Listas, Links, Código) e preview em tempo real.
> - **Visibilidade & Privacidade**: Suporte a alternância entre **Privado (Pessoal)** e **Compartilhado (Workspace)**.

---

## 1. Visão Geral & Problema
- **Cenário**: Usuários e equipes precisam de um espaço centralizado para rascunhar anotações de reuniões, registrar ideias, organizar listas de afazeres (TODOs) e pendências sem ter que sair do Cronos para abrir outro aplicativo (como Bloco de Notas, Notion ou Google Docs).
- **Solução**:
  - Um módulo completo de **Notas & TODO** com suporte a múltiplas notas/cadernos.
  - Editor visual com formatação instantânea (toolbar de texto rico) e suporte a markdown.
  - **Checklists Interativos**: caixas de seleção `[ ]` que podem ser clicadas diretamente no modo de leitura/edição para riscar tarefas concluídas com animação visual.
  - **Controle de Privacidade Granular**:
    - 🔒 **Nota Pessoal (Privada)**: Apenas o autor pode visualizar e editar.
    - 👥 **Nota do Workspace (Compartilhada)**: Todos os membros do workspace ativo podem ler e colaborar.
  - **Salvamento Automático (Auto-save)**: Debounced a cada 800ms sem necessidade de clicar em "Salvar".

---

## 2. Especificação Técnica & Arquitetura

### 2.1 Backend & Banco de Dados
- **Novo Modelo / Tabela `notes`**:
  ```typescript
  export interface NoteAttributes {
    id: string;
    tenant_id: string;
    workspace_id: string;
    user_id: string;
    title: string;
    content: string; // Markdown / Rich Text com suporte a [ ] e [x]
    is_workspace_shared: boolean; // false = privada do autor | true = equipe do workspace
    is_pinned?: boolean;
    created_at?: Date;
    updated_at?: Date;
  }
  ```
- **Endpoints de API (`/api/notes`)**:
  - `GET /api/notes`: Lista notas do workspace ativo (retorna as notas compartilhadas + notas privadas do usuário autenticado).
  - `POST /api/notes`: Cria uma nova nota (título, conteúdo inicial, status de privacidade).
  - `PUT /api/notes/:id`: Atualiza título, conteúdo ou privacidade (valida permissão: autor ou admin).
  - `DELETE /api/notes/:id`: Exclui a nota (valida permissão).
  - `PATCH /api/notes/:id/toggle-task`: Atualiza pontualmente um checklist sem conflito.

### 2.2 Frontend & UI/UX
- **Componentes**:
  - `src/components/NotesView.tsx`: Tela principal com barra lateral de notas (pesquisa, filtro por "Todas", "Pessoais", "Equipe"), botão "+ Nova Nota", e editor central.
  - `src/components/RichNoteEditor.tsx`: Editor com barra de ferramentas (Bold, Italic, H1, H2, Bullet List, Task/TODO List, Link, Code, Limpar) + modo Split / Preview interativo com `react-markdown` e `remark-gfm`.
  - Botão de acesso no cabeçalho/menu: **"Notas & TODO"** (ícone `FileText` / `CheckSquare`).
  - Botão de abertura rápida no Timer: para consultar notas sem pausar o cronômetro.

---

## 3. Checklist de Implementação por Etapas

### Fase 1: Modelo de Dados e Endpoints do Backend
- [ ] Criar modelo `Note` no Sequelize em `server/db.ts` com sincronização automática e índices (`workspace_id`, `user_id`, `is_workspace_shared`).
- [ ] Criar rotas `/api/notes` em `server/routes/notes.ts` com controle de permissão (privado vs. compartilhado).
- [ ] Conectar as rotas em `server.ts`.

### Fase 2: Editor com Texto Rico e Checklists Interativos
- [ ] Desenvolver `RichNoteEditor.tsx` com toolbar visual ergonômica.
- [ ] Integrar `react-markdown` + `remark-gfm` para renderizar caixas de seleção clicáveis (`<input type="checkbox">` interativo).
- [ ] Implementar auto-save com indicador de status discreto (*"Salvo"* / *"Salvando..."*).

### Fase 3: Visualização, Filtros e Navegação
- [ ] Criar tela `NotesView.tsx` com lista lateral de notas, busca em tempo real, badges de privacidade (🔒 Pessoal / 👥 Equipe).
- [ ] Adicionar aba no `Navbar.tsx` e no menu mobile.
- [ ] Adicionar suporte a alternar privacidade com 1 clique (toggle Privada $\leftrightarrow$ Workspace).

---

## 4. Critérios de Aceite
1. O usuário consegue criar, editar e excluir notas com título e corpo formatado.
2. É possível adicionar checklists de tarefas e marcar/desmarcar tarefas clicando nas caixas.
3. Notas privadas são invisíveis para outros membros da equipe no mesmo workspace.
4. Notas compartilhadas são visíveis e colaborativas para toda a equipe do workspace.
5. As alterações são salvas automaticamente sem perder foco ou conteúdo.
