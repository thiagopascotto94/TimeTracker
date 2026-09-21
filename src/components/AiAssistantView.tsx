/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  Send,
  Image as ImageIcon,
  X,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Cpu,
  Layers,
  Search,
  PlusCircle,
  ArrowDown,
  Play,
  Square,
  Bot,
  User as UserIcon,
  Copy,
  Check,
  FileText,
  Share2,
  Users,
  UserPlus,
  Edit3,
  GitCommit,
} from 'lucide-react';
import {
  User,
  Tenant,
  TimeSession,
  AiChatMessage,
  AiImageAttachment,
  AiStep,
  Client,
  WorkspaceAiDailyUsageInfo,
} from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { apiFetch } from '../utils/api';
import { GitCommitModal } from './GitCommitModal';

interface AiAssistantViewProps {
  user: User | null;
  tenant: Tenant | null;
  activeSession: TimeSession | null;
  sessions?: TimeSession[];
  clients?: Client[];
  onRefreshData: () => Promise<void>;
  onNavigateToTimer: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToNotes?: () => void;
}

interface ProviderInfo {
  activeProvider: 'kilo' | 'gemini' | 'none';
  kilo: {
    isConfigured: boolean;
    hasModelSecret: boolean;
    model: string | null;
    baseURL: string;
    docsUrl: string;
  };
  gemini: {
    isConfigured: boolean;
    defaultModel: string;
  };
}

export function AiAssistantView({
  user,
  tenant,
  activeSession,
  sessions = [],
  clients,
  onRefreshData,
  onNavigateToTimer,
  onNavigateToSettings,
  onNavigateToNotes,
}: AiAssistantViewProps) {
  const [gitModalOpen, setGitModalOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [attachedImages, setAttachedImages] = useState<AiImageAttachment[]>([]);
  const [selectedModel, setSelectedModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-flash-lite' | 'gemini-3.1-pro-preview'>('gemini-3.5-flash');
  const [maxSteps, setMaxSteps] = useState<number>(60);
  const [expandedStepIndex, setExpandedStepIndex] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [loadingStepText, setLoadingStepText] = useState('Pensando...');
  const [usage, setUsage] = useState<WorkspaceAiDailyUsageInfo | null>(null);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 100;
    setShowScrollBottom(isFarFromBottom);
  };

  useEffect(() => {
    if (!loading) return;
    const steps = [
      'Pensando...',
      'Analisando contexto...',
      'Verificando próximos passos...',
      'Executando ações...',
      'Quase pronto...',
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % steps.length;
      setLoadingStepText(steps[i]);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load provider information
  const fetchProviderInfo = async () => {
    try {
      const res = await apiFetch('/api/ai/provider');
      if (res.ok) {
        const data = await res.json();
        setProviderInfo(data);
      }
    } catch (err) {
      console.error('Error fetching AI provider info:', err);
    }
  };

  // Load persistent message history from backend
  const fetchMessages = async () => {
    try {
      setLoadingHistory(true);
      const res = await apiFetch('/api/ai/messages');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching AI messages:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load workspace daily AI message usage
  const fetchAiUsage = async () => {
    try {
      const res = await apiFetch('/api/ai/usage');
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch (err) {
      console.error('Error fetching AI workspace usage:', err);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchProviderInfo();
    fetchAiUsage();

    const handleWorkspaceChanged = () => {
      fetchMessages();
      fetchAiUsage();
    };

    window.addEventListener('workspace-changed', handleWorkspaceChanged);
    return () => {
      window.removeEventListener('workspace-changed', handleWorkspaceChanged);
    };
  }, []);

  // Clear conversation history
  const handleClearHistory = async () => {
    try {
      const res = await apiFetch('/api/ai/messages', { method: 'DELETE' });
      if (res.ok) {
        setMessages([]);
      }
    } catch (err) {
      console.error('Error clearing messages:', err);
    }
  };

  // Convert File to Base64
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      setAttachedImages((prev) => [
        ...prev,
        {
          name: file.name,
          mimeType: file.type,
          data: base64Data,
          preview: base64Data,
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach(processFile);
    e.target.value = '';
  };

  // Drag and drop handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach(processFile);
    }
  };

  // Paste handler (permite colar print direto do clipboard)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processFile(file);
        }
      }
    }
  };

  const removeImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Send message
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText;
    if ((!textToSend.trim() && attachedImages.length === 0) || loading) return;

    // Check if daily workspace limit is reached
    if (usage?.is_limit_reached) {
      const limitMessage: AiChatMessage = {
        id: `limit-${Date.now()}`,
        role: 'model',
        content: `⚠️ **Limite diário de perguntas atingido para este workspace (${usage.current}/${usage.max} hoje no plano ${usage.plan_name}).**\n\nEste limite de ${usage.max} ${usage.max === 1 ? 'pergunta' : 'perguntas/dia'} é compartilhado entre todos os membros deste workspace.\n\nPara continuar enviando perguntas à IA hoje, faça upgrade para o plano **Pro** (25 mensagens/dia) ou **Team** (100 mensagens/dia).`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, limitMessage]);
      return;
    }

    const currentImages = [...attachedImages];
    const userMessage: AiChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      images: currentImages,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setAttachedImages([]);
    setLoading(true);

    try {
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          images: currentImages.map((img) => ({
            name: img.name,
            mimeType: img.mimeType,
            data: img.data,
          })),
          model: selectedModel,
          maxSteps,
          provider: providerInfo?.activeProvider === 'kilo' ? 'kilo' : undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.code === 'AI_DAILY_LIMIT_EXCEEDED') {
          setUsage((prev) =>
            prev
              ? {
                  ...prev,
                  current: errJson.current ?? prev.max,
                  max: errJson.max ?? prev.max,
                  remaining: 0,
                  is_limit_reached: true,
                }
              : null
          );
        }
        const errText = errJson.error ? `${errJson.error}${errJson.details ? ': ' + errJson.details : ''}` : 'Falha ao conversar com assistente IA';
        throw new Error(errText);
      }

      const data = await res.json();

      // Update workspace usage from response if provided
      if (data.usage) {
        setUsage(data.usage);
      } else {
        fetchAiUsage();
      }

      const botMessage: AiChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'model',
        content: data.reply,
        steps: data.steps || [],
        provider: data.provider,
        model: data.model,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, botMessage]);

      // If tools modified active timer, clients, or notes, refresh application data
      if (data.activeSessionChanged || data.clientsChanged || data.notesChanged) {
        await onRefreshData();
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage: AiChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: `⚠️ **Ops, ocorreu um erro:** ${err.message}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Quick action templates
  const quickActions = [
    {
      label: 'Status do Timer & Tarefas',
      prompt: 'Qual é o status da minha sessão ativa de cronômetro, suas observações e tarefas no momento?',
      icon: Clock,
    },
    {
      label: 'Iniciar Timer com Observações',
      prompt: 'Inicie uma sessão de cronômetro com o título "Desenvolvimento de Recursos", meta de 60 min e adicione observações com os objetivos principais.',
      icon: Play,
    },
    {
      label: 'Link de Relatório Público',
      prompt: 'Gere o link público de compartilhamento da sessão para envio ao cliente para aprovação.',
      icon: Share2,
    },
    {
      label: 'Resumo Financeiro do Mês',
      prompt: 'Apresente meu resumo financeiro e total de horas trabalhadas no mês atual.',
      icon: Sparkles,
    },
    {
      label: 'Buscar Sessões no Histórico',
      prompt: 'Busque no histórico as últimas sessões registradas com suas tarefas e observações detalhadas.',
      icon: Search,
    },
    {
      label: 'Sugerir Título Inteligente',
      prompt: 'Analise as tarefas e observações da minha sessão ativa e sugira um título executivo apropriado.',
      icon: Edit3,
    },
    {
      label: 'Criar Nota / Checklist',
      prompt: 'Crie uma nova nota intitulada "Checklist da Semana" com itens e tarefas organizadas em formato Markdown (- [ ]) para acompanhamento.',
      icon: FileText,
    },
  ];

  return (
    <div
      id="ai-assistant-container"
      className="relative w-full h-full flex-1 min-h-0 flex flex-col bg-white dark:bg-neutral-900 overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header Bar - Fixed at top */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-8 py-3 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md z-20">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-xs shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Cronos AI
          </h2>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Workspace AI Daily Usage Badge */}
          {usage && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-default ${
                usage.is_limit_reached
                  ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50'
                  : 'bg-neutral-100/90 dark:bg-neutral-800/90 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700/70'
              }`}
              title={`Limite diário de perguntas da IA (${usage.workspace_name || 'Workspace'}): ${usage.current} de ${usage.max} enviadas hoje no plano ${usage.plan_name}. Compartilhado entre todos os participantes deste workspace.`}
            >
              <Bot className={`w-3.5 h-3.5 ${usage.is_limit_reached ? 'text-red-500' : 'text-indigo-500'}`} />
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {usage.plan_name}:
              </span>
              <span className={usage.is_limit_reached ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                {Math.min(100, Math.round((usage.current / (usage.max || 1)) * 100))}% usado
              </span>
              {usage.is_limit_reached && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 uppercase tracking-wider">
                  Esgotado
                </Badge>
              )}
            </div>
          )}

          {/* Clear Button */}
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              title="Limpar histórico da conversa"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Scrollable Thread - Only this area moves, no lateral scroll */}
      <div
        id="ai-messages-scroll-area"
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full overscroll-contain transition-colors ${
          isDragOver ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
        }`}
      >
        <div className="max-w-4xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-3 text-neutral-400">
            <RefreshCw className="w-6 h-6 animate-spin text-neutral-500" />
            <p className="text-xs">Carregando conversa com a IA...</p>
          </div>
        ) : messages.length === 0 ? (
          /* Empty State with Quick Starter Actions */
          <div className="flex flex-col items-center justify-center text-center py-8 sm:py-12 max-w-lg mx-auto space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Assistente Cronos AI
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Eu posso iniciar seu cronômetro, gerenciar tarefas, criar notas ricas com Markdown e checklists,
                buscar histórico de sessões, analisar imagens (tickets, mockups, anotações) e executar fluxos complexos em até 60 etapas automáticas.
              </p>
            </div>

            {/* Suggested quick actions */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-left">
              {quickActions.map((qa, i) => {
                const Icon = qa.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(qa.prompt)}
                    className="p-3 bg-neutral-50 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 rounded-xl transition-all text-xs text-neutral-700 dark:text-neutral-300 flex items-start gap-2.5 cursor-pointer text-left hover:shadow-2xs"
                  >
                    <Icon className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {qa.label}
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1">
                        {qa.prompt}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id || index}
                className={`flex gap-3 max-w-3xl w-full min-w-0 ${
                  isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${
                    isUser
                      ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs'
                      : 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-xs'
                  }`}
                >
                  {isUser ? (
                    user ? (
                      user.name.charAt(0).toUpperCase()
                    ) : (
                      <UserIcon className="w-4 h-4" />
                    )
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`flex flex-col space-y-2 rounded-2xl p-3.5 sm:p-4 text-sm leading-relaxed max-w-[95%] sm:max-w-[85%] break-words [overflow-wrap:anywhere] min-w-0 ${
                    isUser
                      ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-tr-xs'
                      : 'bg-neutral-50 dark:bg-neutral-800/80 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-750 rounded-tl-xs shadow-2xs'
                  }`}
                >
                  {/* Attached Images */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 pb-2">
                      {msg.images.map((img, imgIdx) => (
                        <div
                          key={imgIdx}
                          className="relative rounded-lg overflow-hidden border border-neutral-300 dark:border-neutral-700 bg-neutral-950/20 max-w-[200px]"
                        >
                          <img
                            src={img.preview || img.data}
                            alt={img.name || 'Imagem enviada'}
                            className="w-full h-28 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            referrerPolicy="no-referrer"
                            onClick={() => {
                              // Open in a simple popup modal or window
                              const win = window.open();
                              if (win) {
                                win.document.write(
                                  `<body style="margin:0;background:#0f0f11;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${img.data}" style="max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.5);" /></body>`
                                );
                              }
                            }}
                          />
                          {img.name && (
                            <div className="p-1 text-[10px] bg-neutral-900/80 text-white truncate text-center">
                              {img.name}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Function Calling Execution Steps (Tools executed by Gemini) */}
                  {import.meta.env.VITE_SHOW_AI_STEPS === 'true' && msg.steps && msg.steps.length > 0 && (
                    <div className="mb-2 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Ações Executadas ({msg.steps.length} {msg.steps.length === 1 ? 'etapa' : 'etapas'}):</span>
                      </div>

                      <div className="space-y-1">
                        {msg.steps.map((step, sIdx) => {
                          const stepKey = `${msg.id}-${sIdx}`;
                          const isExpanded = expandedStepIndex === stepKey;

                          let toolLabel = step.tool;
                          let toolIcon = Cpu;
                          if (step.tool === 'start_timer') {
                            toolLabel = 'Iniciar Cronômetro';
                            toolIcon = Play;
                          } else if (step.tool === 'update_active_session') {
                            toolLabel = 'Atualizar Sessão Ativa';
                            toolIcon = Edit3;
                          } else if (step.tool === 'stop_timer') {
                            toolLabel = 'Finalizar Cronômetro';
                            toolIcon = Square;
                          } else if (step.tool === 'add_task_to_timer') {
                            toolLabel = 'Adicionar Tarefa';
                            toolIcon = PlusCircle;
                          } else if (step.tool === 'add_multiple_tasks_to_timer') {
                            toolLabel = 'Adicionar Múltiplas Tarefas';
                            toolIcon = PlusCircle;
                          } else if (step.tool === 'update_task') {
                            toolLabel = 'Atualizar Tarefa';
                            toolIcon = Edit3;
                          } else if (step.tool === 'delete_task') {
                            toolLabel = 'Remover Tarefa';
                            toolIcon = Trash2;
                          } else if (step.tool === 'get_public_report_link') {
                            toolLabel = 'Link do Relatório Público';
                            toolIcon = Share2;
                          } else if (step.tool === 'suggest_session_title') {
                            toolLabel = 'Sugerir Título';
                            toolIcon = Sparkles;
                          } else if (step.tool === 'search_history') {
                            toolLabel = 'Consultar Histórico';
                            toolIcon = Search;
                          } else if (step.tool === 'get_active_session') {
                            toolLabel = 'Verificar Sessão Ativa';
                            toolIcon = Clock;
                          } else if (step.tool === 'list_clients') {
                            toolLabel = 'Listar Clientes';
                            toolIcon = Users;
                          } else if (step.tool === 'create_client') {
                            toolLabel = 'Cadastrar Cliente';
                            toolIcon = UserPlus;
                          } else if (step.tool === 'get_financial_summary') {
                            toolLabel = 'Resumo Financeiro';
                            toolIcon = Sparkles;
                          } else if (step.tool === 'create_note') {
                            toolLabel = 'Criar Nota / Documento';
                            toolIcon = FileText;
                          } else if (step.tool === 'list_notes') {
                            toolLabel = 'Consultar Notas';
                            toolIcon = FileText;
                          }

                          const StepIcon = toolIcon;

                          return (
                            <div
                              key={sIdx}
                              className="border border-neutral-200 dark:border-neutral-700/70 rounded-lg bg-white/70 dark:bg-neutral-850 overflow-hidden text-xs"
                            >
                              <button
                                onClick={() =>
                                  setExpandedStepIndex(isExpanded ? null : stepKey)
                                }
                                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-neutral-100/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer text-left"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <StepIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                    {step.step}. {toolLabel}
                                  </span>
                                  {step.result?.message && (
                                    <span className="text-neutral-500 dark:text-neutral-400 truncate hidden sm:inline">
                                      — {step.result.message}
                                    </span>
                                  )}
                                  {step.result?.total_found !== undefined && (
                                    <span className="text-neutral-500 dark:text-neutral-400 truncate hidden sm:inline">
                                      — {step.result.total_found} sessões encontradas
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {step.tool === 'create_note' && onNavigateToNotes && (
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onNavigateToNotes();
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-md transition-colors"
                                      title="Abrir o módulo de Notas"
                                    >
                                      <FileText className="w-3 h-3" />
                                      Ver em Notas
                                    </span>
                                  )}
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                  )}
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="px-3 py-2 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/90 text-[11px] font-mono space-y-1">
                                  <div>
                                    <span className="text-neutral-400">Argumentos: </span>
                                    <pre className="text-neutral-700 dark:text-neutral-300 overflow-x-auto whitespace-pre-wrap">
                                      {JSON.stringify(step.args, null, 2)}
                                    </pre>
                                  </div>
                                  <div className="pt-1">
                                    <span className="text-neutral-400">Resultado: </span>
                                    <pre className="text-neutral-700 dark:text-neutral-300 overflow-x-auto whitespace-pre-wrap max-h-40">
                                      {JSON.stringify(step.result, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Main Message Text (with full Markdown and Table support for both user and AI) */}
                  {isUser ? (
                    <div className="space-y-2 leading-relaxed">
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="whitespace-pre-wrap leading-relaxed">{children}</p>,
                          table: ({ node, ...props }) => (
                            <div className="my-2.5 w-full overflow-x-auto rounded-lg border border-neutral-700 dark:border-neutral-300 bg-neutral-800/80 dark:bg-neutral-200/90 shadow-2xs">
                              <table className="w-full text-xs text-left border-collapse min-w-[320px]" {...props} />
                            </div>
                          ),
                          thead: ({ node, ...props }) => (
                            <thead className="bg-neutral-750 dark:bg-neutral-300 text-white dark:text-neutral-900 font-semibold border-b border-neutral-600 dark:border-neutral-400" {...props} />
                          ),
                          tbody: ({ node, ...props }) => (
                            <tbody className="divide-y divide-neutral-700 dark:divide-neutral-300" {...props} />
                          ),
                          th: ({ node, ...props }) => (
                            <th className="px-3 py-2 font-semibold border-r last:border-r-0 border-neutral-650 dark:border-neutral-350" {...props} />
                          ),
                          td: ({ node, ...props }) => (
                            <td className="px-3 py-2 border-r last:border-r-0 border-neutral-700 dark:border-neutral-300 align-top" {...props} />
                          ),
                          tr: ({ node, ...props }) => (
                            <tr className="hover:bg-neutral-750/50 dark:hover:bg-neutral-250/50 transition-colors" {...props} />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc pl-4 space-y-1 my-1.5" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal pl-4 space-y-1 my-1.5" {...props} />
                          ),
                          li: ({ node, ...props }) => (
                            <li className="leading-relaxed" {...props} />
                          ),
                          pre: ({ children, ...props }: any) => (
                            <pre className="bg-neutral-950 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-900 p-3 rounded-lg overflow-x-auto text-xs my-2 font-mono border border-neutral-800 dark:border-neutral-300" {...props}>
                              {children}
                            </pre>
                          ),
                          code: ({ node, className, children, ...props }: any) => {
                            const isMultiLine = String(children).includes('\n');
                            if (!isMultiLine && !className) {
                              return (
                                <code className="bg-neutral-800 dark:bg-neutral-200 text-amber-300 dark:text-amber-800 px-1.5 py-0.5 rounded text-xs font-mono font-medium" {...props}>
                                  {children}
                                </code>
                              );
                            }
                            return (
                              <code className={`font-mono text-xs ${className || ''}`} {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </Markdown>
                    </div>
                  ) : (
                    <div className="space-y-2 text-neutral-850 dark:text-neutral-150 leading-relaxed">
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="whitespace-pre-wrap leading-relaxed">{children}</p>,
                          table: ({ node, ...props }) => (
                            <div className="my-3 w-full overflow-x-auto rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xs">
                              <table className="w-full text-xs text-left border-collapse min-w-[340px]" {...props} />
                            </div>
                          ),
                          thead: ({ node, ...props }) => (
                            <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold border-b border-neutral-300 dark:border-neutral-700" {...props} />
                          ),
                          tbody: ({ node, ...props }) => (
                            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800" {...props} />
                          ),
                          th: ({ node, ...props }) => (
                            <th className="px-3.5 py-2.5 font-semibold text-neutral-900 dark:text-neutral-100 border-r last:border-r-0 border-neutral-200 dark:border-neutral-700 whitespace-nowrap bg-neutral-100/90 dark:bg-neutral-800/90" {...props} />
                          ),
                          td: ({ node, ...props }) => (
                            <td className="px-3.5 py-2 text-neutral-800 dark:text-neutral-200 border-r last:border-r-0 border-neutral-200 dark:border-neutral-800 align-top" {...props} />
                          ),
                          tr: ({ node, ...props }) => (
                            <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-850/60 transition-colors" {...props} />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc pl-5 space-y-1 my-2" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal pl-5 space-y-1 my-2" {...props} />
                          ),
                          li: ({ node, ...props }) => (
                            <li className="leading-relaxed" {...props} />
                          ),
                          pre: ({ children, ...props }: any) => (
                            <pre className="bg-neutral-900 dark:bg-neutral-950 text-neutral-100 p-3.5 rounded-xl overflow-x-auto text-xs my-2 font-mono border border-neutral-800 shadow-2xs" {...props}>
                              {children}
                            </pre>
                          ),
                          code: ({ node, className, children, ...props }: any) => {
                            const isMultiLine = String(children).includes('\n');
                            if (!isMultiLine && !className) {
                              return (
                                <code className="bg-neutral-200/80 dark:bg-neutral-750 text-neutral-900 dark:text-neutral-100 px-1.5 py-0.5 rounded text-xs font-mono font-medium border border-neutral-300/50 dark:border-neutral-700/50" {...props}>
                                  {children}
                                </code>
                              );
                            }
                            return (
                              <code className={`font-mono text-xs ${className || ''}`} {...props}>
                                {children}
                              </code>
                            );
                          },
                          strong: ({ children }) => <strong className="font-semibold text-neutral-900 dark:text-neutral-100">{children}</strong>,
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {msg.content}
                      </Markdown>
                    </div>
                  )}

                  {/* Message Footer: Actions & Copy */}
                  {!isUser && (
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-200/50 dark:border-neutral-700/40 text-[10px] text-neutral-400">
                      <span>Cronos AI</span>
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="flex items-center gap-1 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                        title="Copiar resposta"
                      >
                        {copiedMessageId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-500">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Pending state while agentic loop runs */}
        {loading && (
          <div className="flex gap-3 max-w-3xl mr-auto">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-xs animate-pulse">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="rounded-2xl rounded-tl-xs p-4 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <Cpu className="w-4 h-4 animate-spin" />
                <span>{loadingStepText}</span>
              </div>
              <div className="flex space-x-1.5 pt-1">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Scroll-to-Bottom Button (Gemini-style) */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900/90 dark:bg-neutral-800/90 hover:bg-neutral-900 dark:hover:bg-neutral-700 text-white shadow-lg border border-neutral-700/50 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer animate-in fade-in"
          title="Rolar para as mensagens recentes"
          aria-label="Rolar para o final"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Input Area Footer - Fixed at bottom */}
      <div className="shrink-0 w-full border-t border-neutral-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md z-20 px-3 sm:px-6 py-2.5 sm:py-3.5">
        <div className="max-w-4xl mx-auto w-full">
          {/* Workspace AI Daily Limit Reached Warning Banner */}
          {usage?.is_limit_reached && (
          <div className="mb-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-red-900 dark:text-red-200 animate-in fade-in">
            <div className="flex items-start sm:items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-bold">
                  Limite diário de perguntas da IA atingido ({usage.current}/{usage.max}):{' '}
                </span>
                <span className="text-red-800 dark:text-red-300">
                  O plano {usage.plan_name} permite até {usage.max} {usage.max === 1 ? 'pergunta' : 'perguntas/dia'} compartilhadas entre todos os membros do workspace.
                </span>
              </div>
            </div>
            {onNavigateToSettings && (
              <Button
                type="button"
                size="sm"
                onClick={onNavigateToSettings}
                className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white font-medium shrink-0 cursor-pointer shadow-xs self-start sm:self-auto"
              >
                Fazer Upgrade para {usage.plan_id === 'free' ? 'Pro (50/dia)' : 'Team (1.000/dia)'}
              </Button>
            )}
          </div>
        )}

        {/* Attached Images Preview Strip */}
        {attachedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachedImages.map((img, idx) => (
              <div
                key={idx}
                className="relative flex items-center gap-2 p-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-2xs"
              >
                <img
                  src={img.preview}
                  alt={img.name}
                  className="w-10 h-10 object-cover rounded"
                />
                <span className="text-xs text-neutral-700 dark:text-neutral-300 max-w-[120px] truncate font-medium">
                  {img.name}
                </span>
                <button
                  onClick={() => removeImage(idx)}
                  className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                  title="Remover imagem"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className={`flex items-end gap-2 bg-neutral-100 dark:bg-neutral-800/90 border rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 shadow-2xs transition-all ${
          usage?.is_limit_reached
            ? 'border-red-300 dark:border-red-900/60 bg-red-50/20'
            : 'border-neutral-200/80 dark:border-neutral-700/80 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500'
        }`}>
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            multiple
            disabled={usage?.is_limit_reached}
            className="hidden"
          />

          {/* Plus Selection Menu Container */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPlusMenuOpen(!plusMenuOpen)}
              disabled={usage?.is_limit_reached}
              className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Opções (Selecionar imagem, Novo commit)"
            >
              <PlusCircle className="h-5 w-5" />
            </button>

            {plusMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer text-left"
                >
                  <ImageIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Selecionar Imagem</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    setGitModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer text-left border-t border-neutral-100 dark:border-neutral-700/50"
                >
                  <GitCommit className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <span>Novo Commit</span>
                </button>
              </div>
            )}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              usage?.is_limit_reached
                ? `Limite diário atingido (${usage.current}/${usage.max} msgs no plano ${usage.plan_name}). Faça upgrade para continuar.`
                : attachedImages.length > 0
                ? 'Instrua a IA sobre a imagem (ex: "Extraia as tarefas e inicie o timer")...'
                : 'Pergunte ou peça para iniciar timer, buscar histórico... (Shift+Enter pula linha)'
            }
            rows={1}
            disabled={loading || usage?.is_limit_reached}
            className="flex-1 max-h-32 min-h-[36px] bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none resize-none py-1.5 px-1 leading-relaxed disabled:opacity-50"
          />

          {/* Send Button */}
          <Button
            onClick={() => handleSendMessage()}
            disabled={(!inputText.trim() && attachedImages.length === 0) || loading || usage?.is_limit_reached}
            className="h-9 px-3.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 font-semibold text-xs cursor-pointer shadow-xs shrink-0 rounded-full disabled:opacity-40"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1" />
                <span>Enviar</span>
              </>
            )}
          </Button>
        </div>
        </div>
      </div>

      {/* Git Commit & Task Extraction Modal */}
      <GitCommitModal
        open={gitModalOpen}
        onOpenChange={setGitModalOpen}
        tenant={tenant || null}
        activeSession={activeSession}
        sessions={sessions}
        clients={clients}
        onTasksCreated={async () => {
          await onRefreshData();
        }}
        onNavigateToSettings={onNavigateToSettings}
      />
    </div>
  );
}
