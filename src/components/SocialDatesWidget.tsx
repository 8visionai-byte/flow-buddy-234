/**
 * SocialDatesWidget — used by admin (DZ) to set per-platform publication dates
 * after the influencer has submitted social descriptions.
 */
import { useState } from 'react';
import { Facebook, Instagram, Youtube, CheckCircle2, Check, AlertTriangle, Pencil, CopyCheck } from 'lucide-react';
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.74a8.18 8.18 0 0 0 4.79 1.52V6.79a4.85 4.85 0 0 1-1.02-.1z"/>
  </svg>
);
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { tryParseSocialDescriptions } from '@/components/SocialDescriptionsDisplay';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface PlatformConfig {
  key: string;
  dateKey: string;
  label: string;
  icon: React.ReactNode;
}

const PLATFORMS: PlatformConfig[] = [
  { key: 'facebook', dateKey: 'facebookDate', label: 'Facebook', icon: <Facebook className="h-4 w-4 text-[#1877F2]" /> },
  { key: 'tiktok', dateKey: 'tiktokDate', label: 'TikTok', icon: <TikTokIcon className="h-4 w-4 text-foreground" /> },
  { key: 'instagram', dateKey: 'instagramDate', label: 'Instagram', icon: <Instagram className="h-4 w-4 text-[#E4405F]" /> },
  { key: 'youtube', dateKey: 'youtubeDate', label: 'YouTube', icon: <Youtube className="h-4 w-4 text-[#FF0000]" /> },
];

export interface SocialDatesResult {
  facebookDate?: string;
  tiktokDate?: string;
  instagramDate?: string;
  youtubeDate?: string;
}

export function tryParseSocialDates(value: string | null): SocialDatesResult | null {
  if (!value) return null;
  try {
    const p = JSON.parse(value);
    if (p && typeof p === 'object' && ('facebookDate' in p || 'tiktokDate' in p || 'instagramDate' in p || 'youtubeDate' in p)) {
      return p as SocialDatesResult;
    }
  } catch {}
  return null;
}

function isDateInPast(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}

interface Props {
  /** JSON from influencer's social_descriptions task (previousValue of this task) */
  socialTextsJson: string | null;
  /** Current task value (existing dates if already set) */
  currentValue: string | null;
  onSubmit: (datesJson: string, earliestDate: Date | undefined) => void;
}

const SocialDatesWidget = ({ socialTextsJson, currentValue, onSubmit }: Props) => {
  const texts = tryParseSocialDescriptions(socialTextsJson) as Record<string, string> | null;
  const existingDates = tryParseSocialDates(currentValue) as Record<string, string> | null;

  // Confirmed dates
  const [dates, setDates] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    PLATFORMS.forEach(p => { init[p.dateKey] = existingDates?.[p.dateKey] ?? ''; });
    return init;
  });

  // Which platforms are in "edit mode" (input visible)
  const [editing, setEditing] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    PLATFORMS.forEach(p => { init[p.dateKey] = !existingDates?.[p.dateKey]; });
    return init;
  });

  // Bulk date state
  const [bulkDate, setBulkDate] = useState('');
  const [bulkSelected, setBulkSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    PLATFORMS.forEach(p => { init[p.dateKey] = true; });
    return init;
  });

  const applyBulk = () => {
    if (!bulkDate) return;
    const newDates = { ...dates };
    const newEditing = { ...editing };
    PLATFORMS.forEach(p => {
      if (bulkSelected[p.dateKey]) {
        newDates[p.dateKey] = bulkDate;
        newEditing[p.dateKey] = false;
      }
    });
    setDates(newDates);
    setEditing(newEditing);
    setBulkDate('');
  };

  // Dates pending past-date confirmation: dateKey → candidate value
  const [pendingPast, setPendingPast] = useState<Record<string, string>>({});

  const handleDateChange = (dateKey: string, value: string) => {
    if (!value) {
      setDates(prev => ({ ...prev, [dateKey]: '' }));
      return;
    }
    if (isDateInPast(value)) {
      setPendingPast(prev => ({ ...prev, [dateKey]: value }));
    } else {
      setDates(prev => ({ ...prev, [dateKey]: value }));
      setEditing(prev => ({ ...prev, [dateKey]: false }));
    }
  };

  const confirmPast = (dateKey: string) => {
    const val = pendingPast[dateKey];
    setDates(prev => ({ ...prev, [dateKey]: val }));
    setEditing(prev => ({ ...prev, [dateKey]: false }));
    setPendingPast(prev => { const n = { ...prev }; delete n[dateKey]; return n; });
  };

  const cancelPast = (dateKey: string) => {
    setPendingPast(prev => { const n = { ...prev }; delete n[dateKey]; return n; });
  };

  const allSet = PLATFORMS.every(p => dates[p.dateKey]);
  const setCount = PLATFORMS.filter(p => dates[p.dateKey]).length;

  const handleSubmit = () => {
    const result: Record<string, string> = {};
    PLATFORMS.forEach(p => { if (dates[p.dateKey]) result[p.dateKey] = dates[p.dateKey]; });
    const dateValues = Object.values(result).filter(Boolean).map(d => new Date(d));
    const earliest = dateValues.length > 0
      ? dateValues.reduce((a, b) => a < b ? a : b)
      : undefined;
    onSubmit(JSON.stringify(result), earliest);
  };

  return (
    <div className="space-y-3 py-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Ustaw datę publikacji per platforma</span>
        <Badge variant="secondary" className="text-[10px]">{setCount}/4 ustawione</Badge>
      </div>

      {/* Bulk date picker */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 space-y-2">
        <div className="text-[11px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
          <CopyCheck className="h-3.5 w-3.5" />
          Jedna data dla wielu platform
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 flex-1"
              value={bulkDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setBulkDate(e.target.value)}
            />
            <button
              onClick={applyBulk}
              disabled={!bulkDate || !PLATFORMS.some(p => bulkSelected[p.dateKey])}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
            >
              Zastosuj
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {PLATFORMS.map(p => (
              <button
                key={p.dateKey}
                onClick={() => setBulkSelected(prev => ({ ...prev, [p.dateKey]: !prev[p.dateKey] }))}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                  bulkSelected[p.dateKey]
                    ? 'border-foreground/30 bg-background text-foreground shadow-sm'
                    : 'border-border/50 bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                <span className="shrink-0">{p.icon}</span>
                <span className="flex-1 text-left">{p.label}</span>
                {bulkSelected[p.dateKey] && <Check className="h-3 w-3 shrink-0 text-success" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {PLATFORMS.map(p => {
        const text = texts?.[p.key];
        const confirmedDate = dates[p.dateKey];
        const isEditing = editing[p.dateKey];
        const pendingVal = pendingPast[p.dateKey];
        const hasPendingWarning = !!pendingVal;

        return (
          <div
            key={p.key}
            className={`rounded-lg border space-y-2 px-3 py-2.5 transition-colors ${
              confirmedDate && !isEditing ? 'border-success/40 bg-success/5' : 'border-border'
            }`}
          >
            {/* Platform row */}
            <div className="flex items-center gap-3">
              {/* Left: icon + label */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {p.icon}
                <span className="text-sm font-medium">{p.label}</span>
              </div>

              {/* Right: either confirmed badge+edit-btn OR date input */}
              {confirmedDate && !isEditing ? (
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className="gap-1 border-0 bg-success/15 text-success text-[10px]">
                    <Check className="h-2.5 w-2.5" />
                    {format(new Date(confirmedDate), 'dd.MM.yyyy', { locale: pl })}
                  </Badge>
                  <button
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={() => setEditing(prev => ({ ...prev, [p.dateKey]: true }))}
                  >
                    <Pencil className="h-2.5 w-2.5" />
                    Zmień
                  </button>
                </div>
              ) : (
                <input
                  type="date"
                  className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 shrink-0 w-[130px]"
                  value={confirmedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => handleDateChange(p.dateKey, e.target.value)}
                  autoFocus={!!confirmedDate}
                />
              )}
            </div>

            {/* Past-date confirmation warning */}
            {hasPendingWarning && (
              <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 space-y-2">
                <div className="flex items-start gap-2 text-xs text-warning">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>Data wsteczna</strong> — {format(new Date(pendingVal), 'dd.MM.yyyy', { locale: pl })} jest w przeszłości.
                    Czy na pewno chcesz ustawić tę datę?
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-6 text-xs px-3"
                    onClick={() => confirmPast(p.dateKey)}
                  >
                    Tak, ustaw wstecz
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs px-3"
                    onClick={() => cancelPast(p.dateKey)}
                  >
                    Anuluj
                  </Button>
                </div>
              </div>
            )}

            {/* Influencer text preview */}
            {text && (
              <p className="text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1.5 whitespace-pre-wrap line-clamp-2">
                {text}
              </p>
            )}
          </div>
        );
      })}

      <Button
        className="w-full gap-2"
        disabled={!allSet}
        onClick={handleSubmit}
      >
        <CheckCircle2 className="h-4 w-4" />
        Zatwierdź daty publikacji
      </Button>
      {!allSet && (
        <p className="text-center text-xs text-muted-foreground">
          Ustaw daty dla wszystkich 4 platform
        </p>
      )}
    </div>
  );
};

export default SocialDatesWidget;
