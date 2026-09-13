import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Download, Check, Sparkles } from 'lucide-react';
import { requestNotificationPermission, showNativeNotification } from '../lib/notifications';
import { useToast } from './ui/toast';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PWANotificationBanner() {
  const { addToast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Check iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      addToast({
        title: 'Aplicativo instalado com sucesso!',
        description: 'Agora o TimeTracker está instalado como PWA no seu dispositivo.',
        variant: 'success',
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [addToast]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) {
      // If already installable or if browser doesn't fire prompt, notify user
      addToast({
        title: 'Instalação PWA',
        description: 'Para instalar, clique no menu do seu navegador (Chrome/Edge) e selecione "Instalar aplicativo" ou "Adicionar à tela inicial".',
        variant: 'amber',
      });
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  const handleToggleNotifications = async () => {
    if (!('Notification' in window)) {
      addToast({
        title: 'Não suportado',
        description: 'Seu navegador não suporta notificações nativas.',
        variant: 'destructive',
      });
      return;
    }

    if (notificationPermission === 'granted') {
      addToast({
        title: 'Notificações ativas',
        description: 'As notificações nativas já estão permitidas neste navegador.',
        variant: 'success',
      });
      showNativeNotification('TimeTracker', {
        body: 'Notificações nativas configuradas com sucesso! Você será avisado quando suas metas de tempo forem atingidas.',
      });
      return;
    }

    const granted = await requestNotificationPermission();
    setNotificationPermission(Notification.permission);

    if (granted) {
      addToast({
        title: 'Notificações Ativadas! 🔔',
        description: 'Você receberá alertas nativos quando suas sessões atingirem as metas.',
        variant: 'success',
      });
      showNativeNotification('TimeTracker - Notificações Ativadas', {
        body: 'Tudo pronto! Vamos monitorar seu tempo de trabalho.',
      });
    } else {
      addToast({
        title: 'Permissão negada',
        description: 'Você bloqueou as notificações. Para ativar, altere as permissões nas configurações do navegador.',
        variant: 'destructive',
      });
    }
  };

  if (isInstalled && notificationPermission === 'granted') {
    return null; // Already installed and notifications active, keep UI clean
  }

  return (
    <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white px-4 py-2.5 text-xs shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span className="font-medium">
            💡 Dica PWA: Ative notificações nativas para receber alertas de metas de tempo em segundo plano.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {notificationPermission !== 'granted' && (
            <button
              type="button"
              onClick={handleToggleNotifications}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-medium transition-colors cursor-pointer border border-white/20"
            >
              <Bell className="w-3.5 h-3.5 text-amber-300" />
              <span>Ativar Notificações</span>
            </button>
          )}

          {!isInstalled && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar</span>
            </button>
          )}
        </div>
      </div>

      {/* iOS Installation Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-neutral-900 p-6 shadow-2xl text-neutral-900 dark:text-neutral-100 space-y-4 border border-neutral-200 dark:border-neutral-800">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Instalar no iPhone / iPad
            </h3>
            <ol className="text-xs space-y-2 text-neutral-600 dark:text-neutral-300 list-decimal list-inside">
              <li>Abra esta página no <strong>Safari</strong> do iOS.</li>
              <li>Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta para cima) na barra inferior.</li>
              <li>Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</li>
              <li>Confirme tocando em <strong>Adicionar</strong>.</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs transition hover:bg-neutral-800 dark:hover:bg-neutral-200 cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
