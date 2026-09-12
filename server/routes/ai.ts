import { Router, Response } from 'express';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { Op } from 'sequelize';
import crypto from 'crypto';
import { TimeSession, Task, Client, User, AiMessage } from '../db';
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
    'Pesquisa o histórico de sessões de trabalho do usuário e tenant atual. Permite buscar por texto no título/tarefas, filtrar por cliente, período de datas e limite de registros.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Termo de busca para título da sessão ou descrição de tarefas.',
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
        description: 'Quantidade máxima de sessões a retornar (padrão 10).',
      },
    },
  },
};

const getActiveSessionDeclaration: FunctionDeclaration = {
  name: 'get_active_session',
  description:
    'Verifica se há um cronômetro / sessão de trabalho atualmente em execução para o usuário no tenant atual, retornando detalhes, tempo decorrido, cliente e tarefas registradas.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const startTimerDeclaration: FunctionDeclaration = {
  name: 'start_timer',
  description:
    'Inicia uma nova sessão de cronômetro de trabalho para o usuário no servidor. Registra o timestamp oficial e vincula opcionalmente a um cliente ou sessão anterior.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Título ou objetivo da sessão de trabalho.',
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

const stopTimerDeclaration: FunctionDeclaration = {
  name: 'stop_timer',
  description:
    'Finaliza a sessão de cronômetro atualmente ativa para o usuário, preenchendo o horário de término e calculando a duração total e o valor a faturar.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      notes: {
        type: Type.STRING,
        description: 'Anotação final ou tarefa de encerramento opcional.',
      },
    },
  },
};

const addTaskToTimerDeclaration: FunctionDeclaration = {
  name: 'add_task_to_timer',
  description:
    'Adiciona uma tarefa ou anotação de atividade realizada à sessão ativa (ou a uma sessão específica).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      description: {
        type: Type.STRING,
        description: 'Descrição detalhada da tarefa ou atividade realizada.',
      },
      session_id: {
        type: Type.STRING,
        description: 'ID da sessão. Se omitido, adiciona à sessão que está atualmente em andamento.',
      },
    },
    required: ['description'],
  },
};

const addMultipleTasksToTimerDeclaration: FunctionDeclaration = {
  name: 'add_multiple_tasks_to_timer',
  description:
    'Adiciona múltiplas tarefas em lote para a sessão ativa (ou especificada). Excelente para quando tarefas são extraídas de imagens, listas ou relatórios.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tasks: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
        },
        description: 'Lista de descrições das tarefas a adicionar.',
      },
      session_id: {
        type: Type.STRING,
        description: 'ID da sessão. Se omitido, usa a sessão em andamento.',
      },
    },
    required: ['tasks'],
  },
};

const listClientsDeclaration: FunctionDeclaration = {
  name: 'list_clients',
  description:
    'Lista os clientes cadastrados no tenant atual, com suas taxas horárias e dados de contato.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Filtro por nome ou empresa do cliente.',
      },
    },
  },
};

const createClientDeclaration: FunctionDeclaration = {
  name: 'create_client',
  description:
    'Cadastra um novo cliente no workspace tenant atual com taxa horária personalizada.',
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
        description: 'Observações ou escopo contratado.',
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

const AI_TOOLS = [
  searchHistoryDeclaration,
  getActiveSessionDeclaration,
  startTimerDeclaration,
  stopTimerDeclaration,
  addTaskToTimerDeclaration,
  addMultipleTasksToTimerDeclaration,
  listClientsDeclaration,
  createClientDeclaration,
  getFinancialSummaryDeclaration,
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
          start_time: active.start_time,
          target_minutes: active.target_minutes,
          elapsed_minutes: elapsedMinutes,
          estimated_billable: `R$ ${billable.toFixed(2)}`,
          client: active.Client ? { id: active.Client.id, name: active.Client.name, company: active.Client.company } : null,
          tasks_count: active.Tasks?.length || 0,
          tasks: active.Tasks?.map((t) => t.description) || [],
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
              start_time: existing.start_time,
            },
            instruction: 'Você pode finalizar a sessão atual com stop_timer antes de iniciar uma nova, ou adicionar tarefas nela.',
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
        title: args.title?.trim() || 'Sessão de Foco',
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
            start_time: created.start_time,
            target_minutes: created.target_minutes,
            client_id: created.client_id,
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
      await active.save();

      if (args.notes && args.notes.trim()) {
        await Task.create({
          tenant_id: tenantId,
          time_session_id: active.id,
          description: args.notes.trim(),
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
            duration_minutes: durationMin,
            end_time: serverEndTime,
            total_billable: `R$ ${billable}`,
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
      });

      return {
        result: {
          success: true,
          message: 'Tarefa registrada com sucesso na sessão de trabalho!',
          task: {
            id: newTask.id,
            description: newTask.description,
            time_session_id: targetSessionId,
          },
        },
        sessionUpdated: true,
      };
    }

    case 'add_multiple_tasks_to_timer': {
      const taskList: string[] = Array.isArray(args.tasks) ? args.tasks : [];
      if (taskList.length === 0) {
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
      for (const desc of taskList) {
        if (typeof desc === 'string' && desc.trim()) {
          const t = await Task.create({
            tenant_id: tenantId,
            time_session_id: targetSessionId,
            description: desc.trim(),
          });
          createdTasks.push({ id: t.id, description: t.description });
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
        whereClause[Op.or] = [
          { title: { [Op.like]: `%${q}%` } },
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
          start_time: s.start_time,
          end_time: s.end_time,
          duration_minutes: durationMin,
          client: s.Client ? `${s.Client.name} (${s.Client.company || 'PJ'})` : 'Geral (sem cliente)',
          billable_amount: billable,
          tasks: s.Tasks?.map((t) => t.description) || [],
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
Seu papel é ajudar o profissional freelancer, consultor ou equipe a:
1. Rastrear o tempo de trabalho com precisão e iniciar/parar sessões de cronômetro com start_timer e stop_timer.
2. Registrar tarefas realizadas em tempo real com add_task_to_timer ou add_multiple_tasks_to_timer.
3. Analisar imagens enviadas (como capturas de tela de tickets do Jira/Trello/GitHub, checklists, mockups de design, anotações à mão, recibos ou relatórios de bugs) e extrair tarefas concretas adicionando-as diretamente ao timer!
4. Buscar e consultar históricos de sessões, horas trabalhadas e métricas com search_history e get_financial_summary.
5. Gerenciar clientes com list_clients e create_client.
6. Você pode executar chamadas de função consecutivas de forma autônoma (até 60 steps) para resolver pedidos compostos pelo usuário. Por exemplo: verificar sessão ativa -> se não houver, iniciar timer com cliente -> adicionar tarefas extraídas da imagem -> confirmar o resumo para o usuário.
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
