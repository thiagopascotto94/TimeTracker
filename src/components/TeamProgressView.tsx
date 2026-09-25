import React from 'react';
import { Users, Target, ArrowLeft } from 'lucide-react';
import { TeamGoalsReportTab } from './TeamGoalsReportTab';
import { Button } from './ui/button';

interface TeamProgressViewProps {
  currentUser: any;
  setActiveTab: (tab: any) => void;
}

export function TeamProgressView({ currentUser, setActiveTab }: TeamProgressViewProps) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Top Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              Progresso Geral da Equipe
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Acompanhe em tempo real o andamento das horas trabalhadas, metas diárias e semanais de todos os membros do workspace.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('settings')}
            className="text-xs font-semibold cursor-pointer"
          >
            Configurar Metas da Equipe
          </Button>
        </div>
      </div>

      {/* Team Goals and Progress Report Tab */}
      <TeamGoalsReportTab currentUserId={currentUser?.id || ''} />
    </div>
  );
}
