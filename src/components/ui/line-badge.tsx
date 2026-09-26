import { cn } from '@/lib/utils';

interface LineBadgeProps {
  shortName: string;
  color?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function LineBadge({
  shortName,
  color,
  size = 'md',
  className,
}: LineBadgeProps) {
  const sizeClasses =
    size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-sm';

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center font-bold shrink-0 rounded-lg',
        sizeClasses,
        color ? 'text-white' : 'bg-ink text-canvas',
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
      aria-label={`Línea ${shortName}`}
    >
      {shortName}
    </div>
  );
}
