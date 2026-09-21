# Etapa 05: Onboarding & Empty States Educativos (First-Time User Experience)

## 1. Visão Geral & Problema
- **Problema**: Quando um novo usuário cria uma conta (ou aceita um convite para um workspace zerado), ele encontra telas com tabelas vazias (*"Nenhum registro encontrado"*). Isso cria incerteza sobre o que fazer a seguir e aumenta a taxa de abandono do software.
- **Solução**:
  1. **Card de Boas-Vindas & Checklist de Primeiros Passos**:
     - Exibido no topo da tela do Timer até ser concluído ou dispensado com um clique:
       - [ ] **1. Cadastre seu primeiro cliente** (com botão que abre o modal ou foca no campo).
       - [ ] **2. Registre sua primeira sessão de tempo** (com botão que dispara o timer de teste).
       - [ ] **3. Explore seus relatórios ou convide um membro**.
     - Barra de progresso visual (0% -> 33% -> 66% -> 100%).
  2. **Empty States Ilustrados & com Chamada para Ação (CTA)**:
     - Na aba *Clientes*: em vez de lista vazia, ilustração elegante + botão *"Cadastrar Meu Primeiro Cliente"*.
     - Na aba *Histórico*: card explicativo ensinando como os registros são agrupados por dia e semana.
     - Na aba *Relatórios*: prévia interativa demonstrando o poder dos relatórios faturáveis.

## 2. Impacto na Avaliação (Pontuação)
- **Ganho**: +2 pontos no Score de UX.
- **Público**: Aumenta a retenção de novos clientes e simplifica o treinamento de colaboradores recém-convidados.

## 3. Especificação Técnica & Arquitetura
- **Arquivos Afetados**:
  - `src/components/OnboardingChecklist.tsx` (Novo Componente): Card colapsável com persistência de estado no perfil do usuário ou `localStorage`.
  - `src/components/ClientsView.tsx`, `src/components/HistoryView.tsx`, `src/components/ReportsView.tsx`: Refatoração dos blocos `items.length === 0` com componentes visuais `EmptyState` ricos em design.
- **Estilo Visual**:
  - Ícones refinados da biblioteca `lucide-react`.
  - Paleta neutra sofisticada, com botões de ação proeminentes.

## 4. Checklist de Implementação
- [ ] Criar componente genérico e reutilizável `EmptyState.tsx` em `src/components/ui/`.
- [ ] Criar `OnboardingChecklist.tsx` com detecção automática do estado da conta (se já possui clientes cadastrados e sessões existentes).
- [ ] Adicionar botão para fechar/ocultar permanentemente o checklist de onboarding caso o usuário prefira.
- [ ] Substituir mensagens textuais secas nas abas principais pelos novos Empty States.

## 5. Critérios de Aceite
1. Um usuário recém-criado entende o próximo passo em menos de 5 segundos ao olhar para a tela.
2. Cada Empty State oferece um botão direto que executa a ação esperada sem exigir navegação manual.
