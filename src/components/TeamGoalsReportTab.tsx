import React, { useState, useEffect } from 'react';
import { Target, CheckCircle2, AlertCircle, Clock, Users, TrendingUp, Award, Zap } from 'lucide-react';
import { TeamGoalsSummary } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { apiFetch } from '../utils/api';
import { useToast } from './ui/toast';

interface TeamGoalsReportTabProps {
  currentUserId: string;
}

export const TeamGoalsReportTab: React.FC<TeamGoalsReportTabProps> = ({ currentUserId }) => {
  const { addToast } = useToast();
  const [summary, setSummary] = useState<TeamGoalsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchGoalsProgress = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/workspaces/current/team-goals-progress`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao buscar metas da equipe');
      }
      const data = await res.json();
      setSummary(data);
    } catch (err: any) {
      console.error('Error fetching team goals progress:', err);
      try {
        const wsRes = await apiFetch('/api/workspaces');
        if (wsRes.ok) {
          const wsData = await wsRes.json();
          const activeWs = wsData.workspaces?.find((w: any) => w.id === localStorage.getItem('cronos_active_workspace_id')) || wsData.workspaces?.[0];
          if (activeWs) {
            const res2 = await apiFetch(`/api/workspaces/${activeWs.id}/team-goals-progress`);
            if (res2.ok) {
              const data2 = await res2.json();
              setSummary(data2);
              setLoading(false);
              return;
            }
          }
        }
      } catch (e) {}

      addToast({
        title: 'Erro',
        description: err.message || 'Não foi possível carregar as metas da equipe.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoalsProgress();
    const handleWsChange = () => fetchGoalsProgress();
    window.addEventListener('workspace-changed', handleWsChange);
    return () => window.removeEventListener('workspace-changed', handleWsChange);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>Aferição de Metas &amp; Projeção da Semana</span>
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Acompanhe o cumprimento das metas semanais e a projeção de entregas com base no ritmo atual da equipe.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-neutral-400 text-xs">Calculando progresso e projeção das metas da equipe...</div>
      ) : summary ? (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-neutral-200 dark:border-neutral-800 shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">Taxa de Cumprimento</p>
                  <h3 className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 mt-1">
                    {summary.team_overall_completion_rate}%
                  </h3>
                  <p className="text-3xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                    {summary.members_met_goal} de {summary.total_members_with_goals} com meta batida
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-neutral-200 dark:border-neutral-800 shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">Horas Realizadas</p>
                  <h3 className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 mt-1">
                    {summary.total_logged_hours}h
                  </h3>
                  <p className="text-3xs text-neutral-500 mt-1">
                    Meta total planejada: <strong className="font-mono">{summary.total_target_hours}h</strong>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-neutral-200 dark:border-neutral-800 shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">Projeção da Semana</p>
                  <h3 className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 mt-1">
                    {summary.projected_team_hours}h
                  </h3>
                  <p className="text-3xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                    Estimativa baseada no ritmo atual
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-neutral-200 dark:border-neutral-800 shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">Membros no Ritmo</p>
                  <h3 className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 mt-1">
                    {summary.members.filter((m) => m.week_status === 'met' || m.week_status === 'on_track').length}
                  </h3>
                  <p className="text-3xs text-neutral-500 mt-1">
                    De um total de {summary.members.length} colaboradores
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Members Table */}
          <Card className="border border-neutral-200 dark:border-neutral-800 shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Progresso e Projeção por Colaborador</span>
              </CardTitle>
              <CardDescription className="text-2xs">
                Acompanhe as horas realizadas e a projeção de fechamento semanal por membro.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Colaborador</th>
                      <th className="px-4 py-2.5 font-semibold">Função</th>
                      <th className="px-4 py-2.5 font-semibold">Meta Semanal</th>
                      <th className="px-4 py-2.5 font-semibold">Horas Realizadas</th>
                      <th className="px-4 py-2.5 font-semibold">Projeção (Fim da Semana)</th>
                      <th className="px-4 py-2.5 font-semibold min-w-[180px]">Progresso</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {summary.members.map((m) => {
                      const target = m.weekly_target_hours;
                      const hasGoal = target !== null && target !== undefined && target > 0;
                      const loggedHours = m.logged_hours_week;
                      const projectedHours = m.projected_hours_week;
                      const progressPercent = m.week_progress_percent;
                      const status = m.week_status;
                      const diff = Number((loggedHours - (target || 0)).toFixed(2));
                      const projectedDiff = Number((projectedHours - (target || 0)).toFixed(2));

                      return (
                        <tr key={m.userId} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                                {m.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                                  <span>{m.name}</span>
                                  {m.userId === currentUserId && (
                                    <Badge variant="outline" className="text-[9px] py-0 px-1 border-neutral-300 text-neutral-500">
                                      Você
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-2xs text-neutral-500 dark:text-neutral-400">{m.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={
                                m.role === 'owner' || m.role === 'admin'
                                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-2xs'
                                  : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 text-2xs'
                              }
                            >
                              {m.role === 'owner' ? 'Proprietário' : m.role === 'admin' ? 'Administrador' : 'Membro'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-neutral-800 dark:text-neutral-200">
                            {hasGoal ? `${target}h / sem` : <span className="text-neutral-400 italic">Sem meta definida</span>}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                            {loggedHours}h
                            {hasGoal && (
                              <span className={`ml-1.5 text-3xs font-normal ${diff >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                ({diff >= 0 ? `+${diff}h` : `${diff}h`})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-indigo-700 dark:text-indigo-300 font-semibold">
                            {hasGoal ? (
                              <div className="flex items-center gap-1.5">
                                <span>{projectedHours}h</span>
                                <span className={`text-3xs px-1 rounded ${projectedDiff >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>
                                  {projectedDiff >= 0 ? 'Meta Viável' : 'Abaixo da Meta'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-neutral-400 italic">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {hasGoal ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-3xs text-neutral-500">
                                  <span>{progressPercent}%</span>
                                  <span>{loggedHours}h / {target}h</span>
                                </div>
                                <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-2 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      status === 'met'
                                        ? 'bg-emerald-500'
                                        : status === 'on_track'
                                        ? 'bg-indigo-600'
                                        : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-3xs text-neutral-400 italic">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {status === 'met' ? (
                              <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-2xs gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Meta Atingida</span>
                              </Badge>
                            ) : status === 'on_track' ? (
                              <Badge className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 text-2xs gap-1">
                                <Clock className="w-3 h-3 text-indigo-600" />
                                <span>No Ritmo</span>
                              </Badge>
                            ) : status === 'behind' ? (
                              <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-2xs gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                <span>Abaixo</span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-neutral-400 text-3xs">
                                Sem Meta
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};
