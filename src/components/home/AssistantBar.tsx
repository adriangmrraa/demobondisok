/**
 * AssistantBar — INC-2/INC-4
 * Preguntas sugeridas del asistente del home (chips) + caja de texto libre.
 * Cada chip dispara un intent determinista (assistant-intent-service);
 * el copy vive en ASSISTANT_CHIPS para que UI y QA compartan las etiquetas.
 * El texto libre se envía tal cual: el parseo lo hace el padre con
 * parseAssistantQuery (mismo pipeline que los chips).
 * Tokens: DESIGN.MD (canvas-soft/hairline/ink). Íconos: lucide-react.
 */

'use client';

import { useRef, useState } from 'react';
import { Clock, MapPin, Compass, Footprints, Search, ArrowUp, X } from 'lucide-react';
import {
  ASSISTANT_CHIPS,
  type AssistantIntent,
} from '@/lib/services/assistant-intent-service';
import { cn } from '@/lib/utils';

const CHIP_ICONS: Record<AssistantIntent, React.ComponentType<{ className?: string }>> = {
  next_arrival: Clock,
  nearest_stop: MapPin,
  trip_plan: Compass,
  walk_timing: Footprints,
  unknown: Clock,
};

interface AssistantBarProps {
  onIntent: (intent: AssistantIntent) => void;
  /** Texto libre de la caja (Enter o botón). Se ignora si está vacío. */
  onFreeText?: (text: string) => void;
  /** Intent que está siendo resuelto / mostrado (chip activo). */
  activeIntent?: AssistantIntent | null;
  className?: string;
}

export function AssistantBar({ onIntent, onFreeText, activeIntent = null, className }: AssistantBarProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || !onFreeText) return;
    onFreeText(trimmed);
    setText('');
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Input: field fill en reposo, el borde aparece solo como anillo de
          foco en tinta (sistema de inputs del DESIGN.MD); submit ArrowUp en
          disco ink, clear X a la izquierda cuando hay texto. */}
      <div
        className={cn(
          'group flex items-center gap-2 rounded-full bg-field border border-transparent px-3.5 transition-shadow',
          'focus-within:ring-2 focus-within:ring-ink/20',
        )}
      >
        <Search className="w-4 h-4 shrink-0 text-text-muted transition-colors group-focus-within:text-ink" />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
            if (e.key === 'Escape') setText('');
          }}
          placeholder="Preguntá: ¿cuándo llega el 194?, ¿cómo llego a Once?…"
          aria-label="Preguntarle al asistente"
          className="flex-1 min-w-0 bg-transparent min-h-[46px] text-sm text-ink placeholder:text-text-faint focus:outline-none"
        />
        {text.trim() && (
          <button
            type="button"
            onClick={() => {
              setText('');
              inputRef.current?.focus();
            }}
            aria-label="Borrar pregunta"
            className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-text-muted hover:text-ink hover:bg-canvas-soft transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim()}
          aria-label="Enviar pregunta"
          className="w-8 h-8 shrink-0 rounded-full bg-ink text-canvas flex items-center justify-center active:scale-95 transition-all disabled:opacity-35 disabled:pointer-events-none"
        >
          <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>

      <div
        role="group"
        aria-label="Preguntas frecuentes al asistente"
        className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1"
      >
        {ASSISTANT_CHIPS.map(({ intent, label }) => {
          const Icon = CHIP_ICONS[intent];
          const active = activeIntent === intent;
          return (
            <button
              key={intent}
              type="button"
              onClick={() => onIntent(intent)}
              aria-pressed={active}
              className={cn(
                'shrink-0 min-h-[44px] inline-flex items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-all active:scale-[0.98]',
                active
                  ? 'bg-ink text-canvas border-ink shadow-sm'
                  : 'bg-canvas-soft text-ink border-hairline hover:bg-field',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
