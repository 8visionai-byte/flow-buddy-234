import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle } from 'lucide-react';

const SLA_MS = 48 * 60 * 60 * 1000;

interface SlaTimerProps {
  assignedAt: string | null;
  compact?: boolean;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.abs(ms) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  return `${minutes}m`;
}

const SlaTimer = ({ assignedAt, compact = false }: SlaTimerProps) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!assignedAt) return null;

  const deadline = new Date(assignedAt).getTime() + SLA_MS;
  const remaining = deadline - now;
  const overdue = remaining < 0;

  if (compact) {
    return (
      <Badge
        variant="secondary"
        className={`gap-1 text-xs font-medium border-0 ${
          overdue
            ? 'bg-destructive/10 text-destructive'
            : 'bg-success/10 text-success'
        }`}
      >
        {overdue ? (
          <AlertTriangle className="h-3 w-3" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
        {overdue ? `+${formatDuration(remaining)}` : formatDuration(remaining)}
      </Badge>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
        overdue
          ? 'bg-destructive/10 text-destructive'
          : 'bg-success/10 text-success'
      }`}
    >
      {overdue ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <Clock className="h-4 w-4" />
      )}
      <span>
        {overdue
          ? `Opóźnienie: ${formatDuration(remaining)}`
          : `Pozostało: ${formatDuration(remaining)}`}
      </span>
    </div>
  );
};

export default SlaTimer;
