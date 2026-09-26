'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, X } from 'lucide-react';

interface LocationConsentModalProps {
  /** Requests the browser's native location permission from this button gesture. */
  onUseReal: () => Promise<void>;
  /** Uses the fixed Parque Centenario demo reference. */
  onUseDemo: () => void;
  onClose: () => void;
}

export function LocationConsentModal({ onUseReal, onUseDemo, onClose }: LocationConsentModalProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    primaryRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const useRealLocation = async () => {
    setError(null);
    setIsRequesting(true);
    try {
      await onUseReal();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos usar tu ubicación real.');
    } finally {
      setIsRequesting(false);
    }
  };

  // Mirror of useRealLocation: the demo reference can also resolve to zero
  // nearby stops (openWizardForLocation throws synchronously), so catch it
  // here instead of letting the throw escape the button's onClick.
  const useDemoLocation = () => {
    setError(null);
    try {
      onUseDemo();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos usar la ubicación demo.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 backdrop-blur-md sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isRequesting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        className="w-full max-w-[360px] rounded-3xl border border-white/15 bg-canvas/92 p-5 shadow-[0_24px_70px_-16px_rgba(0,0,0,0.7)] ring-1 ring-ink/10 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200"
      >
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-hairline bg-canvas-soft">
            <Navigation className="h-5 w-5 text-electric-blue" />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRequesting}
            aria-label="Cerrar ubicación"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-canvas-soft text-text-muted transition-colors hover:bg-field hover:text-ink disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 id="consent-title" className="mt-3 text-lg font-bold text-ink">
          ¿Usamos tu ubicación?
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-text-muted">
          Para mostrarte las paradas cercanas, los colectivos que te sirven y cuándo llegan.
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-text-faint">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Podés usar tu ubicación actual o recorrer el flujo con Parque Centenario.</span>
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-medium leading-snug text-amber-800 dark:text-amber-200">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            ref={primaryRef}
            type="button"
            onClick={useRealLocation}
            disabled={isRequesting}
            className="min-h-[48px] w-full rounded-xl bg-ink text-sm font-bold text-canvas transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {isRequesting ? 'Buscando ubicación…' : 'Usar ubicación real'}
          </button>
          <button
            type="button"
            onClick={useDemoLocation}
            disabled={isRequesting}
            className="min-h-[44px] w-full rounded-xl border border-hairline bg-canvas-soft text-sm font-semibold text-ink transition-all hover:bg-field active:scale-[0.98] disabled:opacity-60"
          >
            Usar ubicación demo
          </button>
        </div>
      </div>
    </div>
  );
}
