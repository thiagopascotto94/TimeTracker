# Etapa 01: Título Dinâmico na Aba e Atalhos de Teclado

## 1. Visão Geral & Problema
- **Problema**: Quando o usuário está trabalhando (em outra aba, pesquisando ou codificando), ele perde a visibilidade se o cronômetro do Cronos está rodando ou se esqueceu de iniciá-lo. Além disso, ter que usar o mouse a cada pausa/início gera micro-atrito.
- **Solução**: 
  1. Atualizar o `document.title` da aba do navegador em tempo real com o contador e o nome do cliente quando o timer estiver ativo (ex: `⏱️ 01:23:45 - Acme Inc. | Cronos`), retornando ao título padrão quando pausado ou parado.
  2. Implementar atalhos de teclado ergonômicos:
     - `Alt + S` ou `Shift + Espaço` (fora de campos de texto): Iniciar / Pausar timer.
     - `Escape`: Fechar modais abertos.
     - `Cmd/Ctrl + K`: Abertura rápida de busca/navegação.

## 2. Impacto na Avaliação (Pontuação)
- **Ganho**: +3 pontos no Score de UX.
- **Público**: Impacto imediato tanto para uso individual (freelancer focado) quanto para membros de equipe.

## 3. Especificação Técnica & Arquitetura
- **Arquivos Afetados**:
  - `src/App.tsx`: Gerenciamento do estado global do timer ativo e efeito no `document.title`.
  - `src/components/TimerView.tsx`: Exposição do estado ou gatilhos de controle.
  - `src/hooks/useKeyboardShortcuts.ts` (Novo Hook reutilizável): Listener centralizado para atalhos sem colidir com inputs de texto/textarea.
- **Regras de Comportamento**:
  - Quando timer rodando: `document.title = "⏱️ ${formatTime(elapsed)} - ${clientName || 'Sem Cliente'} | Cronos"`.
  - Quando pausado: `document.title = "⏸️ Pausado (${formatTime(elapsed)}) | Cronos"`.
  - Quando parado: `document.title = "Cronos - Gerenciador Inteligente de Tempo e Produtividade"`.
  - Desativar atalhos globais se o usuário estiver digitando em `<input>`, `<textarea>` ou `contenteditable`.

## 4. Checklist de Implementação
- [x] Criar hook ou handler para sincronização do `document.title`.
- [x] Implementar formatação compacta de tempo (`HH:MM:SS`).
- [x] Adicionar suporte a atalho `Alt + S` / `Shift + Space` para Play/Pause.
- [x] Adicionar dica visual discreta na interface (tooltip *"Dica: Pressione Alt + S para iniciar/pausar"*).
- [x] Testar no tema claro e escuro, garantindo ausência de memory leaks de `requestAnimationFrame` ou `setInterval`.

## 5. Critérios de Aceite
1. O título da aba reflete o tempo exato com ícone indicador enquanto o timer corre em segundo plano.
2. Não há descompasso com abas inativas ou congeladas.
3. Teclas de atalho funcionam instantaneamente e nunca interrompem a digitação em campos de texto.
