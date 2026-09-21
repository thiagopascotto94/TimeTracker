# Etapa 02: Criação Rápida de Clientes Inline (Zero Friction)

## 1. Visão Geral & Problema
- **Problema**: O fluxo mais comum de um usuário é sentar para trabalhar e querer dar o *Play* imediatamente. Se ele precisa cronometrar para um cliente novo, é obrigado a interromper o fluxo mental, navegar até a aba *Clientes*, abrir um formulário completo, salvar e retornar ao *Timer*.
- **Solução**: 
  - Adicionar o recurso **"Quick Create"** diretamente no componente `ClientAutocomplete` e no `TimerView`.
  - Ao digitar um nome no campo de busca que não existe na lista, exibir no final do menu suspenso a opção:
    `➕ Criar cliente "[Nome Digitado]" (R$ 150,00/h padrão)`.
  - Com apenas 1 clique (ou pressionando `Enter`), o cliente é salvo no banco de dados com a taxa padrão do usuário/workspace e imediatamente selecionado no Timer, sem recarregar a tela.

## 2. Impacto na Avaliação (Pontuação)
- **Ganho**: +3 pontos no Score de UX.
- **Público**: Redução máxima de fricção (*Time-to-Value*) tanto para autônomos quanto para equipes que atendem dezenas de clientes ágeis.

## 3. Especificação Técnica & Arquitetura
- **Arquivos Afetados**:
  - `src/components/ClientAutocomplete.tsx`: Suporte à opção inline "+ Criar cliente", cálculo de correspondência e callback `onQuickCreate`.
  - `src/components/TimerView.tsx`: Conexão com o endpoint `POST /api/clients` e seleção imediata do novo cliente no estado.
  - `server/routes/clients.ts`: Garantir que criação rápida funcione com valores mínimos (apenas `name` obrigatório, herdando `default_hourly_rate` do workspace/usuário).
- **Tratamento de Erros e Feedback**:
  - Exibir pequeno spinner inline durante a criação (leva ~100ms).
  - Toast de sucesso com ação rápida opcional (*"Cliente criado. Deseja adicionar contatos ou detalhes mais tarde?"*).

## 4. Checklist de Implementação
- [x] Atualizar `ClientAutocomplete.tsx` para detectar quando a query digitada não possui match exato.
- [x] Renderizar item especial no rodapé do dropdown: `"+ Criar cliente 'X'..."`.
- [x] Implementar chamada assíncrona ao backend para cadastrar o cliente na organização ativa.
- [x] Selecionar o cliente retornado automaticamente no formulário do Timer.
- [x] Adicionar suporte a navegação por teclado (Enter para criar rápido).
- [x] Validar sanitização de caracteres e duplicidades de nomes.

## 5. Critérios de Aceite
1. O usuário digita qualquer nome novo no timer e pressiona Enter ou clica na sugestão inline.
2. O cliente é cadastrado e selecionado em menos de 1 segundo.
3. O timer pode ser iniciado imediatamente com o cliente já associado.
