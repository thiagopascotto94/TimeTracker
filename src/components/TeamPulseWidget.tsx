import React, { useState, useEffect } from 'react';
import { Users, Clock, Briefcase, Sparkles, RefreshCw } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { calculateElapsedMs, formatTimeHHMMSS } from '../utils/format';

export interface LiveMemberActivity {
  session_id: string;
  user_id: string;
  name: string;
  email: string;
  title: string;
  start_time: string;
  client?: {
    id: string;
    name: string;
    code?: string;
    color?: string;
  } | null;
  hourly_rate?: number | null;
}

interface TeamPulseWidgetProps {
  onFilterByUser?: (userId: string) => void;
}

export function TeamPulseWidget({ onFilterByUser }: TeamPulseWidgetProps) {
  const [liveMembers, setLiveMembers] = useState<LiveMemberActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [now, setNow] = useState<number>(Date.now());

  const fetchLiveActivity = async () => {
    try {
      const res = await apiFetch('/api/workspaces/live-activity');
      if (res.ok) {
        const data = await res.json();
        setLiveMembers(data.members || []);
      }
    } catch (e) {
      console.warn('Failed to fetch team live activity:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveActivity();
    const interval = setInterval(fetchLiveActivity, 30000); // Poll every 30s
    const timeInterval = setInterval(() => setNow(Date.now()), 1000); // Live tick every 1s

    const handleWsEvent = () => {
      fetchLiveActivity();
    };
    window.addEventListener('workspace-changed', handleWsEvent);

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
      window.removeEventListener('workspace-changed', handleWsEvent);
    };
  }, []);

  if (loading && liveMembers.length === 0) {
    return null;
  }

  if (liveMembers.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-neutral-500"></span>
            </div>
            <h3 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 tracking-tight flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-neutral-500" />
              <span>Team Pulse — Atividade da Equipe</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={fetchLiveActivity}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-1 rounded transition-colors cursor-pointer"
            title="Atualizar Team Pulse"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        <p className="text-2xs text-neutral-500 dark:text-neutral-400 mt-2">
          Nenhum colega de equipe com o timer ativo no momento. Quando sua equipe iniciar sessões, elas aparecerão aqui em tempo real.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/40 via-white to-neutral-50/50 dark:from-emerald-950/20 dark:via-[#0a0a0a] dark:to-neutral-900 p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-300 tracking-tight flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Team Pulse — Trabalhando Agora</span>
          </h3>
          <span className="text-2xs px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {liveMembers.length} {liveMembers.length === 1 ? 'ativo' : 'ativos'}
          </span>
        </div>
        <button
          type="button"
          onClick={fetchLiveActivity}
          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-1 rounded transition-colors cursor-pointer"
          title="Atualizar Team Pulse"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {liveMembers.map((member) => {
          const elapsed = calculateElapsedMs(member.start_time);
          const initials = member.name
            ? member.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()
            : 'MB';

          return (
            <div
              key={member.session_id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40 bg-white dark:bg-neutral-900 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs relative">
                  {initials}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-neutral-900 rounded-full"></span>
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                      {member.name}
                    </span>
                    {member.client && (
                      <span
                        className="text-2xs font-semibold px-2 py-0.5 rounded-md text-white truncate max-w-[120px]"
                        style={{ backgroundColor: member.client.color || '#6366f1' }}
                      >
                        {member.client.name}
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-neutral-600 dark:text-neutral-300 font-medium truncate max-w-[220px]">
                    {member.title || 'Sessão de trabalho em andamento'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0 gap-1">
                <div className="inline-flex items-center gap-1 text-2xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800">
                  <Clock className="w-3 h-3 animate-pulse" />
                  <span>{formatTimeHHMMSS(elapsed)}</span>
                </div>
                {onFilterByUser && (
                  <button
                    type="button"
                    onClick={() => onFilterByUser(member.user_id)}
                    className="text-3xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Ver histórico
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
