import dayjs from 'dayjs';

/**
 * Format milliseconds into HH:MM:SS
 */
export function formatTimeHHMMSS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format milliseconds into human readable e.g. "2h 35m" or "45m"
 */
export function formatDurationHuman(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

/**
 * Format currency in Brazilian Real (BRL)
 */
export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(val || 0);
}

/**
 * Format date & time in pt-BR
 */
export function formatDateTime(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('DD/MM/YYYY [às] HH:mm');
}

/**
 * Format simple date in pt-BR
 */
export function formatDateOnly(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('DD/MM/YYYY');
}

/**
 * Calculate resilient elapsed milliseconds against server start time
 */
export function calculateElapsedMs(startTime: string | Date): number {
  const startMs = new Date(startTime).getTime();
  return Math.max(0, Date.now() - startMs);
}
