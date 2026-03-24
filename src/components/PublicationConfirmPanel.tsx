/**
 * PublicationConfirmPanel — shown to the "publikator" role.
 * Displays the final approved video link, per-platform descriptions and
 * publication dates, then lets them confirm everything has been published.
 */
import { Facebook, Twitter, Instagram, Youtube, ExternalLink, CalendarDays, CheckCircle2, Film } from 'lucide-react';
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
  { key: 'facebook', dateKey: 'facebookDate', label: 'Facebook', icon: <Facebook className="h-4 w-4 text-[#1877F2]" /> },
  { key: 'twitter', dateKey: 'twitterDate', label: 'Twitter / X', icon: <Twitter className="h-4 w-4 text-foreground" /> },
  { key: 'instagram', dateKey: 'instagramDate', label: 'Instagram', icon: <Instagram className="h-4 w-4 text-[#E4405F]" /> },
  { key: 'youtube', dateKey: 'youtubeDate', label: 'YouTube', icon: <Youtube className="h-4 w-4 text-[#FF0000]" /> },
];

interface Props {
  /** Final approved video URL (from montazysta task) */
  videoUrl: string | null;
  /** JSON from influencer's "Opisy i tytuły do publikacji" */
  descriptionsJson: string | null;
  /** JSON from admin's "Ustaw datę publikacji" */
  datesJson: string | null;
  onConfirm: () => void;
}

const PublicationConfirmPanel = ({ videoUrl, descriptionsJson, datesJson, onConfirm }: Props) => {
  const texts = tryParseSocialDescriptions(descriptionsJson) as Record<string, string> | null;
  const dates = tryParseSocialDates(datesJson) as Record<string, string> | null;

  const formatDate = (dateStr: string | undefined): string | null => {
    if (!dateStr) return null;
    try { return format(new Date(dateStr), 'dd.MM.yyyy', { locale: pl }); }
    catch { return null; }
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
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline break-all"
          >
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
          Opisy i daty publikacji
        </p>

        {PLATFORMS.map(p => {
          const text = texts?.[p.key];
          const dateStr = formatDate(dates?.[p.dateKey]);
          const hasMissingData = !text && !dateStr;

          return (
            <div
              key={p.key}
              className={`rounded-lg border px-4 py-3 space-y-2 ${hasMissingData ? 'border-border bg-muted/20 opacity-50' : 'border-border bg-card'}`}
            >
              {/* Platform header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {p.icon}
                  <span className="text-sm font-semibold">{p.label}</span>
                </div>
                {dateStr ? (
                  <Badge variant="secondary" className="gap-1 text-[11px] border-0">
                    <CalendarDays className="h-3 w-3" />
                    {dateStr}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Brak daty
                  </Badge>
                )}
              </div>

              {/* Description */}
              {text ? (
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {text}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">Brak opisu</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm button */}
      <Button
        className="w-full gap-2 bg-success hover:bg-success/90 text-success-foreground"
        onClick={onConfirm}
      >
        <CheckCircle2 className="h-4 w-4" />
        Potwierdzam — materiał opublikowany na wszystkich platformach
      </Button>
    </div>
  );
};

export default PublicationConfirmPanel;
