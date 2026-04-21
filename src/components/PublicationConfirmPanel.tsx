/**
 * PublicationConfirmPanel — shown to the "publikator" role.
 * Per-platform confirmation: each platform can be marked published individually.
 * Task completes automatically when all platforms with scheduled dates are confirmed.
 */
import { Facebook, Instagram, Youtube, ExternalLink, CalendarDays, CheckCircle2, Film, Circle } from 'lucide-react';

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.74a8.18 8.18 0 0 0 4.79 1.52V6.79a4.85 4.85 0 0 1-1.02-.1z"/>
  </svg>
);

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { tryParseSocialDescriptions } from '@/components/SocialDescriptionsDisplay';
import { tryParseSocialDates } from '@/components/SocialDatesWidget';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface PlatformConfig {
  key: string;
  dateKey: string;
  label: string;
  icon: React.ReactNode;
}

const PLATFORMS: PlatformConfig[] = [
  { key: 'facebook',  dateKey: 'facebookDate',  label: 'Facebook',  icon: <Facebook   className="h-4 w-4 text-[#1877F2]" /> },
  { key: 'tiktok',    dateKey: 'tiktokDate',    label: 'TikTok',    icon: <TikTokIcon className="h-4 w-4 text-foreground" /> },
  { key: 'instagram', dateKey: 'instagramDate', label: 'Instagram', icon: <Instagram  className="h-4 w-4 text-[#E4405F]" /> },
  { key: 'youtube',   dateKey: 'youtubeDate',   label: 'YouTube',   icon: <Youtube    className="h-4 w-4 text-[#FF0000]" /> },
];

interface Props {
  videoUrl: string | null;
  descriptionsJson: string | null;
  datesJson: string | null;
  /** Current saved value (partial confirmations JSON or null) */
  currentValue: string | null;
  /** Called after each per-platform toggle — saves intermediate state */
  onConfirmPlatform: (value: string) => void;
  /** Called when all platforms with dates are confirmed — completes task */
  onConfirmAll: (value: string) => void;
}

const PublicationConfirmPanel = ({
  videoUrl, descriptionsJson, datesJson, currentValue, onConfirmPlatform, onConfirmAll,
}: Props) => {
  const texts = tryParseSocialDescriptions(descriptionsJson) as Record<string, string> | null;
  const dates = tryParseSocialDates(datesJson) as Record<string, string> | null;

  // Parse current confirmation state — values are ISO timestamp strings, boolean true (legacy), or null
  const confirmed: Record<string, string | boolean | null> = (() => {
    if (!currentValue) return {};
    try { return JSON.parse(currentValue); } catch { return {}; }
  })();
  // Helper: is platform confirmed (handles both ISO string and legacy boolean true)
  const isPlatformDone = (key: string) => !!confirmed[key];
  // Helper: ISO timestamp string or null (legacy booleans have no timestamp)
  const getPlatformTimestamp = (key: string): string | null => {
    const v = confirmed[key];
    return typeof v === 'string' ? v : null;
  };

  const formatDate = (dateStr: string | undefined): string | null => {
    if (!dateStr) return null;
    try { return format(new Date(dateStr), 'dd.MM.yyyy', { locale: pl }); }
    catch { return null; }
  };

  const formatDateTime = (dateStr: string | null | undefined): string | null => {
    if (!dateStr) return null;
    try { return format(new Date(dateStr), 'dd.MM.yyyy, HH:mm', { locale: pl }); }
    catch { return null; }
  };

  // Only platforms that have a date set require confirmation
  const activePlatforms = PLATFORMS.filter(p => dates?.[p.dateKey]);
  const allConfirmed = activePlatforms.length > 0 && activePlatforms.every(p => isPlatformDone(p.key));

  const togglePlatform = (platformKey: string) => {
    const isCurrentlyDone = isPlatformDone(platformKey);
    const next: Record<string, string | null> = {
      ...Object.fromEntries(Object.entries(confirmed).map(([k, v]) => [k, typeof v === 'string' ? v : null])),
      [platformKey]: isCurrentlyDone ? null : new Date().toISOString(),
    };
    const value = JSON.stringify(next);
    onConfirmPlatform(value);
    // Auto-complete if all active platforms are now confirmed
    const allDone = activePlatforms.every(p => !!next[p.key]);
    if (allDone) onConfirmAll(value);
  };

  return (
    <div className="space-y-4">
      {/* Video link */}
      <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <Film className="h-3.5 w-3.5" />
          Zatwierdzony link do materiału
        </div>
        {videoUrl ? (
          <a href={videoUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline break-all">
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            {videoUrl}
          </a>
        ) : (
          <p className="text-sm text-muted-foreground italic">Brak linku do materiału</p>
        )}
      </div>

      {/* Per-platform section */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Potwierdzenie publikacji
        </p>

        {PLATFORMS.map(p => {
          const text = texts?.[p.key];
          const plannedDateStr = formatDate(dates?.[p.dateKey]);
          const plannedRaw = dates?.[p.dateKey];
          const isActive = !!plannedDateStr;
          const confirmedAt = getPlatformTimestamp(p.key);
          const isDone = isPlatformDone(p.key);
          const isLate = confirmedAt && plannedRaw
            ? new Date(confirmedAt) > new Date(plannedRaw)
            : false;
          const dateStr = plannedDateStr;

          if (!isActive && !text) return null; // hide platforms with nothing set

          return (
            <div key={p.key} className={`rounded-lg border px-4 py-3 space-y-2 transition-colors ${
              !isActive
                ? 'border-border bg-muted/20 opacity-50'
                : isDone
                  ? 'border-success/40 bg-success/5'
                  : 'border-border bg-card'
            }`}>
              {/* Platform header */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {p.icon}
                  <span className="text-sm font-semibold">{p.label}</span>
                  {dateStr ? (
                    <Badge variant="secondary" className="gap-1 text-[11px] border-0 shrink-0">
                      <CalendarDays className="h-3 w-3" />
                      {dateStr}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
                      Brak daty
                    </Badge>
                  )}
                </div>

                {/* Per-platform confirm toggle */}
                {isActive && (
                  <button
                    onClick={() => togglePlatform(p.key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      isDone
                        ? isLate
                          ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                          : 'bg-success/10 text-success hover:bg-success/20'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                    }`}
                  >
                    {isDone
                      ? <><CheckCircle2 className="h-3.5 w-3.5" />Opublikowano</>
                      : <><Circle className="h-3.5 w-3.5" />Potwierdź</>
                    }
                  </button>
                )}
              </div>

              {/* Description */}
              {text ? (
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{text}</p>
              ) : (
                <p className="text-xs text-muted-foreground italic">Brak opisu</p>
              )}

              {/* Confirmation timestamp */}
              {isDone && confirmedAt && (
                <div className={`flex items-center gap-1 text-[11px] ${isLate ? 'text-destructive' : 'text-muted-foreground'}`}>
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  <span>Wykonano: {formatDateTime(confirmedAt)}</span>
                  {isLate && <span className="font-medium">(po terminie)</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary — only show when all confirmed (task will auto-complete, this is informational) */}
      {allConfirmed && (
        <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <span className="text-sm font-medium text-success">Wszystkie platformy potwierdzone</span>
        </div>
      )}

      {/* Progress hint when partially done */}
      {!allConfirmed && activePlatforms.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {activePlatforms.filter(p => confirmed[p.key]).length} / {activePlatforms.length} platform potwierdzonych
        </p>
      )}
    </div>
  );
};

export default PublicationConfirmPanel;
