import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
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
  Play,
  Square,
  Bot,
  User as UserIcon,
  Copy,
  Check,
} from 'lucide-react';
import { User, Tenant, TimeSession, AiChatMessage, AiImageAttachment, AiStep } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface AiAssistantViewProps {
  user: User | null;
  tenant: Tenant | null;
  activeSession: TimeSession | null;
  onRefreshData: () => Promise<void>;
  onNavigateToTimer: () => void;
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
  onRefreshData,
  onNavigateToTimer,
}: AiAssistantViewProps) {
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      const res = await fetch('/api/ai/provider');
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
      const res = await fetch('/api/ai/messages');
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

  useEffect(() => {
    fetchMessages();
    fetchProviderInfo();
  }, []);

  // Clear conversation history
  const handleClearHistory = async () => {
    try {
      const res = await fetch('/api/ai/messages', { method: 'DELETE' });
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
      const res = await fetch('/api/ai/chat', {
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
        const errText = errJson.error ? `${errJson.error}${errJson.details ? ': ' + errJson.details : ''}` : 'Falha ao conversar com assistente IA';
        throw new Error(errText);
      }

      const data = await res.json();

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

      // If tools modified active timer or clients, refresh application data
      if (data.activeSessionChanged || data.clientsChanged) {
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
      label: 'Status do Timer',
      prompt: 'Qual é o status da minha sessão ativa de cronômetro no momento?',
      icon: Clock,
    },
    {
      label: 'Iniciar Timer Rápido',
      prompt: 'Inicie uma sessão de cronômetro com o título "Desenvolvimento de Recursos" com meta de 60 minutos.',
      icon: Play,
    },
    {
      label: 'Resumo Financeiro do Mês',
      prompt: 'Apresente meu resumo financeiro e total de horas trabalhadas no mês atual.',
      icon: Sparkles,
    },
    {
      label: 'Buscar Sessões Recentes',
      prompt: 'Busque no histórico as últimas 5 sessões registradas e resuma as tarefas de cada uma.',
      icon: Search,
    },
  ];

  return (
    <div
      id="ai-assistant-container"
      className="w-full max-w-5xl mx-auto flex flex-col h-[calc(100vh-10rem)] min-h-[580px] bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Cronos AI
              </h2>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                Multi-Tenant • 60 Steps
              </Badge>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Controle o cronômetro, analise imagens e consulte histórico via linguagem natural
            </p>
          </div>
        </div>

        {/* Model Selector & Actions */}
        <div className="flex items-center gap-2">
          {/* Active Provider Badge or Gemini Model Selector */}
          {providerInfo?.activeProvider === 'kilo' ? (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-850 rounded-lg text-xs text-violet-800 dark:text-violet-300 shadow-2xs">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold">Kilo Gateway</span>
              <span className="text-neutral-300 dark:text-neutral-600">•</span>
              <span
                className="font-mono text-[11px] max-w-[130px] sm:max-w-[190px] truncate"
                title={providerInfo.kilo.model || 'Secret KILO_MODEL não definida'}
              >
                {providerInfo.kilo.model || 'Defina KILO_MODEL'}
              </span>
              <a
                href="https://kilo.ai/docs/gateway"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] underline text-violet-600 dark:text-violet-400 hover:text-violet-800 ml-0.5"
                title="Ver documentação do Kilo AI Gateway"
              >
                Docs
              </a>
            </div>
          ) : (
            <div className="flex items-center bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setSelectedModel('gemini-3.5-flash')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  selectedModel === 'gemini-3.5-flash'
                    ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                title="Equilibrado, inteligente e ágil (Recomendado)"
              >
                Flash 3.5
              </button>
              <button
                onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  selectedModel === 'gemini-3.1-flash-lite'
                    ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                title="Respostas ultra rápidas para comandos do dia a dia"
              >
                Flash Lite
              </button>
              <button
                onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  selectedModel === 'gemini-3.1-pro-preview'
                    ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
                title="Raciocínio profundo para planejamento e análises complexas"
              >
                Pro 3.1
              </button>
            </div>
          )}

          {/* Max Steps Selector (up to 60) */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs text-neutral-600 dark:text-neutral-300">
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
            <span>Até</span>
            <select
              value={maxSteps}
              onChange={(e) => setMaxSteps(Number(e.target.value))}
              className="bg-transparent font-semibold text-neutral-900 dark:text-neutral-100 focus:outline-none cursor-pointer"
            >
              <option value={15}>15 steps</option>
              <option value={30}>30 steps</option>
              <option value={60}>60 steps (Máx)</option>
            </select>
          </div>

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

      {/* Alert banner if KILO_API_KEY is present but KILO_MODEL is not set yet */}
      {providerInfo?.kilo?.isConfigured && !providerInfo?.kilo?.hasModelSecret && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-850 px-4 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Kilo AI Gateway detectado:</strong> A chave <code>KILO_API_KEY</code> está configurada. Para ativar, defina a secret <code>KILO_MODEL</code> (ex: <code>anthropic/claude-3-5-sonnet</code> ou <code>openai/gpt-4o</code>) no painel de Secrets ou no arquivo <code>.env</code>.
            </span>
          </div>
          <a
            href="https://kilo.ai/docs/gateway"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold ml-2 shrink-0 text-amber-900 dark:text-amber-200 hover:opacity-80"
          >
            Docs Gateway
          </a>
        </div>
      )}

      {/* Notice banner if no AI provider is configured yet */}
      {providerInfo && providerInfo.activeProvider === 'none' && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-850 px-4 py-2.5 text-xs text-blue-850 dark:text-blue-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Integração Kilo AI Gateway:</strong> Biblioteca OpenAI compatível pronta para uso. Adicione as secrets <code>KILO_API_KEY</code> e <code>KILO_MODEL</code> nas Secrets ou no <code>.env</code>.
            </span>
          </div>
          <a
            href="https://kilo.ai/docs/gateway"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold ml-2 shrink-0 text-blue-900 dark:text-blue-200 hover:opacity-80"
          >
            https://kilo.ai/docs/gateway
          </a>
        </div>
      )}

      {/* Active Session Status Banner */}
      {activeSession ? (
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200/80 dark:border-amber-900/50 px-4 py-2 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 truncate">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="font-semibold">Timer ativo no servidor:</span>
            <span className="font-medium truncate">{activeSession.title}</span>
            {activeSession.Client && (
              <span className="text-amber-700 dark:text-amber-300">
                • {activeSession.Client.name}
              </span>
            )}
            {activeSession.Tasks && activeSession.Tasks.length > 0 && (
              <span className="text-neutral-500 dark:text-neutral-400">
                ({activeSession.Tasks.length} tarefas)
              </span>
            )}
          </div>
          <button
            onClick={onNavigateToTimer}
            className="text-amber-800 dark:text-amber-300 font-semibold underline hover:text-amber-950 shrink-0 ml-2 cursor-pointer"
          >
            Ver cronômetro
          </button>
        </div>
      ) : null}

      {/* Messages Scrollable Thread */}
      <div
        id="ai-messages-scroll-area"
        className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 transition-colors ${
          isDragOver ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
        }`}
      >
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
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Eu posso iniciar seu cronômetro, adicionar anotações e tarefas, buscar histórico de sessões,
                analisar imagens (tickets, mockups, anotações) e executar fluxos complexos em até 60 etapas automáticas.
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
                className={`flex gap-3 max-w-3xl ${
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
                  className={`flex flex-col space-y-2 rounded-2xl p-4 text-sm leading-relaxed max-w-[88%] sm:max-w-[85%] ${
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
                  {msg.steps && msg.steps.length > 0 && (
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
                          } else if (step.tool === 'stop_timer') {
                            toolLabel = 'Finalizar Cronômetro';
                            toolIcon = Square;
                          } else if (step.tool === 'add_task_to_timer') {
                            toolLabel = 'Adicionar Tarefa';
                            toolIcon = PlusCircle;
                          } else if (step.tool === 'add_multiple_tasks_to_timer') {
                            toolLabel = 'Adicionar Múltiplas Tarefas';
                            toolIcon = PlusCircle;
                          } else if (step.tool === 'search_history') {
                            toolLabel = 'Consultar Histórico';
                            toolIcon = Search;
                          } else if (step.tool === 'get_active_session') {
                            toolLabel = 'Verificar Sessão Ativa';
                            toolIcon = Clock;
                          } else if (step.tool === 'get_financial_summary') {
                            toolLabel = 'Resumo Financeiro';
                            toolIcon = Sparkles;
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
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                )}
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

                  {/* Main Message Text (with Markdown for AI messages) */}
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="markdown-body prose dark:prose-invert prose-sm max-w-none text-neutral-800 dark:text-neutral-200 space-y-2">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  )}

                  {/* Message Footer: Actions & Copy */}
                  {!isUser && (
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-200/50 dark:border-neutral-700/40 text-[10px] text-neutral-400">
                      <div className="flex items-center gap-1.5">
                        <span>Cronos AI</span>
                        {msg.provider === 'kilo' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 rounded font-medium text-[9px]">
                            ⚡ Kilo Gateway{msg.model ? ` • ${msg.model}` : ''}
                          </span>
                        ) : null}
                      </div>
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

        {/* Pending state while agentic loop / Gemini runs */}
        {loading && (
          <div className="flex gap-3 max-w-3xl mr-auto">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-xs animate-pulse">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="rounded-2xl rounded-tl-xs p-4 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <Cpu className="w-4 h-4 animate-spin" />
                <span>Processando com Gemini e executando ferramentas (até {maxSteps} steps)...</span>
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

      {/* Input Area Footer */}
      <div className="p-3 sm:p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
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
        <div className="flex items-end gap-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-2 shadow-2xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            multiple
            className="hidden"
          />

          {/* Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer shrink-0"
            title="Anexar imagem (ou cole com Ctrl+V)"
          >
            <ImageIcon className="h-5 w-5" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              attachedImages.length > 0
                ? 'Instrua a IA sobre a imagem (ex: "Extraia as tarefas e inicie o timer")...'
                : 'Peça para iniciar o timer, buscar histórico, ou anexe uma imagem de tarefas... (Shift+Enter pula linha)'
            }
            rows={1}
            disabled={loading}
            className="flex-1 max-h-32 min-h-[36px] bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none resize-none py-1.5 leading-relaxed"
          />

          {/* Send Button */}
          <Button
            onClick={() => handleSendMessage()}
            disabled={(!inputText.trim() && attachedImages.length === 0) || loading}
            className="h-9 px-3.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 font-semibold text-xs cursor-pointer shadow-xs shrink-0 rounded-lg disabled:opacity-40"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-1.5" />
                <span>Enviar</span>
              </>
            )}
          </Button>
        </div>

        {/* Drag & Paste helper info */}
        <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-neutral-400 dark:text-neutral-500">
          <span>Dica: Cole capturas de tela diretamente com Ctrl+V ou arraste imagens aqui.</span>
          <span className="hidden sm:inline">Suporta até 60 steps automáticos</span>
        </div>
      </div>
    </div>
  );
}
