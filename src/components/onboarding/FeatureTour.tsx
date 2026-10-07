'use client';

import { useEffect, useState } from 'react';
import { Search, Map, GitBranch, MapPin, Bus, Train, ArrowRight, X } from 'lucide-react';

const STORAGE_KEY = 'metropol-feature-tour-seen';

interface FeatureTourProps {
  /** Si true, muestra el tour apenas se monta. Si false, no se muestra. */
  show: boolean;
  /** Callback cuando el usuario cierra el tour (skip o finish). */
  onClose: () => void;
}

interface Step {
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Íconos secundarios que aparecen en el cuerpo del step. */
  extras?: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; color: string }>;
}

const STEPS: Step[] = [
  {
    title: '4 formas de buscar tu viaje',
    body: 'Tocá una línea para ver su recorrido, usá tu GPS para paradas cercanas, planificá un viaje de A a B, o explorá el mapa en vivo.',
    icon: Search,
    extras: [
      { icon: Map, label: 'Línea', color: '#0EA5E9' },
      { icon: MapPin, label: 'Cerca', color: '#10B981' },
      { icon: Search, label: 'A → B', color: '#F59E0B' },
      { icon: Map, label: 'Mapa', color: '#8B5CF6' },
    ],
  },
  {
    title: 'Combiná con tren y subte',
    body: 'Las paradas con combinación muestran los modos disponibles (Roca, Mitre, Subte H/C). Tocá el badge para ver el siguiente horario y sentido.',
    icon: GitBranch,
    extras: [
      { icon: Train, label: 'Roca', color: '#1D4ED8' },
      { icon: Train, label: 'Mitre', color: '#7C3AED' },
      { icon: Bus, label: 'Subte H', color: '#FCD34D' },
      { icon: Bus, label: 'Subte C', color: '#1D4ED8' },
    ],
  },
  {
    title: 'Tu viaje paso a paso',
    body: 'Caminá hasta la parada, esperá tu colectivo, y bajate en la parada indicada. Si hay combinación, te guiamos en cada transbordo.',
    icon: ArrowRight,
  },
];

/**
 * Tour de features para usuarios nuevos. Se muestra UNA sola vez
 * (persistido en localStorage con clave 'metropol-feature-tour-seen').
 * Skipeable desde el primer paso.
 */
export function FeatureTour({ show, onClose }: FeatureTourProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setStep(0);
    }
  }, [show]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  const handleNext = () => {
    if (isLast) {
      handleFinish();
      return;
    }
    setStep((s) => s + 1);
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // localStorage no disponible (modo privado): seguimos sin persistir.
    }
    setVisible(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tour de features"
      className="fixed inset-0 z-[60] bg-ink/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-canvas rounded-3xl border border-hairline shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
            Tour · {step + 1}/{STEPS.length}
          </p>
          <button
            type="button"
            onClick={handleSkip}
            aria-label="Saltar tour"
            className="w-8 h-8 rounded-full bg-canvas-soft hover:bg-field flex items-center justify-center text-text-muted hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-5">
          <div className="w-14 h-14 rounded-2xl bg-electric-blue/10 flex items-center justify-center mx-auto">
            <Icon className="w-7 h-7 text-electric-blue" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-xl font-black text-ink text-center leading-tight">
            {current.title}
          </h2>
          <p className="mt-2 text-sm text-text-muted text-center leading-snug break-words">
            {current.body}
          </p>

          {current.extras && current.extras.length > 0 ? (
            <div className="mt-5 grid grid-cols-4 gap-2">
              {current.extras.map((extra, i) => {
                const ExtraIcon = extra.icon;
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-1.5 min-w-0"
                  >
                    <span
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: extra.color }}
                      aria-hidden="true"
                    >
                      <ExtraIcon className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] font-semibold text-text-muted truncate max-w-full px-0.5" title={extra.label}>
                      {extra.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pb-5">
          <div className="flex items-center gap-1.5" aria-label="Progreso del tour">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-ink' : 'w-1.5 bg-hairline'
                }`}
                aria-hidden
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="h-10 px-3 rounded-full text-xs font-bold text-text-muted hover:text-ink transition-colors"
              >
                Atrás
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleNext}
              className="h-10 px-5 rounded-full bg-ink text-canvas text-sm font-bold active:scale-[0.98] transition-transform"
            >
              {isLast ? 'Empezar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lee de localStorage si el tour ya fue visto. */
export function hasSeenFeatureTour(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
