import { PIPELINE_STAGES } from '@/data/mockData';

interface StepBadgeProps {
  order: number;
  variant?: 'default' | 'compact';
  className?: string;
}

/**
 * Pokazuje numer kroku w pipeline, np. "Krok 5 z 20".
 * Używane na kartach zadań i w sidebarze, aby użytkownik widział
 * od razu na jakim etapie produkcji jest dany pomysł.
 */
const StepBadge = ({ order, variant = 'default', className = '' }: StepBadgeProps) => {
  const total = PIPELINE_STAGES.length;
  const current = order + 1;

  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center rounded bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground leading-tight ${className}`}
        title={`Krok ${current} z ${total}`}
      >
        {current}/{total}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tracking-wide ${className}`}
      title={`Krok ${current} z ${total} w procesie produkcji`}
    >
      Krok {current} z {total}
    </span>
  );
};

export default StepBadge;
