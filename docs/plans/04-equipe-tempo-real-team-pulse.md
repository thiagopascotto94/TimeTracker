# Etapa 04: Equipe em Tempo Real (Team Pulse / Live Activity)

## 1. Visão Geral & Problema
- **Problema**: Em ambientes de equipe (agências, squads e empresas), o gestor ou colega de trabalho precisa saber: *"Quem está trabalhando agora e em qual projeto?"*. Hoje ele só vê dados históricos após a sessão ser encerrada ou gerando relatórios.
- **Solução**: 
  - Criar o recurso **Team Pulse**:
    1. Endpoint leve `GET /api/workspaces/:id/live-activity` que lista membros com sessão ativa no momento (`end_time IS NULL` ou `status = 'running'`).
    2. Widget elegante no topo da aba *Histórico* ou em um card colapsável no *Dashboard*:
       - Avatares com badge verde pulsante.
       - Nome do colaborador, tempo decorrido ao vivo (`00:42:15`), cliente e tarefa em andamento.
    3. Para planos individuais (Free/Pro de 1 usuário), o card é ocultado para não poluir quem trabalha sozinho.

## 2. Impacto na Avaliação (Pontuação)
- **Ganho**: +3 pontos no Score de UX.
- **Público**: Diferencial comercial definitivo para vendas do plano **Team**.

## 3. Especificação Técnica & Arquitetura
- **Arquivos Afetados**:
  - `server/routes/workspaces.ts`: Endpoint `/live-activity` consultando sessões ativas do workspace nos últimos X minutos.
  - `src/components/TeamPulseWidget.tsx` (Novo Componente): Card com atualização a cada 30 segundos (polling inteligente).
  - `src/components/HistoryView.tsx` ou `src/App.tsx`: Inclusão do widget na aba relevante.
  - `src/types.ts`: Interface `TeamMemberLiveActivity`.
- **Privacidade & Permissões**:
  - Respeita a regra de permissão: valores financeiros (`hourly_rate` e faturamento acumulado) só aparecem para quem tem `can_view_billing === true`. Membros comuns veem apenas o tempo e o projeto.

## 4. Checklist de Implementação
- [x] Criar endpoint no backend com cache leve e query otimizada em `TimeSession`.
- [x] Desenvolver `TeamPulseWidget.tsx` com microanimações e avatares visuais.
- [x] Adicionar filtro rápido no *Histórico*: clicar no avatar de um membro filtra imediatamente o histórico por aquele usuário.
- [x] Implementar verificação se o workspace possui mais de 1 membro antes de exibir o widget.

## 5. Critérios de Aceite
1. Quando um membro da equipe inicia o timer, outros membros com acesso ao workspace veem o status atualizado.
2. O widget não consome excesso de rede (polling espaçado e silencioso).
3. Usuários sem permissão de faturamento não veem valores monetários do colega.
