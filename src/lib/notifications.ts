export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Este navegador não suporta notificações nativas.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export function showNativeNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: '/icon.svg',
        ...options,
      });
    } catch (e) {
      console.warn('Falha ao emitir notificação nativa:', e);
    }
  }
}
