import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';

/**
 * Kilo AI Gateway Configuration
 * Documentation: https://kilo.ai/docs/gateway
 *
 * The Kilo Gateway provides an OpenAI-compatible endpoint at https://api.kilo.ai/api/gateway
 * API Key and Model are configured via environment secrets:
 * - KILO_API_KEY
 * - KILO_MODEL
 * - KILO_BASE_URL (defaults to https://api.kilo.ai/api/gateway)
 */

export interface KiloGatewayConfig {
  apiKey: string;
  model: string;
  baseURL: string;
  isConfigured: boolean;
  hasModelSecret: boolean;
}

export function getKiloConfig(): KiloGatewayConfig {
  const apiKey = (process.env.KILO_API_KEY || '').trim();
  const model = (process.env.KILO_MODEL || '').trim();
  const rawBaseURL = (process.env.KILO_BASE_URL || 'https://api.kilo.ai/api/gateway').trim();
  // Remove trailing slash if present
  const baseURL = rawBaseURL.replace(/\/+$/, '');

  return {
    apiKey,
    model,
    baseURL,
    isConfigured: apiKey.length > 0,
    hasModelSecret: model.length > 0,
  };
}

let cachedClient: OpenAI | null = null;
let lastApiKey = '';
let lastBaseURL = '';

export function getKiloClient(): { client: OpenAI; model: string; baseURL: string } {
  const config = getKiloConfig();

  if (!config.isConfigured) {
    throw new Error(
      'Chave de API do Kilo Gateway não encontrada. Configure a secret KILO_API_KEY no painel de Secrets ou no arquivo .env.'
    );
  }

  if (!config.hasModelSecret) {
    throw new Error(
      'A secret do modelo não foi configurada. Configure a secret KILO_MODEL no painel de Secrets ou no arquivo .env (ex: anthropic/claude-3-5-sonnet, openai/gpt-4o, etc).'
    );
  }

  if (!cachedClient || lastApiKey !== config.apiKey || lastBaseURL !== config.baseURL) {
    lastApiKey = config.apiKey;
    lastBaseURL = config.baseURL;
    cachedClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      defaultHeaders: {
        'User-Agent': 'timetrack-kilo-gateway-client',
      },
    });
  }

  return {
    client: cachedClient,
    model: config.model,
    baseURL: config.baseURL,
  };
}

/**
 * OpenAI-compatible Tool Declarations for Kilo AI Gateway
 */
export const OPENAI_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_history',
      description:
        'Pesquisa o histórico de sessões de trabalho do usuário e workspace atual. Permite buscar por texto no título, observações da sessão (notes) ou tarefas/observações de tarefas, filtrar por cliente, período de datas e limite de registros.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Termo de busca para título da sessão, observações da sessão (notes) ou descrição/observações de tarefas.',
          },
          client_name: {
            type: 'string',
            description: 'Nome ou empresa do cliente para filtrar.',
          },
          start_date: {
            type: 'string',
            description: 'Data de início no formato YYYY-MM-DD.',
          },
          end_date: {
            type: 'string',
            description: 'Data de fim no formato YYYY-MM-DD.',
          },
          limit: {
            type: 'integer',
            description: 'Quantidade máxima de sessões a retornar (padrão 10, máximo 50).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_active_session',
      description:
        'Verifica se há um cronômetro / sessão de trabalho atualmente em execução para o usuário, retornando detalhes, tempo decorrido, cliente, observações da sessão (notes), token de relatório público e todas as tarefas registradas com suas observações (notes).',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_timer',
      description:
        'Inicia uma nova sessão de cronômetro de trabalho para o usuário no servidor. Registra o timestamp oficial e vincula opcionalmente a um cliente, observações da sessão (notes) ou sessão anterior.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Título ou objetivo principal da sessão de trabalho.',
          },
          notes: {
            type: 'string',
            description: 'Observações, briefing, links de referência ou anotações gerais da sessão de trabalho.',
          },
          target_minutes: {
            type: 'number',
            description: 'Meta de tempo em minutos (opcional).',
          },
          client_name: {
            type: 'string',
            description: 'Nome do cliente a ser vinculado (busca cliente existente no workspace).',
          },
          client_id: {
            type: 'string',
            description: 'ID exato do cliente se já conhecido.',
          },
          previous_session_id: {
            type: 'string',
            description: 'ID de uma sessão anterior para continuar ou retomar.',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_active_session',
      description:
        'Atualiza dados da sessão de cronômetro ativa em andamento (título, observações gerais da sessão notes, meta de minutos ou cliente associado).',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Novo título para a sessão ativa.',
          },
          notes: {
            type: 'string',
            description: 'Novas observações ou anotações gerais da sessão de trabalho.',
          },
          target_minutes: {
            type: 'number',
            description: 'Nova meta de tempo em minutos.',
          },
          client_name: {
            type: 'string',
            description: 'Nome do cliente para vincular ou alterar.',
          },
          client_id: {
            type: 'string',
            description: 'ID exato do cliente.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stop_timer',
      description:
        'Finaliza o cronômetro / sessão de trabalho ativa, calculando a duração final exata e o valor faturável com base na taxa horária do cliente. Permite registrar observações finais da sessão e/ou uma última tarefa realizada.',
      parameters: {
        type: 'object',
        properties: {
          notes: {
            type: 'string',
            description: 'Observações finais ou resumo geral para registrar na sessão de cronômetro.',
          },
          session_notes: {
            type: 'string',
            description: 'Observações da sessão a serem salvas permanentemente.',
          },
          final_task: {
            type: 'string',
            description: 'Descrição de uma tarefa final a ser registrada na sessão antes do encerramento (opcional).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_task_to_timer',
      description:
        'Adiciona uma nova tarefa à sessão de trabalho em andamento (ou a uma sessão específica informada por ID), com descrição e observações detalhadas opcionais (notes).',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Descrição da tarefa realizada ou em andamento.',
          },
          notes: {
            type: 'string',
            description: 'Observações detalhadas, contexto, links ou especificações sobre esta tarefa específica (notes).',
          },
          session_id: {
            type: 'string',
            description: 'ID da sessão onde adicionar a tarefa. Se omitido, adiciona à sessão ativa atual.',
          },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_multiple_tasks_to_timer',
      description:
        'Adiciona uma lista de múltiplas tarefas à sessão ativa de uma só vez (ideal para extração de listas de checklists ou imagens de quadros de tarefas). Suporta descrição e observações individuais.',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: {
                  type: 'string',
                  description: 'Descrição da tarefa.',
                },
                notes: {
                  type: 'string',
                  description: 'Observações detalhadas da tarefa (opcional).',
                },
              },
              required: ['description'],
            },
            description: 'Lista de tarefas a adicionar (objetos com descrição e observações ou strings).',
          },
          session_id: {
            type: 'string',
            description: 'ID da sessão onde adicionar. Se omitido, usa a sessão ativa.',
          },
        },
        required: ['tasks'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description:
        'Atualiza uma tarefa existente na sessão (alterando sua descrição e/ou suas observações detalhadas notes).',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'ID da tarefa a ser editada.',
          },
          description: {
            type: 'string',
            description: 'Nova descrição da tarefa.',
          },
          notes: {
            type: 'string',
            description: 'Novas observações ou anotações detalhadas da tarefa.',
          },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description:
        'Remove uma tarefa de uma sessão de cronômetro caso solicitado pelo usuário.',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'ID da tarefa a ser removida.',
          },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_public_report_link',
      description:
        'Gera e retorna o link público compartilhável do relatório da sessão para envio ao cliente (para conferência de horas, tarefas e observações em tempo real e aprovação).',
      parameters: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'ID da sessão de trabalho. Se omitido, busca da sessão ativa atual ou da última realizada.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_clients',
      description:
        'Lista todos os clientes cadastrados no workspace atual com suas respectivas taxas horárias, observações (notes) e detalhes de contatos para o portal.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Termo para filtrar por nome, empresa ou email.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_client',
      description:
        'Cadastra um novo cliente no workspace com nome, empresa, e-mail, taxa horária de faturamento e observações contratuais.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Nome do cliente ou contato.',
          },
          company: {
            type: 'string',
            description: 'Nome da empresa do cliente (opcional).',
          },
          email: {
            type: 'string',
            description: 'E-mail do cliente (opcional).',
          },
          hourly_rate: {
            type: 'number',
            description: 'Valor cobrado por hora para este cliente em R$ (ex: 180.00).',
          },
          notes: {
            type: 'string',
            description: 'Observações, particularidades ou escopo acordado com o cliente.',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_financial_summary',
      description:
        'Calcula o total de horas trabalhadas, total faturado acumulado e detalhamento por cliente em um período específico (hoje, semana atual, mês atual ou geral).',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'week', 'month', 'all'],
            description: 'Período para o resumo financeiro: "today", "week", "month" ou "all".',
          },
          client_name: {
            type: 'string',
            description: 'Filtrar faturamento por um cliente específico.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_session_title',
      description:
        'Analisa as tarefas e observações realizadas na sessão e gera uma sugestão de título inteligente e profissional, podendo aplicá-lo automaticamente.',
      parameters: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'ID da sessão. Se omitido, analisa a sessão ativa atual.',
          },
          auto_apply: {
            type: 'boolean',
            description: 'Se true, já atualiza automaticamente o título da sessão ativa.',
          },
        },
      },
    },
  },
];

export interface KiloChatParams {
  prompt: string;
  images?: Array<{ name: string; mimeType: string; data: string }>;
  systemInstruction: string;
  priorDbMessages: any[];
  maxSteps: number;
  tenantId: string;
  userId: string;
  hourlyRate: number;
  executeToolFn: (
    name: string,
    args: any,
    tenantId: string,
    userId: string,
    hourlyRate: number
  ) => Promise<{ result: any; sessionUpdated?: boolean; clientsUpdated?: boolean }>;
}

/**
 * Runs the autonomous function calling agentic loop with Kilo AI Gateway via OpenAI SDK
 * Supports up to maxSteps (e.g. 60 steps), multi-turn history and multimodal vision
 */
export async function runKiloAgenticChat({
  prompt,
  images,
  systemInstruction,
  priorDbMessages,
  maxSteps,
  tenantId,
  userId,
  hourlyRate,
  executeToolFn,
}: KiloChatParams) {
  const { client, model, baseURL } = getKiloClient();

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemInstruction },
  ];

  // Add previous conversational history
  for (const msg of priorDbMessages) {
    messages.push({
      role: msg.role === 'model' ? 'assistant' : 'user',
      content: msg.content,
    });
  }

  // Multimodal user content
  if (images && Array.isArray(images) && images.length > 0) {
    const contentParts: any[] = [];
    if (prompt && prompt.trim()) {
      contentParts.push({ type: 'text', text: prompt.trim() });
    }
    for (const img of images) {
      if (img.data && img.mimeType) {
        const base64Data = img.data.includes(',') ? img.data.split(',')[1] : img.data;
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${img.mimeType};base64,${base64Data}`,
          },
        });
      }
    }
    messages.push({
      role: 'user',
      content: contentParts,
    });
  } else {
    messages.push({
      role: 'user',
      content: prompt ? prompt.trim() : '',
    });
  }

  let stepsCount = 0;
  const executedSteps: Array<{
    step: number;
    tool: string;
    args: any;
    result: any;
    timestamp: string;
  }> = [];

  let hasSessionChanged = false;
  let hasClientsChanged = false;
  let finalModelText = '';

  while (stepsCount < maxSteps) {
    stepsCount++;

    const response = await client.chat.completions.create({
      model,
      messages,
      tools: OPENAI_TOOLS,
      tool_choice: 'auto',
    });

    const choice = response.choices?.[0];
    const message = choice?.message;

    if (!message) {
      throw new Error('Nenhuma resposta recebida do Kilo AI Gateway');
    }

    if (message.tool_calls && message.tool_calls.length > 0) {
      // Append assistant message containing tool calls
      messages.push(message);

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const toolName = toolCall.function.name;
        let toolArgs: any = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch (e) {
          console.warn(`Falha ao decodificar argumentos da ferramenta ${toolName}:`, toolCall.function.arguments);
        }

        const { result, sessionUpdated, clientsUpdated } = await executeToolFn(
          toolName,
          toolArgs,
          tenantId,
          userId,
          hourlyRate
        );

        if (sessionUpdated) hasSessionChanged = true;
        if (clientsUpdated) hasClientsChanged = true;

        executedSteps.push({
          step: stepsCount,
          tool: toolName,
          args: toolArgs,
          result,
          timestamp: new Date().toISOString(),
        });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    } else {
      finalModelText = message.content || '';
      break;
    }
  }

  if (!finalModelText && executedSteps.length > 0) {
    finalModelText = `Concluí as ações solicitadas com ${executedSteps.length} etapas executadas no sistema via Kilo Gateway.`;
  } else if (!finalModelText) {
    finalModelText = 'Olá! Como posso te ajudar com o seu cronômetro, histórico ou faturamento hoje?';
  }

  return {
    finalModelText,
    executedSteps,
    stepsCount,
    hasSessionChanged,
    hasClientsChanged,
    modelUsed: model,
    provider: 'kilo' as const,
    baseURL,
  };
}
