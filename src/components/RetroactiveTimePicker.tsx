import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock,
  History,
  AlertCircle,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import dayjs from 'dayjs';

interface RetroactiveTimePickerProps {
  maxAllowedMinutes: number;
  onTimeChange: (data: {
    selectedTimeStr: string;
    calculatedMinutes: number;
    isValid: boolean;
    startTimeIso: string;
  }) => void;
}

export function RetroactiveTimePicker({
  maxAllowedMinutes,
  onTimeChange,
}: RetroactiveTimePickerProps) {
  const onTimeChangeRef = useRef(onTimeChange);
  onTimeChangeRef.current = onTimeChange;

  const [currentTime, setCurrentTime] = useState(() => dayjs());

  // Periodically refresh current time every 15s to keep calculations synced
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Initial selected time: 15 minutes before now (or capped at maxAllowedMinutes if less)
  const initialOffset = Math.min(15, Math.max(1, maxAllowedMinutes > 0 ? Math.min(15, maxAllowedMinutes) : 15));

  const [selectedHours, setSelectedHours] = useState(() => {
    return dayjs().subtract(initialOffset, 'minute').hour();
  });
  const [selectedMinutes, setSelectedMinutes] = useState(() => {
    return dayjs().subtract(initialOffset, 'minute').minute();
  });

  // Calculate target date/time and difference in minutes
  const calculation = useMemo(() => {
    const now = currentTime;
    let target = now.hour(selectedHours).minute(selectedMinutes).second(0).millisecond(0);

    // If target is after now:
    // Check if within 60 seconds (clamp to now) or if it crossed midnight (e.g. now is 00:30 and target is 23:45)
    if (target.isAfter(now)) {
      const diffFutureSeconds = target.diff(now, 'second');
      if (diffFutureSeconds <= 60) {
        target = now;
      } else if (selectedHours > now.hour() && (24 - selectedHours + now.hour()) * 60 <= maxAllowedMinutes) {
        // Cross-midnight yesterday
        target = target.subtract(1, 'day');
      }
    }

    const diffSeconds = now.diff(target, 'second');
    const diffMinutes = Math.round(diffSeconds / 60);
    const isFuture = target.isAfter(now) && diffMinutes < 0;
    const isExceeded = diffMinutes > maxAllowedMinutes;
    const isZero = diffMinutes <= 0 && !isFuture;

    const isValid = !isFuture && diffMinutes > 0 && diffMinutes <= maxAllowedMinutes;

    return {
      targetIso: target.toISOString(),
      diffMinutes: Math.max(0, diffMinutes),
      isFuture,
      isExceeded,
      isZero,
      isValid,
      timeStr: `${String(selectedHours).padStart(2, '0')}:${String(selectedMinutes).padStart(2, '0')}`,
      nowStr: now.format('HH:mm'),
    };
  }, [currentTime, selectedHours, selectedMinutes, maxAllowedMinutes]);

  // Safely notify parent only when values change
  useEffect(() => {
    onTimeChangeRef.current({
      selectedTimeStr: calculation.timeStr,
      calculatedMinutes: calculation.diffMinutes,
      isValid: calculation.isValid,
      startTimeIso: calculation.targetIso,
    });
  }, [calculation.timeStr, calculation.diffMinutes, calculation.isValid, calculation.targetIso]);

  const setTimeByOffset = (minutesAgo: number) => {
    const newTarget = currentTime.subtract(minutesAgo, 'minute');
    setSelectedHours(newTarget.hour());
    setSelectedMinutes(newTarget.minute());
  };

  const handleHourChange = (newHour: number) => {
    const normalized = (newHour + 24) % 24;
    setSelectedHours(normalized);
  };

  const handleMinuteChange = (newMin: number) => {
    if (newMin >= 60) {
      handleHourChange(selectedHours + 1);
      setSelectedMinutes(newMin % 60);
    } else if (newMin < 0) {
      handleHourChange(selectedHours - 1);
      setSelectedMinutes((newMin + 60) % 60);
    } else {
      setSelectedMinutes(newMin);
    }
  };

  // SVG Clock Hand Radians & Coordinates (viewBox 0 0 120 120, center 60,60)
  const hourAngleDeg = ((selectedHours % 12) + selectedMinutes / 60) * 30;
  const minuteAngleDeg = selectedMinutes * 6;

  const hourRad = (hourAngleDeg * Math.PI) / 180;
  const minRad = (minuteAngleDeg * Math.PI) / 180;

  const hourX2 = 60 + 26 * Math.sin(hourRad);
  const hourY2 = 60 - 26 * Math.cos(hourRad);

  const minX2 = 60 + 38 * Math.sin(minRad);
  const minY2 = 60 - 38 * Math.cos(minRad);

  // Hour tick marks around the clock
  const hourTicks = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const angle = (i * 30 * Math.PI) / 180;
      const isQuarter = i % 3 === 0;
      const rInner = isQuarter ? 48 : 51;
      const rOuter = 55;
      return {
        x1: 60 + rInner * Math.sin(angle),
        y1: 60 - rInner * Math.cos(angle),
        x2: 60 + rOuter * Math.sin(angle),
        y2: 60 - rOuter * Math.cos(angle),
        isQuarter,
        label: i === 0 ? '12' : String(i),
      };
    });
  }, []);

  // Quick preset offsets in minutes
  const presets = [5, 10, 15, 30, 45, 60, 90, 120].filter((m) => m <= maxAllowedMinutes);

  return (
    <div className="space-y-4">
      {/* Visual Clock + Digital Controls Card */}
      <div className="p-4 rounded-xl border border-indigo-200/90 dark:border-indigo-900/60 bg-white dark:bg-neutral-900 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center gap-6 justify-between">
          {/* Analog Clock Face (SVG) */}
          <div className="flex flex-col items-center select-none">
            <div className="relative w-32 h-32">
              <svg
                viewBox="0 0 120 120"
                className="w-32 h-32 filter drop-shadow-xs"
              >
                {/* Clock Outer Rim */}
                <circle
                  cx="60"
                  cy="60"
                  r="57"
                  className="fill-neutral-50 dark:fill-neutral-950 stroke-indigo-600 dark:stroke-indigo-500"
                  strokeWidth="4"
                />

                {/* Dial Ticks */}
                {hourTicks.map((t, idx) => (
                  <line
                    key={idx}
                    x1={t.x1}
                    y1={t.y1}
                    x2={t.x2}
                    y2={t.y2}
                    stroke="currentColor"
                    strokeWidth={t.isQuarter ? 2.5 : 1.2}
                    className={t.isQuarter ? 'text-indigo-500/80 dark:text-indigo-400' : 'text-neutral-300 dark:text-neutral-700'}
                    strokeLinecap="round"
                  />
                ))}

                {/* Hour Numbers for Cardinal Hours */}
                <text x="60" y="22" textAnchor="middle" dominantBaseline="middle" className="text-[10px] font-bold fill-neutral-500 dark:fill-neutral-400">
                  12
                </text>
                <text x="100" y="60.5" textAnchor="middle" dominantBaseline="middle" className="text-[10px] font-bold fill-neutral-500 dark:fill-neutral-400">
                  3
                </text>
                <text x="60" y="100" textAnchor="middle" dominantBaseline="middle" className="text-[10px] font-bold fill-neutral-500 dark:fill-neutral-400">
                  6
                </text>
                <text x="20" y="60.5" textAnchor="middle" dominantBaseline="middle" className="text-[10px] font-bold fill-neutral-500 dark:fill-neutral-400">
                  9
                </text>

                {/* Hour Hand */}
                <line
                  x1="60"
                  y1="60"
                  x2={hourX2}
                  y2={hourY2}
                  className="stroke-neutral-800 dark:stroke-neutral-200 transition-all duration-150"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Minute Hand */}
                <line
                  x1="60"
                  y1="60"
                  x2={minX2}
                  y2={minY2}
                  className="stroke-indigo-600 dark:stroke-indigo-400 transition-all duration-150"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />

                {/* Center Pivot */}
                <circle cx="60" cy="60" r="3.5" className="fill-indigo-600 dark:fill-indigo-400" />
                <circle cx="60" cy="60" r="1.5" className="fill-white dark:fill-neutral-900" />
              </svg>
            </div>

            <div className="mt-2 text-3xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-indigo-500" />
              Relógio Interativo
            </div>
          </div>

          {/* Digital Clock Inputs & Controls */}
          <div className="flex-1 w-full space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Definir Horário de Início</span>
              </label>
              <button
                type="button"
                onClick={() => setTimeByOffset(15)}
                className="text-2xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                title="Voltar para 15 minutos atrás"
              >
                <RotateCcw className="w-3 h-3" />
                Redefinir (-15m)
              </button>
            </div>

            {/* Digital Clock Spinners Box */}
            <div className="flex items-center justify-center sm:justify-start gap-2.5 bg-neutral-50 dark:bg-neutral-850 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700/80 shadow-2xs">
              {/* Hour Spinner */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleHourChange(selectedHours + 1)}
                  className="p-1 rounded-md text-neutral-500 hover:text-indigo-600 hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                  aria-label="Aumentar hora"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  maxLength={2}
                  value={String(selectedHours).padStart(2, '0')}
                  onChange={(e) => {
                    const num = parseInt(e.target.value.replace(/\D/g, ''), 10);
                    if (!isNaN(num)) {
                      setSelectedHours(Math.max(0, Math.min(23, num)));
                    }
                  }}
                  className="w-14 text-center font-mono font-bold text-2xl py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleHourChange(selectedHours - 1)}
                  className="p-1 rounded-md text-neutral-500 hover:text-indigo-600 hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                  aria-label="Diminuir hora"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <span className="text-3xs font-semibold text-neutral-400 mt-0.5 tracking-wider">HORAS</span>
              </div>

              <span className="text-2xl font-bold font-mono text-neutral-400 dark:text-neutral-500 -mt-4">:</span>

              {/* Minute Spinner */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleMinuteChange(selectedMinutes + 1)}
                  className="p-1 rounded-md text-neutral-500 hover:text-indigo-600 hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                  aria-label="Aumentar minuto"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  maxLength={2}
                  value={String(selectedMinutes).padStart(2, '0')}
                  onChange={(e) => {
                    const num = parseInt(e.target.value.replace(/\D/g, ''), 10);
                    if (!isNaN(num)) {
                      setSelectedMinutes(Math.max(0, Math.min(59, num)));
                    }
                  }}
                  className="w-14 text-center font-mono font-bold text-2xl py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleMinuteChange(selectedMinutes - 1)}
                  className="p-1 rounded-md text-neutral-500 hover:text-indigo-600 hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                  aria-label="Diminuir minuto"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <span className="text-3xs font-semibold text-neutral-400 mt-0.5 tracking-wider">MINUTOS</span>
              </div>

              {/* Incremental Steppers */}
              <div className="flex flex-col gap-1.5 ml-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleMinuteChange(selectedMinutes - 15)}
                    className="px-2 py-1 text-2xs font-semibold rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="Retroagir 15 minutos"
                  >
                    -15m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMinuteChange(selectedMinutes - 5)}
                    className="px-2 py-1 text-2xs font-semibold rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="Retroagir 5 minutos"
                  >
                    -5m
                  </button>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleMinuteChange(selectedMinutes + 5)}
                    className="px-2 py-1 text-2xs font-semibold rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="Adiantar 5 minutos"
                  >
                    +5m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMinuteChange(selectedMinutes + 15)}
                    className="px-2 py-1 text-2xs font-semibold rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="Adiantar 15 minutos"
                  >
                    +15m
                  </button>
                </div>
              </div>
            </div>

            {/* Native Time Picker Sync */}
            <div className="flex items-center justify-between text-2xs text-neutral-500 dark:text-neutral-400 px-1 pt-0.5">
              <span>Seletor de hora nativo:</span>
              <input
                type="time"
                value={calculation.timeStr}
                onChange={(e) => {
                  if (e.target.value) {
                    const [h, m] = e.target.value.split(':').map(Number);
                    setSelectedHours(h);
                    setSelectedMinutes(m);
                  }
                }}
                className="px-2 py-0.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-xs text-neutral-800 dark:text-neutral-200 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Calculated Minutes Result */}
      <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-600 dark:text-neutral-300">Horário atual:</span>
            <span className="text-xs font-mono font-bold text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 px-2 py-0.5 rounded border border-neutral-200 dark:border-neutral-800">
              {calculation.nowStr}
            </span>
            <span className="text-neutral-400">➔</span>
            <span className="text-xs text-neutral-600 dark:text-neutral-300">Horário de início:</span>
            <span className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-neutral-900 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
              {calculation.timeStr}
            </span>
          </div>

          {/* System Calculated Minutes */}
          <div className="flex items-center gap-1.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Minutos Calculados:
            </span>
            <span className="text-sm font-bold font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2.5 py-0.5 rounded-md border border-indigo-300 dark:border-indigo-700">
              {calculation.diffMinutes} min decorridos
            </span>
          </div>
        </div>

        {/* Validation Alerts */}
        {calculation.isFuture && (
          <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2 rounded-lg border border-red-200 dark:border-red-900/60">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              O horário selecionado ({calculation.timeStr}) está no futuro. Selecione um horário anterior ao momento atual ({calculation.nowStr}).
            </span>
          </div>
        )}

        {calculation.isExceeded && (
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-900/60">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              O horário selecionado ({calculation.timeStr}) equivale a {calculation.diffMinutes} minutos atrás, o que excede o limite de {maxAllowedMinutes} minutos ({Math.floor(maxAllowedMinutes / 60)}h) deste workspace.
            </span>
          </div>
        )}

        {calculation.isZero && (
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-900/60">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              O horário selecionado é o mesmo de agora. Se você está começando agora, inicie o timer normalmente ou escolha um horário no passado.
            </span>
          </div>
        )}

        {calculation.isValid && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Horário válido: o cronômetro começará contabilizando <strong>{calculation.diffMinutes} minutos</strong> ({Math.floor(calculation.diffMinutes / 60)}h {calculation.diffMinutes % 60}m) já decorridos.
            </span>
          </div>
        )}
      </div>

      {/* Quick Clock Presets (Relative to now) */}
      <div className="space-y-1.5">
        <label className="text-2xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Atalhos Rápidos de Horário:
        </label>
        <div className="flex flex-wrap gap-2">
          {presets.map((mins) => {
            const presetTime = currentTime.subtract(mins, 'minute').format('HH:mm');
            const isSelected = calculation.diffMinutes === mins;
            return (
              <button
                key={mins}
                type="button"
                onClick={() => setTimeByOffset(mins)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500 shadow-2xs'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <Clock className="w-3 h-3 opacity-70" />
                <span>{presetTime}</span>
                <span className="text-3xs opacity-80">({mins < 60 ? `-${mins}m` : `-${mins / 60}h`})</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
