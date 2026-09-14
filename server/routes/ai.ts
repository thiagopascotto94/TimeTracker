import { Router, Response } from 'express';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { Op } from 'sequelize';
import crypto from 'crypto';
import { TimeSession, Task, Client, User, AiMessage, ClientContact } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../auth';
import { getKiloConfig, getKiloClient, runKiloAgenticChat } from '../kilo';

export const aiRouter = Router();

aiRouter.use(authMiddleware);

// GET /api/ai/provider - Returns active and configured AI providers
aiRouter.get('/provider', (req: AuthenticatedRequest, res: Response) => {
  const kiloConfig = getKiloConfig();
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  const preferred = (process.env.AI_PROVIDER || '').toLowerCase();

  let activeProvider = 'none';
  if (preferred === 'kilo' && kiloConfig.isConfigured) {
    activeProvider = 'kilo';
  } else if (preferred === 'gemini' && !!geminiApiKey) {
    activeProvider = 'gemini';
  } else if (kiloConfig.isConfigured) {
    activeProvider = 'kilo';
  } else if (geminiApiKey) {
    activeProvider = 'gemini';
  }

  res.json({
    activeProvider,
    kilo: {
      isConfigured: kiloConfig.isConfigured,
      hasModelSecret: kiloConfig.hasModelSecret,
      model: kiloConfig.model || null,
      baseURL: kiloConfig.baseURL,
      docsUrl: 'https://kilo.ai/docs/gateway',
    },
    gemini: {
      isConfigured: !!geminiApiKey,
      defaultModel: 'gemini-3.8-flash',
    },
  });
});

// GET /api/ai/models - List available models from active provider
aiRouter.get('/models', async (req: AuthenticatedRequest, res: Response) => {
  const kiloConfig = getKiloConfig();
  if (kiloConfig.isConfigured) {
    try {
      const { client, model } = getKiloClient();
      // Try to query Kilo /models endpoint
      const list = await client.models.list();
      const models = list.data.map((m: any) => ({
        id: m.id,
        name: m.id,
        provider: 'kilo',
      }));
      return res.json({
        provider: 'kilo',
        configuredModel: model,
        models,
      });
    } catch (err: any) {
      // If fetching list fails (or requires specific permissions), return configured secret model
      return res.json({
        provider: 'kilo',
        configuredModel: kiloConfig.model,
        models: kiloConfig.model ? [{ id: kiloConfig.model, name: kiloConfig.model, provider: 'kilo' }] : [],
      });
    }
  }

  res.json({
    provider: 'gemini',
    models: [
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Rápido e Preciso)' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (Ultrarrápido)' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Raciocínio Avançado)' },
    ],
  });
});

// POST /api/ai/suggest-title
// Sugere um título conciso e profissional para a sessão com base nas tarefas e no cliente
aiRouter.post('/suggest-title', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, tasks: inputTasks, currentTitle, clientName: inputClientName } = req.body || {};
    let taskList: string[] = Array.isArray(inputTasks) ? inputTasks.filter(Boolean) : [];
    let clientName: string = inputClientName || '';
    let existingTitle: string = currentTitle || '';

    // Se sessionId for enviado, complementa buscando tarefas e cliente no banco de dados
    if (sessionId) {
      const session = await TimeSession.findOne({
        where: { id: sessionId, tenant_id: req.tenantId! },
        include: [
          { model: Task, as: 'Tasks' },
          { model: Client, as: 'Client' },
        ],
      });
      if (session) {
        if (taskList.length === 0 && (session as any).Tasks) {
          taskList = (session as any).Tasks.map((t: any) => t.description).filter(Boolean);
        }
        if (!clientName && (session as any).Client?.name) {
          clientName = (session as any).Client.name;
        }
        if (!existingTitle && session.title) {
          existingTitle = session.title;
        }
      }
    }

    if (taskList.length === 0) {
      return res.status(400).json({
        error: 'Nenhuma tarefa registrada nesta sessão para sugerir um título com base nelas.',
      });
    }

    const tasksFormatted = taskList.map((t, idx) => `${idx + 1}. ${t}`).join('\n');
    const prompt = `Você é um especialista em produtividade, time tracking e gestão de projetos.
Analise a seguinte lista de tarefas concluídas durante uma sessão de trabalho:
${tasksFormatted}
${clientName ? `Cliente associado: ${clientName}` : ''}
${existingTitle ? `Título provisório anterior: ${existingTitle}` : ''}

Objetivo: Gere um título único, conciso, direto e profissional em Português do Brasil para esta sessão de trabalho (máximo de 3 a 7 palavras).
Regras estritas:
1. Resuma a essência das atividades de forma executiva (exemplos: "Desenvolvimento de APIs e Ajustes no Frontend", "Alinhamento de Requisitos e Planejamento de Sprint", "Correção de Bugs e Deploy").
2. Retorne APENAS o título sugerido em texto puro.
3. NÃO use aspas, NÃO adicione prefixos como "Título:", NÃO coloque ponto final, e NÃO dê nenhuma explicação.`;

    const kiloConfig = getKiloConfig();
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    const preferred = (process.env.AI_PROVIDER || '').toLowerCase();

    let suggestedTitle = '';

    // 1. Tenta Kilo se configurado e preferido
    if ((preferred === 'kilo' || !geminiApiKey) && kiloConfig.isConfigured) {
      try {
        const { client, model } = getKiloClient();
        const completion = await client.chat.completions.create({
          model: model || 'gemini-3.8-flash',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        });
        suggestedTitle = completion.choices?.[0]?.message?.content?.trim() || '';
      } catch (kiloErr) {
        console.warn('Kilo suggest-title failed, fallback to Gemini:', kiloErr);
      }
    }

    // 2. Tenta Gemini com chave de API
    if (!suggestedTitle && geminiApiKey) {
      try {
        const ai = getGenAI();
        const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
        for (const m of candidateModels) {
          try {
            const resp = await ai.models.generateContent({
              model: m,
              contents: prompt,
            });
            const text = resp.text?.trim();
            if (text) {
              suggestedTitle = text;
              break;
            }
          } catch (modelErr) {
            console.warn(`Model ${m} failed in suggest-title:`, modelErr);
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini suggest-title failed:', geminiErr);
      }
    }

    // 3. Fallback inteligente baseado em regras se a IA estiver indisponível
    if (!suggestedTitle) {
      if (taskList.length === 1) {
        suggestedTitle = taskList[0].slice(0, 50);
      } else if (taskList.length > 1) {
        suggestedTitle = `${taskList[0].slice(0, 25)} e ${taskList[1].slice(0, 25)}`;
      } else {
        suggestedTitle = existingTitle || 'Sessão de Trabalho';
      }
    }

    // Remove aspas ou prefixos indesejados
    suggestedTitle = suggestedTitle
      .replace(/^["'`“”«»]+|["'`“”«»]+$/g, '')
      .replace(/^(título|titulo|sugestão|sugestao):\s*/i, '')
      .trim();

    return res.json({
      suggestedTitle,
      tasksCount: taskList.length,
    });
  } catch (err: any) {
    console.error('Error in suggest-title:', err);
    return res.status(500).json({ error: 'Erro ao sugerir título com IA', details: err.message });
  }
});


// Lazy initialization of GoogleGenAI client (following system skill guidelines)
let currentApiKey: string | null = null;
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('Chave de API do Gemini não configurada no servidor. Defina GEMINI_API_KEY no arquivo .env ou no painel de Secrets.');
  }
  if (!aiClient || currentApiKey !== apiKey) {
    currentApiKey = apiKey;
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Function Declarations for Gemini Tool Calling
const searchHistoryDeclaration: FunctionDeclaration = {
  name: 'search_history',
  description:
    'Pesquisa o histórico de sessões de trabalho do usuário e tenant atual. Permite buscar por texto no título, observações da sessão (notes) ou descrição/observações de tarefas, filtrar por cliente, período de datas e limite.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Termo de busca para título da sessão, observações da sessão (notes) ou tarefas/observações de tarefas.',
      },
      client_name: {
        type: Type.STRING,
        description: 'Nome ou empresa do cliente para filtrar.',
      },
      start_date: {
        type: Type.STRING,
        description: 'Data de início no formato YYYY-MM-DD.',
      },
      end_date: {
        type: Type.STRING,
        description: 'Data de fim no formato YYYY-MM-DD.',
      },
      limit: {
        type: Type.INTEGER,
        description: 'Quantidade máxima de sessões a retornar (padrão 10, máximo 50).',
      },
    },
  },
};

const getActiveSessionDeclaration: FunctionDeclaration = {
  name: 'get_active_session',
  description:
    'Verifica se há um cronômetro / sessão de trabalho atualmente em execução, retornando detalhes completos: tempo decorrido, meta, cliente, observações da sessão (notes), token de compartilhamento público e todas as tarefas registradas com suas respectivas observações (notes).',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const startTimerDeclaration: FunctionDeclaration = {
  name: 'start_timer',
  description:
    'Inicia uma nova sessão de cronômetro de trabalho para o usuário no servidor. Registra o timestamp oficial e vincula opcionalmente a um cliente, observações preliminares da sessão e sessão anterior.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Título ou objetivo principal da sessão de trabalho.',
      },
      notes: {
        type: Type.STRING,
        description: 'Observações, briefing, links de referência ou anotações gerais da sessão de trabalho.',
      },
      target_minutes: {
        type: Type.NUMBER,
        description: 'Meta de tempo em minutos (opcional).',
      },
      client_name: {
        type: Type.STRING,
        description: 'Nome do cliente a ser vinculado (busca cliente existente no workspace).',
      },
      client_id: {
        type: Type.STRING,
        description: 'ID exato do cliente se já conhecido.',
      },
      previous_session_id: {
        type: Type.STRING,
        description: 'ID de uma sessão anterior para vincular como continuação de projeto.',
      },
    },
    required: ['title'],
  },
};

const updateActiveSessionDeclaration: FunctionDeclaration = {
  name: 'update_active_session',
  description:
    'Atualiza dados da sessão de cronômetro ativa em andamento, permitindo alterar o título, as observações gerais da sessão (notes), meta de minutos ou associar a um cliente.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Novo título para a sessão de cronômetro ativa.',
      },
      notes: {
        type: Type.STRING,
        description: 'Novas observações ou anotações gerais da sessão de trabalho.',
      },
      target_minutes: {
        type: Type.NUMBER,
        description: 'Nova meta de tempo em minutos.',
      },
      client_name: {
        type: Type.STRING,
        description: 'Nome do cliente para vincular ou alterar na sessão ativa.',
      },
      client_id: {
        type: Type.STRING,
        description: 'ID exato do cliente.',
      },
    },
  },
};

const stopTimerDeclaration: FunctionDeclaration = {
  name: 'stop_timer',
  description:
    'Finaliza a sessão de cronômetro atualmente ativa, preenchendo o horário de término e calculando a duração total e valor a faturar. Permite registrar observações finais da sessão e/ou uma última tarefa realizada.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      notes: {
        type: Type.STRING,
        description: 'Observações finais ou resumo geral para registrar na sessão de cronômetro.',
      },
      session_notes: {
        type: Type.STRING,
        description: 'Observações da sessão a serem gravadas permanentemente.',
      },
      final_task: {
        type: Type.STRING,
        description: 'Descrição de uma tarefa final a ser registrada na sessão antes do encerramento (opcional).',
      },
    },
  },
};

const addTaskToTimerDeclaration: FunctionDeclaration = {
  name: 'add_task_to_timer',
  description:
    'Adiciona uma tarefa ou anotação de atividade realizada à sessão ativa (ou específica), com descrição e observações detalhadas opcionais (notes).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      description: {
        type: Type.STRING,
        description: 'Descrição da tarefa ou atividade realizada.',
      },
      notes: {
        type: Type.STRING,
        description: 'Observações detalhadas, contexto, links ou especificações sobre esta tarefa específica.',
      },
      session_id: {
        type: Type.STRING,
        description: 'ID da sessão. Se omitido, adiciona à sessão ativa atual.',
      },
    },
    required: ['description'],
  },
};

const addMultipleTasksToTimerDeclaration: FunctionDeclaration = {
  name: 'add_multiple_tasks_to_timer',
  description:
    'Adiciona múltiplas tarefas em lote para a sessão ativa (ou especificada). Suporta itens com descrição e observações individuais (notes).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tasks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            description: {
              type: Type.STRING,
              description: 'Descrição da tarefa.',
            },
            notes: {
              type: Type.STRING,
              description: 'Observações ou detalhes da tarefa (opcional).',
            },
          },
          required: ['description'],
        },
        description: 'Lista de tarefas a adicionar (cada uma contendo descrição e observações opcionais).',
      },
      session_id: {
        type: Type.STRING,
        description: 'ID da sessão. Se omitido, usa a sessão em andamento.',
      },
    },
    required: ['tasks'],
  },
};

const updateTaskDeclaration: FunctionDeclaration = {
  name: 'update_task',
  description:
    'Atualiza uma tarefa já existente em uma sessão, permitindo alterar sua descrição e/ou suas observações detalhadas (notes).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      task_id: {
        type: Type.STRING,
        description: 'ID da tarefa a ser editada.',
      },
      description: {
        type: Type.STRING,
        description: 'Nova descrição da tarefa.',
      },
      notes: {
        type: Type.STRING,
        description: 'Novas observações ou anotações detalhadas da tarefa.',
      },
    },
    required: ['task_id'],
  },
};

const deleteTaskDeclaration: FunctionDeclaration = {
  name: 'delete_task',
  description:
    'Remove uma tarefa de uma sessão de cronômetro caso o usuário solicite.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      task_id: {
        type: Type.STRING,
        description: 'ID da tarefa a ser removida.',
      },
    },
    required: ['task_id'],
  },
};

const getPublicReportLinkDeclaration: FunctionDeclaration = {
  name: 'get_public_report_link',
  description:
    'Gera e retorna o link público compartilhável do relatório da sessão para envio ao cliente (para conferência em tempo real e aprovação de horas, tarefas e observações).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      session_id: {
        type: Type.STRING,
        description: 'ID da sessão de trabalho. Se omitido, busca da sessão ativa atual ou da última sessão realizada.',
      },
    },
  },
};

const listClientsDeclaration: FunctionDeclaration = {
  name: 'list_clients',
  description:
    'Lista os clientes cadastrados no workspace com taxas horárias, observações (notes) e contatos/responsáveis cadastrados para o portal.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Filtro por nome, empresa ou email do cliente.',
      },
    },
  },
};

const createClientDeclaration: FunctionDeclaration = {
  name: 'create_client',
  description:
    'Cadastra um novo cliente no workspace tenant atual com taxa horária personalizada e observações contratuais.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: 'Nome do cliente ou responsável.',
      },
      company: {
        type: Type.STRING,
        description: 'Nome da empresa ou organização.',
      },
      email: {
        type: Type.STRING,
        description: 'Email de contato.',
      },
      hourly_rate: {
        type: Type.NUMBER,
        description: 'Taxa horária específica em Reais (R$/h).',
      },
      notes: {
        type: Type.STRING,
        description: 'Observações gerais, escopo acordado ou particularidades do cliente.',
      },
    },
    required: ['name'],
  },
};

const getFinancialSummaryDeclaration: FunctionDeclaration = {
  name: 'get_financial_summary',
  description:
    'Calcula o resumo financeiro consolidado de horas trabalhadas e faturamento estimado do usuário no tenant atual.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      period: {
        type: Type.STRING,
        description: 'Período para o resumo: "today", "week", "month" ou "all" (padrão "all").',
      },
    },
  },
};

const suggestSessionTitleDeclaration: FunctionDeclaration = {
  name: 'suggest_session_title',
  description:
    'Analisa as tarefas realizadas e observações registradas na sessão ativa e gera uma sugestão de título inteligente e profissional, podendo aplicá-lo automaticamente.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      session_id: {
        type: Type.STRING,
        description: 'ID da sessão. Se omitido, analisa a sessão ativa atual.',
      },
      auto_apply: {
        type: Type.BOOLEAN,
        description: 'Se true, já atualiza automaticamente o título da sessão ativa com o título sugerido.',
      },
    },
  },
};

const AI_TOOLS = [
  searchHistoryDeclaration,
  getActiveSessionDeclaration,
  startTimerDeclaration,
  updateActiveSessionDeclaration,
  stopTimerDeclaration,
  addTaskToTimerDeclaration,
  addMultipleTasksToTimerDeclaration,
  updateTaskDeclaration,
  deleteTaskDeclaration,
  getPublicReportLinkDeclaration,
  listClientsDeclaration,
  createClientDeclaration,
  getFinancialSummaryDeclaration,
  suggestSessionTitleDeclaration,
];

// Tool Execution Handler with Strict Multi-Tenant Isolation
async function executeTool(
  toolName: string,
  args: any,
  tenantId: string,
  userId: string,
  userHourlyRate: number
): Promise<{ result: any; sessionUpdated?: boolean; clientsUpdated?: boolean }> {
  switch (toolName) {
    case 'get_active_session': {
      const active = await TimeSession.findOne({
        where: { tenant_id: tenantId, user_id: userId, end_time: null },
        include: [
          { model: Task, as: 'Tasks' },
          { model: Client, as: 'Client' },
        ],
      });

      if (!active) {
        return { result: { active: false, message: 'Nenhuma sessão de cronômetro está em andamento no momento.' } };
      }

      const startTime = new Date(active.start_time).getTime();
      const now = Date.now();
      const elapsedMinutes = Math.floor((now - startTime) / 60000);
      const rate = active.Client?.hourly_rate || userHourlyRate;
      const billable = Number(((elapsedMinutes / 60) * rate).toFixed(2));

      return {
        result: {
          active: true,
          id: active.id,
          title: active.title,
          notes: active.notes || null,
          start_time: active.start_time,
          target_minutes: active.target_minutes,
          elapsed_minutes: elapsedMinutes,
          estimated_billable: `R$ ${billable.toFixed(2)}`,
          client: active.Client ? { id: active.Client.id, name: active.Client.name, company: active.Client.company } : null,
          public_token: active.public_token || null,
          public_report_url: active.public_token ? `/shared/${active.public_token}` : null,
          tasks_count: active.Tasks?.length || 0,
          tasks: active.Tasks?.map((t) => ({
            id: t.id,
            description: t.description,
            notes: t.notes || null,
          })) || [],
        },
      };
    }

    case 'start_timer': {
      // Check existing
      const existing = await TimeSession.findOne({
        where: { tenant_id: tenantId, user_id: userId, end_time: null },
      });

      if (existing) {
        return {
          result: {
            error: 'Já existe uma sessão em andamento',
            current_active_session: {
              id: existing.id,
              title: existing.title,
              notes: existing.notes || null,
              start_time: existing.start_time,
            },
            instruction: 'Você pode finalizar a sessão atual com stop_timer antes de iniciar uma nova, atualizar com update_active_session ou adicionar tarefas nela.',
          },
        };
      }

      let resolvedClientId = args.client_id || null;
      if (!resolvedClientId && args.client_name) {
        const found = await Client.findOne({
          where: {
            tenant_id: tenantId,
            [Op.or]: [
              { name: { [Op.like]: `%${args.client_name.trim()}%` } },
              { company: { [Op.like]: `%${args.client_name.trim()}%` } },
            ],
          },
        });
        if (found) {
          resolvedClientId = found.id;
        }
      }

      let prevSession = null;
      if (args.previous_session_id) {
        prevSession = await TimeSession.findOne({
          where: { id: args.previous_session_id, tenant_id: tenantId },
        });
      }

      const serverStartTime = new Date();
      const publicToken = crypto.randomBytes(16).toString('hex');

      const created = await TimeSession.create({
        tenant_id: tenantId,
        user_id: userId,
        client_id: resolvedClientId || (prevSession ? prevSession.client_id : null),
        title: args.title?.trim() || (prevSession ? `Continuação: ${prevSession.title}` : 'Sessão de Foco'),
        notes: args.notes ? String(args.notes).trim() : null,
        start_time: serverStartTime,
        end_time: null,
        target_minutes: args.target_minutes ? Number(args.target_minutes) : null,
        previous_session_id: prevSession ? prevSession.id : null,
        public_token: publicToken,
      });

      return {
        result: {
          success: true,
          message: 'Cronômetro iniciado com sucesso no servidor!',
          session: {
            id: created.id,
            title: created.title,
            notes: created.notes,
            start_time: created.start_time,
            target_minutes: created.target_minutes,
            client_id: created.client_id,
            public_report_url: `/shared/${publicToken}`,
          },
        },
        sessionUpdated: true,
      };
    }

    case 'update_active_session': {
      const active = await TimeSession.findOne({
        where: { tenant_id: tenantId, user_id: userId, end_time: null },
        include: [{ model: Client, as: 'Client' }],
      });

      if (!active) {
        return { result: { error: 'Nenhuma sessão de cronômetro ativa no momento para atualizar.' } };
      }

      if (args.title !== undefined && typeof args.title === 'string' && args.title.trim()) {
        active.title = args.title.trim();
      }

      if (args.notes !== undefined) {
        active.notes = typeof args.notes === 'string' ? args.notes.trim() || null : null;
      }

      if (args.target_minutes !== undefined) {
        active.target_minutes = args.target_minutes ? Number(args.target_minutes) : null;
      }

      if (args.client_name) {
        const found = await Client.findOne({
          where: {
            tenant_id: tenantId,
            [Op.or]: [
              { name: { [Op.like]: `%${args.client_name.trim()}%` } },
              { company: { [Op.like]: `%${args.client_name.trim()}%` } },
            ],
          },
        });
        if (found) {
          active.client_id = found.id;
        }
      } else if (args.client_id !== undefined) {
        active.client_id = args.client_id || null;
      }

      await active.save();

      return {
        result: {
          success: true,
          message: 'Sessão ativa atualizada com sucesso!',
          session: {
            id: active.id,
            title: active.title,
            notes: active.notes,
            target_minutes: active.target_minutes,
            client_id: active.client_id,
          },
        },
        sessionUpdated: true,
      };
    }

    case 'stop_timer': {
      const active = await TimeSession.findOne({
        where: { tenant_id: tenantId, user_id: userId, end_time: null },
        include: [{ model: Task, as: 'Tasks' }, { model: Client, as: 'Client' }],
      });

      if (!active) {
        return { result: { error: 'Nenhuma sessão em andamento encontrada para finalizar.' } };
      }

      const serverEndTime = new Date();
      active.end_time = serverEndTime;

      // Update session notes if provided
      const sessionNoteToSave = args.session_notes || args.notes;
      if (sessionNoteToSave && typeof sessionNoteToSave === 'string' && sessionNoteToSave.trim()) {
        active.notes = sessionNoteToSave.trim();
      }

      await active.save();

      // If a final task description was provided, add it
      if (args.final_task && typeof args.final_task === 'string' && args.final_task.trim()) {
        await Task.create({
          tenant_id: tenantId,
          time_session_id: active.id,
          description: args.final_task.trim(),
        });
      }

      const durationMs = serverEndTime.getTime() - new Date(active.start_time).getTime();
      const durationMin = Math.round(durationMs / 60000);
      const rate = active.Client?.hourly_rate || userHourlyRate;
      const billable = ((durationMin / 60) * rate).toFixed(2);

      return {
        result: {
          success: true,
          message: 'Sessão finalizada com sucesso!',
          session: {
            id: active.id,
            title: active.title,
            notes: active.notes,
            duration_minutes: durationMin,
            end_time: serverEndTime,
            total_billable: `R$ ${billable}`,
            public_report_url: active.public_token ? `/shared/${active.public_token}` : null,
          },
        },
        sessionUpdated: true,
      };
    }

    case 'add_task_to_timer': {
      let targetSessionId = args.session_id;
      if (!targetSessionId) {
        const active = await TimeSession.findOne({
          where: { tenant_id: tenantId, user_id: userId, end_time: null },
        });
        if (!active) {
          return {
            result: {
              error: 'Não há sessão ativa em andamento. Inicie o cronômetro com start_timer primeiro ou forneça um session_id.',
            },
          };
        }
        targetSessionId = active.id;
      } else {
        const existing = await TimeSession.findOne({
          where: { id: targetSessionId, tenant_id: tenantId },
        });
        if (!existing) {
          return { result: { error: 'Sessão especificada não encontrada neste workspace.' } };
        }
      }

      const newTask = await Task.create({
        tenant_id: tenantId,
        time_session_id: targetSessionId,
        description: args.description.trim(),
        notes: args.notes ? String(args.notes).trim() : null,
      });

      return {
        result: {
          success: true,
          message: 'Tarefa registrada com sucesso na sessão de trabalho!',
          task: {
            id: newTask.id,
            description: newTask.description,
            notes: newTask.notes,
            time_session_id: targetSessionId,
          },
        },
        sessionUpdated: true,
      };
    }

    case 'add_multiple_tasks_to_timer': {
      const rawTasks = Array.isArray(args.tasks) ? args.tasks : [];
      if (rawTasks.length === 0) {
        return { result: { error: 'Nenhuma tarefa informada para adicionar.' } };
      }

      let targetSessionId = args.session_id;
      if (!targetSessionId) {
        const active = await TimeSession.findOne({
          where: { tenant_id: tenantId, user_id: userId, end_time: null },
        });
        if (!active) {
          return {
            result: {
              error: 'Nenhuma sessão ativa encontrada. Inicie o cronômetro com start_timer antes de adicionar tarefas.',
            },
          };
        }
        targetSessionId = active.id;
      } else {
        const existing = await TimeSession.findOne({
          where: { id: targetSessionId, tenant_id: tenantId },
        });
        if (!existing) {
          return { result: { error: 'Sessão especificada não encontrada neste workspace.' } };
        }
      }

      const createdTasks = [];
      for (const item of rawTasks) {
        let desc = '';
        let itemNotes: string | null = null;
        if (typeof item === 'string') {
          desc = item.trim();
        } else if (item && typeof item === 'object') {
          desc = String(item.description || item.task || '').trim();
          itemNotes = item.notes ? String(item.notes).trim() : null;
        }

        if (desc) {
          const t = await Task.create({
            tenant_id: tenantId,
            time_session_id: targetSessionId,
            description: desc,
            notes: itemNotes,
          });
          createdTasks.push({ id: t.id, description: t.description, notes: t.notes });
        }
      }

      return {
        result: {
          success: true,
          added_count: createdTasks.length,
          message: `${createdTasks.length} tarefas adicionadas com sucesso à sessão de trabalho!`,
          tasks: createdTasks,
        },
        sessionUpdated: true,
      };
    }

    case 'update_task': {
      if (!args.task_id) {
        return { result: { error: 'O parâmetro task_id é obrigatório.' } };
      }

      const task = await Task.findOne({
        where: { id: args.task_id, tenant_id: tenantId },
      });

      if (!task) {
        return { result: { error: 'Tarefa não encontrada neste workspace.' } };
      }

      if (args.description !== undefined && typeof args.description === 'string' && args.description.trim()) {
        task.description = args.description.trim();
      }

      if (args.notes !== undefined) {
        task.notes = typeof args.notes === 'string' ? args.notes.trim() || null : null;
      }

      await task.save();

      return {
        result: {
          success: true,
          message: 'Tarefa atualizada com sucesso!',
          task: {
            id: task.id,
            description: task.description,
            notes: task.notes,
          },
        },
        sessionUpdated: true,
      };
    }

    case 'delete_task': {
      if (!args.task_id) {
        return { result: { error: 'O parâmetro task_id é obrigatório.' } };
      }

      const task = await Task.findOne({
        where: { id: args.task_id, tenant_id: tenantId },
      });

      if (!task) {
        return { result: { error: 'Tarefa não encontrada.' } };
      }

      await task.destroy();

      return {
        result: {
          success: true,
          message: 'Tarefa removida com sucesso da sessão!',
        },
        sessionUpdated: true,
      };
    }

    case 'get_public_report_link': {
      let session = null;
      if (args.session_id) {
        session = await TimeSession.findOne({
          where: { id: args.session_id, tenant_id: tenantId },
          include: [{ model: Client, as: 'Client' }, { model: Task, as: 'Tasks' }],
        });
      } else {
        // Tenta sessão ativa
        session = await TimeSession.findOne({
          where: { tenant_id: tenantId, user_id: userId, end_time: null },
          include: [{ model: Client, as: 'Client' }, { model: Task, as: 'Tasks' }],
        });

        // Se não houver ativa, busca a mais recente
        if (!session) {
          session = await TimeSession.findOne({
            where: { tenant_id: tenantId, user_id: userId },
            order: [['start_time', 'DESC']],
            include: [{ model: Client, as: 'Client' }, { model: Task, as: 'Tasks' }],
          });
        }
      }

      if (!session) {
        return { result: { error: 'Nenhuma sessão encontrada para gerar o link do relatório.' } };
      }

      if (!session.public_token) {
        session.public_token = crypto.randomBytes(16).toString('hex');
        await session.save();
      }

      const publicPath = `/shared/${session.public_token}`;

      return {
        result: {
          success: true,
          session_id: session.id,
          session_title: session.title,
          session_notes: session.notes || null,
          client: session.Client ? session.Client.name : 'Geral (sem cliente)',
          tasks_count: session.Tasks?.length || 0,
          public_token: session.public_token,
          public_url: publicPath,
          message: `Link público gerado: ${publicPath}. O cliente pode acompanhar as horas, tarefas e observações em tempo real e realizar a aprovação.`,
        },
      };
    }

    case 'suggest_session_title': {
      let targetSessionId = args.session_id;
      if (!targetSessionId) {
        const active = await TimeSession.findOne({
          where: { tenant_id: tenantId, user_id: userId, end_time: null },
        });
        if (!active) {
          return { result: { error: 'Nenhuma sessão ativa encontrada para sugerir título.' } };
        }
        targetSessionId = active.id;
      }

      const session = await TimeSession.findOne({
        where: { id: targetSessionId, tenant_id: tenantId },
        include: [
          { model: Task, as: 'Tasks' },
          { model: Client, as: 'Client' },
        ],
      });

      if (!session) {
        return { result: { error: 'Sessão não encontrada.' } };
      }

      const tasks = (session as any).Tasks || [];
      if (tasks.length === 0) {
        return {
          result: {
            message: 'Nenhuma tarefa foi registrada nesta sessão ainda para sugerir um novo título.',
            current_title: session.title,
            notes: session.notes,
          },
        };
      }

      const descriptions = tasks.map((t: any) => t.description);
      let suggested = '';
      if (descriptions.length === 1) {
        suggested = descriptions[0].slice(0, 50);
      } else if (descriptions.length === 2) {
        suggested = `${descriptions[0].slice(0, 24)} & ${descriptions[1].slice(0, 24)}`;
      } else {
        suggested = `${descriptions[0].slice(0, 22)}, ${descriptions[1].slice(0, 22)} (+${descriptions.length - 2})`;
      }

      if (args.auto_apply) {
        session.title = suggested;
        await session.save();
        return {
          result: {
            success: true,
            applied: true,
            suggested_title: suggested,
            message: `Título da sessão atualizado automaticamente para: "${suggested}"`,
          },
          sessionUpdated: true,
        };
      }

      return {
        result: {
          success: true,
          suggested_title: suggested,
          current_title: session.title,
          session_notes: session.notes,
          tasks_count: tasks.length,
        },
      };
    }

    case 'search_history': {
      const whereClause: any = {
        tenant_id: tenantId,
        user_id: userId,
      };

      if (args.start_date && args.end_date) {
        whereClause.start_time = {
          [Op.gte]: new Date(`${args.start_date}T00:00:00`),
          [Op.lte]: new Date(`${args.end_date}T23:59:59`),
        };
      } else if (args.start_date) {
        whereClause.start_time = {
          [Op.gte]: new Date(`${args.start_date}T00:00:00`),
        };
      } else if (args.end_date) {
        whereClause.start_time = {
          [Op.lte]: new Date(`${args.end_date}T23:59:59`),
        };
      }

      if (args.query && args.query.trim()) {
        const q = args.query.trim();

        // Search also in tasks descriptions and task notes to find parent session
        const matchingTasks = await Task.findAll({
          where: {
            tenant_id: tenantId,
            [Op.or]: [
              { description: { [Op.like]: `%${q}%` } },
              { notes: { [Op.like]: `%${q}%` } },
            ],
          },
          attributes: ['time_session_id'],
          limit: 100,
        });

        const matchingSessionIds = matchingTasks.map((t) => t.time_session_id).filter(Boolean);

        whereClause[Op.or] = [
          { title: { [Op.like]: `%${q}%` } },
          { notes: { [Op.like]: `%${q}%` } },
          ...(matchingSessionIds.length > 0 ? [{ id: { [Op.in]: matchingSessionIds } }] : []),
        ];
      }

      const clientInclude: any = {
        model: Client,
        as: 'Client',
      };

      if (args.client_name && args.client_name.trim()) {
        clientInclude.where = {
          [Op.or]: [
            { name: { [Op.like]: `%${args.client_name.trim()}%` } },
            { company: { [Op.like]: `%${args.client_name.trim()}%` } },
          ],
        };
      }

      const limit = Math.min(Number(args.limit) || 10, 50);

      const sessions = await TimeSession.findAll({
        where: whereClause,
        include: [
          { model: Task, as: 'Tasks' },
          clientInclude,
        ],
        order: [['start_time', 'DESC']],
        limit,
      });

      const formatted = sessions.map((s) => {
        const start = new Date(s.start_time);
        const end = s.end_time ? new Date(s.end_time) : null;
        const durationMin = end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
        const rate = s.Client?.hourly_rate || userHourlyRate;
        const billable = durationMin ? `R$ ${((durationMin / 60) * rate).toFixed(2)}` : 'Em andamento';

        return {
          id: s.id,
          title: s.title,
          notes: s.notes || null,
          start_time: s.start_time,
          end_time: s.end_time,
          duration_minutes: durationMin,
          client: s.Client ? `${s.Client.name} (${s.Client.company || 'PJ'})` : 'Geral (sem cliente)',
          billable_amount: billable,
          public_token: s.public_token,
          public_report_url: s.public_token ? `/shared/${s.public_token}` : null,
          tasks: s.Tasks?.map((t) => ({
            id: t.id,
            description: t.description,
            notes: t.notes || null,
          })) || [],
          is_active: !s.end_time,
        };
      });

      return {
        result: {
          total_found: formatted.length,
          sessions: formatted,
        },
      };
    }

    case 'list_clients': {
      const whereClause: any = { tenant_id: tenantId };
      if (args.query && args.query.trim()) {
        const q = args.query.trim();
        whereClause[Op.or] = [
          { name: { [Op.like]: `%${q}%` } },
          { company: { [Op.like]: `%${q}%` } },
        ];
      }

      const clients = await Client.findAll({
        where: whereClause,
        include: [{ model: ClientContact, as: 'Contacts' }],
        order: [['name', 'ASC']],
      });

      return {
        result: {
          count: clients.length,
          clients: clients.map((c) => ({
            id: c.id,
            name: c.name,
            company: c.company,
            hourly_rate: c.hourly_rate ? `R$ ${c.hourly_rate}/h` : `Padrão (R$ ${userHourlyRate}/h)`,
            email: c.email,
            notes: c.notes || null,
            contacts: ((c as any).Contacts || []).map((cnt: any) => ({
              name: cnt.name,
              email: cnt.email,
              role: cnt.role || null,
              phone: cnt.phone || null,
            })),
          })),
        },
      };
    }

    case 'create_client': {
      if (!args.name || !args.name.trim()) {
        return { result: { error: 'O nome do cliente é obrigatório.' } };
      }

      const client = await Client.create({
        tenant_id: tenantId,
        name: args.name.trim(),
        company: args.company ? args.company.trim() : null,
        email: args.email ? args.email.trim() : null,
        hourly_rate: args.hourly_rate ? Number(args.hourly_rate) : null,
        notes: args.notes ? args.notes.trim() : null,
      });

      return {
        result: {
          success: true,
          message: 'Cliente cadastrado com sucesso!',
          client: {
            id: client.id,
            name: client.name,
            company: client.company,
            hourly_rate: client.hourly_rate,
            notes: client.notes,
          },
        },
        clientsUpdated: true,
      };
    }

    case 'get_financial_summary': {
      const now = new Date();
      let fromDate: Date | null = null;

      if (args.period === 'today') {
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      } else if (args.period === 'week') {
        const day = now.getDay() || 7;
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0, 0);
      } else if (args.period === 'month') {
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      }

      const whereClause: any = {
        tenant_id: tenantId,
        user_id: userId,
        end_time: { [Op.ne]: null },
      };

      if (fromDate) {
        whereClause.start_time = { [Op.gte]: fromDate };
      }

      const sessions = await TimeSession.findAll({
        where: whereClause,
        include: [{ model: Client, as: 'Client' }],
      });

      let totalMinutes = 0;
      let totalBillable = 0;

      for (const s of sessions) {
        if (s.start_time && s.end_time) {
          const diffMs = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
          const mins = Math.max(0, Math.round(diffMs / 60000));
          const rate = s.Client?.hourly_rate || userHourlyRate;
          totalMinutes += mins;
          totalBillable += (mins / 60) * rate;
        }
      }

      return {
        result: {
          period: args.period || 'all',
          sessions_count: sessions.length,
          total_minutes: totalMinutes,
          total_hours: (totalMinutes / 60).toFixed(2),
          total_billable_formatted: `R$ ${totalBillable.toFixed(2)}`,
        },
      };
    }

    default:
      return { result: { error: `Ferramenta desconhecida: ${toolName}` } };
  }
}

// GET /api/ai/messages - Retrieve message thread for user & tenant
aiRouter.get('/messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const messages = await AiMessage.findAll({
      where: {
        tenant_id: req.tenantId!,
        user_id: req.userId!,
      },
      order: [['created_at', 'ASC']],
      limit: 100,
    });

    const formatted = messages.map((m) => {
      let images = [];
      let steps = [];
      try {
        if (m.images_json) images = JSON.parse(m.images_json);
      } catch (_) {}
      try {
        if (m.steps_json) steps = JSON.parse(m.steps_json);
      } catch (_) {}

      return {
        id: m.id,
        role: m.role,
        content: m.content,
        images,
        steps,
        created_at: m.created_at,
      };
    });

    res.json({ messages: formatted });
  } catch (err: any) {
    console.error('Error fetching AI messages:', err);
    res.status(500).json({ error: 'Erro ao carregar histórico de mensagens da IA' });
  }
});

// DELETE /api/ai/messages - Clear conversation history
aiRouter.delete('/messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await AiMessage.destroy({
      where: {
        tenant_id: req.tenantId!,
        user_id: req.userId!,
      },
    });

    res.json({ message: 'Histórico de conversa limpo com sucesso' });
  } catch (err: any) {
    console.error('Error clearing AI messages:', err);
    res.status(500).json({ error: 'Erro ao limpar histórico da IA' });
  }
});

// POST /api/ai/chat - Multi-turn conversational chat with multimodal input and up to 60-step function calling
aiRouter.post('/chat', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, images, model: requestedModel, maxSteps: requestedMaxSteps } = req.body;

    if ((!prompt || !prompt.trim()) && (!images || images.length === 0)) {
      return res.status(400).json({ error: 'Envie uma mensagem ou imagem para o assistente.' });
    }

    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const user = await User.findByPk(userId);
    const hourlyRate = user?.default_hourly_rate || 150.0;

    // Supported models per system guidelines:
    // 'gemini-3.8-flash' (default, fast, reliable), 'gemini-3.1-flash-lite' (fastest), 'gemini-3.1-pro-preview' (deep reasoning)
    const validModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-flash-latest'];
    let modelToUse = validModels.includes(requestedModel) ? requestedModel : 'gemini-3.8-flash';

    // Maximum execution steps for function calling (up to 60 steps as requested)
    const maxSteps = Math.min(Math.max(Number(requestedMaxSteps) || 60, 1), 60);

    // System instruction specifying role, behavior, and capabilities
    const systemInstruction = `Você é o Cronos AI, o assistente inteligente oficial deste sistema de Time Tracking, Produtividade e Faturamento Multitenant.
Seu papel é ajudar o profissional freelancer, consultor ou equipe a gerenciar seu tempo, sessões e clientes com máxima produtividade:
1. Controle de Cronômetro:
   - Inicie sessões com start_timer (com título, observações gerais notes, meta de minutos target_minutes e cliente).
   - Atualize a sessão em andamento com update_active_session (alterar título, observações gerais da sessão notes, meta ou cliente).
   - Finalize sessões com stop_timer (podendo salvar observações finais notes e/ou registrar uma tarefa final concluída).
2. Tarefas e Observações Detalhadas (Two-Tier Notes):
   - Cada sessão de cronômetro possui suas observações gerais da sessão (notes) para briefing, escopo ou anotações gerais.
   - Cada tarefa individual possui sua própria descrição e observações específicas (notes) para links, detalhes técnicos, entregáveis ou impedimentos.
   - Adicione tarefas com add_task_to_timer ou em lote com add_multiple_tasks_to_timer (incluindo description e notes).
   - Atualize tarefas existentes com update_task ou remova com delete_task.
3. Compartilhamento e Relatórios Públicos:
   - Gere e envie o link público de aprovação do cliente com get_public_report_link. O cliente pode conferir tarefas, horas e observações em tempo real.
4. Análise Multimodal de Imagens:
   - Analise capturas de tela (tickets Jira/Trello/GitHub, checklists, mockups, anotações à mão, recibos ou bugs) e extraia tarefas com suas respectivas observações (notes), adicionando-as diretamente ao timer!
5. Título Inteligente:
   - Use suggest_session_title para sugerir ou aplicar automaticamente um título profissional baseado nas tarefas e observações realizadas.
6. Histórico, Clientes e Métricas:
   - Pesquise sessões e tarefas com search_history (que busca em títulos, observações da sessão e tarefas/observações).
   - Consulte ou cadastre clientes com list_clients e create_client (incluindo observações contratuais e contatos).
   - Obtenha balanço financeiro e de horas com get_financial_summary.
7. Execução Autônoma em Cadeia:
   - Execute até 60 etapas autônomas consecutivas para atender solicitações compostas.
Responda sempre em Português do Brasil com tom profissional, prestativo e objetivo, usando formatação Markdown elegante quando apropriado.`;

    const kiloConfig = getKiloConfig();
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    const requestedProvider = (req.body.provider || process.env.AI_PROVIDER || '').toLowerCase();

    // Prioritize Kilo AI Gateway if KILO_API_KEY is configured or requested
    const shouldUseKilo =
      requestedProvider === 'kilo' ||
      (requestedProvider !== 'gemini' && kiloConfig.isConfigured);

    if (shouldUseKilo) {
      if (!kiloConfig.isConfigured) {
        return res.status(400).json({
          error: 'Chave de API do Kilo Gateway não configurada',
          details: 'Por favor, adicione a secret KILO_API_KEY nas variáveis de ambiente ou Secrets para utilizar o Gateway Kilo.ai (https://kilo.ai/docs/gateway).',
          provider: 'kilo',
        });
      }

      if (!kiloConfig.hasModelSecret) {
        return res.status(400).json({
          error: 'Secret do modelo não configurada para o Kilo Gateway',
          details: 'Por favor, adicione a secret KILO_MODEL nas variáveis de ambiente ou Secrets (ex: anthropic/claude-3-5-sonnet, openai/gpt-4o, etc).',
          provider: 'kilo',
        });
      }

      // Fetch prior messages to provide multi-turn conversation context
      const priorDbMessages = await AiMessage.findAll({
        where: { tenant_id: tenantId, user_id: userId },
        order: [['created_at', 'ASC']],
        limit: 30,
      });

      // Save user message to database
      await AiMessage.create({
        tenant_id: tenantId,
        user_id: userId,
        role: 'user',
        content: prompt ? prompt.trim() : '(Imagem enviada para análise)',
        images_json: images && images.length > 0 ? JSON.stringify(images.map((i: any) => ({ name: i.name, mimeType: i.mimeType, preview: i.data?.slice(0, 200) }))) : null,
      });

      const kiloResult = await runKiloAgenticChat({
        prompt: prompt || '',
        images,
        systemInstruction,
        priorDbMessages,
        maxSteps,
        tenantId,
        userId,
        hourlyRate,
        executeToolFn: executeTool,
      });

      // Save model response to database
      await AiMessage.create({
        tenant_id: tenantId,
        user_id: userId,
        role: 'model',
        content: kiloResult.finalModelText,
        steps_json: kiloResult.executedSteps.length > 0 ? JSON.stringify(kiloResult.executedSteps) : null,
      });

      return res.json({
        reply: kiloResult.finalModelText,
        steps: kiloResult.executedSteps,
        stepCount: kiloResult.stepsCount,
        activeSessionChanged: kiloResult.hasSessionChanged,
        clientsChanged: kiloResult.hasClientsChanged,
        provider: 'kilo',
        model: kiloResult.modelUsed,
      });
    }

    if (!geminiApiKey) {
      return res.status(400).json({
        error: 'Nenhuma chave de IA configurada',
        details: 'Adicione as secrets KILO_API_KEY e KILO_MODEL para utilizar o Gateway Kilo.ai, ou configure GEMINI_API_KEY.',
      });
    }

    const ai = getGenAI();

    // Fetch prior messages to provide multi-turn conversation context
    const priorDbMessages = await AiMessage.findAll({
      where: { tenant_id: tenantId, user_id: userId },
      order: [['created_at', 'ASC']],
      limit: 30,
    });

    const conversationContents: any[] = [];

    // Populate previous turns
    for (const msg of priorDbMessages) {
      const parts: any[] = [{ text: msg.content }];
      conversationContents.push({
        role: msg.role === 'model' ? 'model' : 'user',
        parts,
      });
    }

    // Prepare current user message parts (multimodal: text + images)
    const currentUserParts: any[] = [];

    if (images && Array.isArray(images)) {
      for (const img of images) {
        if (img.data && img.mimeType) {
          // Clean base64 data prefix if present (e.g. data:image/png;base64,...)
          const base64Data = img.data.includes(',') ? img.data.split(',')[1] : img.data;
          currentUserParts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: base64Data,
            },
          });
        }
      }
    }

    if (prompt && prompt.trim()) {
      currentUserParts.push({ text: prompt.trim() });
    }

    conversationContents.push({
      role: 'user',
      parts: currentUserParts,
    });

    // Save user message to database
    const savedUserMsg = await AiMessage.create({
      tenant_id: tenantId,
      user_id: userId,
      role: 'user',
      content: prompt ? prompt.trim() : '(Imagem enviada para análise)',
      images_json: images && images.length > 0 ? JSON.stringify(images.map((i: any) => ({ name: i.name, mimeType: i.mimeType, preview: i.data?.slice(0, 200) }))) : null,
    });

    // Agentic Function Calling Loop (Up to maxSteps, e.g. 60 steps)
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

    const candidateModels = [modelToUse, 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

    while (stepsCount < maxSteps) {
      stepsCount++;

      let response: any = null;
      let lastErr: any = null;

      for (const m of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: m,
            contents: conversationContents,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: AI_TOOLS }],
            },
          });
          modelToUse = m;
          break;
        } catch (err: any) {
          lastErr = err;
          console.warn(`Model ${m} failed with error:`, err?.message || err);
          // If it was a 503, 429, quota exhausted, or unavailable, try next candidate
          const errMsg = (err?.message || '').toLowerCase();
          const isTransientOrQuota =
            err?.status === 503 ||
            err?.status === 429 ||
            errMsg.includes('503') ||
            errMsg.includes('429') ||
            errMsg.includes('quota') ||
            errMsg.includes('resource_exhausted') ||
            errMsg.includes('demand') ||
            errMsg.includes('unavailable');

          if (isTransientOrQuota) {
            console.log(`Switching from ${m} to next candidate model due to quota/rate-limit`);
            continue;
          }
          throw err;
        }
      }

      if (!response && lastErr) {
        throw lastErr;
      }

      const candidate = response.candidates?.[0];
      const modelContent = candidate?.content;
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        // Model requested one or more tool calls
        conversationContents.push(modelContent || { role: 'model', parts: candidate?.content?.parts || [] });

        const toolResponseParts: any[] = [];

        for (const call of functionCalls) {
          const { result, sessionUpdated, clientsUpdated } = await executeTool(
            call.name,
            call.args,
            tenantId,
            userId,
            hourlyRate
          );

          if (sessionUpdated) hasSessionChanged = true;
          if (clientsUpdated) hasClientsChanged = true;

          executedSteps.push({
            step: stepsCount,
            tool: call.name,
            args: call.args,
            result,
            timestamp: new Date().toISOString(),
          });

          toolResponseParts.push({
            functionResponse: {
              name: call.name,
              response: { result },
              id: (call as any).id,
            },
          });
        }

        // Add tool results back to conversation (Gemini requires role: 'user' for functionResponse)
        conversationContents.push({
          role: 'user',
          parts: toolResponseParts,
        });

        // Continue the loop to allow Gemini to analyze results and decide next actions
      } else {
        // No more tool calls; Gemini returned its final answer
        finalModelText = response.text || '';
        break;
      }
    }

    if (!finalModelText && executedSteps.length > 0) {
      finalModelText = `Concluí as ações solicitadas com ${executedSteps.length} etapas executadas no sistema.`;
    } else if (!finalModelText) {
      finalModelText = 'Olá! Como posso te ajudar com o seu cronômetro, histórico ou faturamento hoje?';
    }

    // Save model response to database
    await AiMessage.create({
      tenant_id: tenantId,
      user_id: userId,
      role: 'model',
      content: finalModelText,
      steps_json: executedSteps.length > 0 ? JSON.stringify(executedSteps) : null,
    });

    return res.json({
      reply: finalModelText,
      steps: executedSteps,
      stepCount: stepsCount,
      activeSessionChanged: hasSessionChanged,
      clientsChanged: hasClientsChanged,
    });
  } catch (err: any) {
    console.error('Error in AI Chat API route:', err);
    return res.status(500).json({
      error: 'Erro ao processar mensagem com o assistente IA',
      details: err.message,
    });
  }
});
