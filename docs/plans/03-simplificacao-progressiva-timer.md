# Etapa 03: Simplificação Progressiva do Timer (Progressive Disclosure)

## 1. Visão Geral & Problema
- **Problema**: O `TimerView` cresceu organicamente e hoje exibe simultaneamente:
  - Nome da tarefa e seleção de cliente.
  - Metas de tempo por sessão e meta diária do cliente.
  - Seleção de repositório Git, branches e commits.
  - Links de tarefas e anotações.
  Para um novo usuário ou colaborador que apenas precisa registrar suas horas do dia, a interface pode parecer sobrecarregada (*cognitive overload*).
- **Solução**: Aplicar o princípio de **Divulgação Progressiva (*Progressive Disclosure*)**:
  1. **Visão Essencial (Sempre Visível)**:
     - Input claro: *"Em que você está trabalhando agora?"*
     - Seletor de Cliente (com Quick Create da Etapa 02).
     - Display do cronômetro grande, limpo e legível com botões de Iniciar / Pausar / Parar.
  2. **Gaveta / Painel Retrátil de Opções Avançadas**:
     - Botão discreto em estilo pill/tag com badge: `⚙️ Detalhes & Git (+3 itens configurados)`.
     - Ao expandir (ou quando já houver dados vinculados), revela as seções de: Meta de tempo da sessão, Integração Git (repositório e branch) e Notas adicionais.
     - O estado de expansão pode ser lembrado via `localStorage` para desenvolvedores que sempre usam Git.

## 2. Impacto na Avaliação (Pontuação)
- **Ganho**: +3 pontos no Score de UX.
- **Público**: Torna o aplicativo agradável para não-desenvolvedores (gestores, designers, redatores) sem perder 1% da potência para programadores.

## 3. Especificação Técnica & Arquitetura
- **Arquivos Afetados**:
  - `src/components/TimerView.tsx`: Reestruturação do grid visual e inserção de colapsável animado com `motion/react`.
- **Hierarquia Visual Proposta**:
  - Topo: Barra com cliente selecionado + taxa horária aplicada + meta diária compacta.
  - Centro: Input principal de tarefa em destaque + Timer digital com micro-estados (inativo, gravando, pausado).
  - Abaixo do Timer: Linha de controles avançados (*"Vincular Git"*, *"Definir Meta"*, *"Adicionar Notas"*). Se nenhum estiver ativo, ficam em badges clicáveis compactas; ao clicar em qualquer um, a gaveta expande suavemente.

## 4. Checklist de Implementação
- [ ] Criar subcomponente ou estado `isAdvancedOptionsExpanded` no `TimerView.tsx`.
- [ ] Se houver branch ou meta ativa preenchida, manter a gaveta visível por padrão.
- [ ] Animar a expansão e o recolhimento usando `motion.div` com `AnimatePresence`.
- [ ] Garantir que em telas menores (mobile/smartphones) a tela continue extremamente limpa e com toques acessíveis (mínimo 44px de altura nos botões).

## 5. Critérios de Aceite
1. O usuário que quer apenas dar play não precisa ver 5 campos vazios irrelevantes para ele naquele momento.
2. Desenvolvedores que usam Git conseguem abrir as opções com 1 clique ou atalho, sem perder configurações salvas.
