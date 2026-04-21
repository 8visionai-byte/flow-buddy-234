import { useState } from 'react';
import { Facebook, Instagram, Youtube, Check, ChevronDown, ChevronUp, FileText } from 'lucide-react';
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.74a8.18 8.18 0 0 0 4.79 1.52V6.79a4.85 4.85 0 0 1-1.02-.1z"/>
  </svg>
);
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { tryParseSocialDescriptions } from '@/components/SocialDescriptionsDisplay';

interface PlatformConfig {
  key: string;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  isInput?: boolean;
}

const PLATFORMS: PlatformConfig[] = [
  { key: 'facebook', label: 'Facebook', placeholder: 'Opis posta na Facebooka...', icon: <Facebook className="h-4 w-4 text-[#1877F2]" /> },
  { key: 'tiktok', label: 'TikTok', placeholder: 'Opis/tytuł na TikToku...', icon: <TikTokIcon className="h-4 w-4 text-foreground" /> },
  { key: 'instagram', label: 'Instagram', placeholder: 'Opis posta na Instagrama...', icon: <Instagram className="h-4 w-4 text-[#E4405F]" /> },
  { key: 'youtube', label: 'YouTube', placeholder: 'Tytuł filmu na YouTube...', icon: <Youtube className="h-4 w-4 text-[#FF0000]" />, isInput: true },
];

interface PlatformState {
  text: string;
  saved: boolean;
  expanded: boolean;
}

type PlatformsState = Record<string, PlatformState>;

interface Props {
  initialValue: string | null;
  onSaveDraft: (value: string) => void;
  onSubmit: (value: string) => void;
}

function buildJSON(state: PlatformsState): string {
  const obj: Record<string, string> = {};
  PLATFORMS.forEach(p => {
    if (state[p.key].text) obj[p.key] = state[p.key].text;
  });
  return JSON.stringify(obj);
}

const SocialDescriptionsInput = ({ initialValue, onSaveDraft, onSubmit }: Props) => {
  const data = tryParseSocialDescriptions(initialValue) as Record<string, string> | null;

  const [platforms, setPlatforms] = useState<PlatformsState>(() => {
    const init: PlatformsState = {};
    PLATFORMS.forEach(p => {
      const text = data?.[p.key] ?? '';
      init[p.key] = { text, saved: !!text, expanded: !text };
    });
    return init;
  });

  const savePlatform = (key: string) => {
    const newState: PlatformsState = {
      ...platforms,
      [key]: { ...platforms[key], saved: true, expanded: false },
    };
    setPlatforms(newState);
    onSaveDraft(buildJSON(newState));
  };

  const toggleExpand = (key: string) => {
    setPlatforms(prev => ({ ...prev, [key]: { ...prev[key], expanded: !prev[key].expanded } }));
  };

  const allSaved = PLATFORMS.every(p => platforms[p.key].saved);
  const savedCount = PLATFORMS.filter(p => platforms[p.key].saved).length;

  return (
    <div className="space-y-2.5">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
        <span className="text-xs text-muted-foreground flex-1">Opisy zapisane</span>
        <div className="flex items-center gap-1">
          {PLATFORMS.map(p => (
            <div
              key={p.key}
              title={p.label}
              className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] transition-colors ${
                platforms[p.key].saved ? 'bg-success/20 text-success' : 'bg-border text-muted-foreground'
              }`}
            >
              {platforms[p.key].saved ? <Check className="h-3 w-3" /> : p.label[0]}
            </div>
          ))}
          <span className="ml-1 text-xs font-semibold text-foreground">{savedCount}/4</span>
        </div>
      </div>

      {/* Per-platform cards */}
      {PLATFORMS.map(p => {
        const state = platforms[p.key];
        const isDirty = !state.saved && state.text.trim().length > 0;
        return (
          <div
            key={p.key}
            className={`rounded-lg border transition-colors ${
              state.saved ? 'border-success/40 bg-success/5' : 'border-border bg-card'
            }`}
          >
            <button
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              onClick={() => toggleExpand(p.key)}
            >
              <div className="flex items-center gap-2">
                {p.icon}
                <span className="text-sm font-medium">{p.label}</span>
                {state.saved && (
                  <Badge className="gap-1 border-0 bg-success/15 text-success text-[10px] font-medium">
                    <Check className="h-2.5 w-2.5" />
                    Zapisano
                  </Badge>
                )}
                {isDirty && (
                  <Badge variant="outline" className="border-warning/40 text-warning text-[10px]">
                    Niezapisane
                  </Badge>
                )}
              </div>
              {state.expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>

            {state.expanded && (
              <div className="border-t border-border/50 px-3 pb-3 pt-2.5 space-y-2">
                {state.saved && state.text && (
                  <p className="rounded bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground whitespace-pre-wrap italic">
                    {state.text}
                  </p>
                )}
                {p.isInput ? (
                  <input
                    type="text"
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder={p.placeholder}
                    value={state.text}
                    onChange={e => setPlatforms(prev => ({ ...prev, [p.key]: { ...prev[p.key], text: e.target.value, saved: false } }))}
                  />
                ) : (
                  <Textarea
                    placeholder={p.placeholder}
                    rows={3}
                    value={state.text}
                    onChange={e => setPlatforms(prev => ({ ...prev, [p.key]: { ...prev[p.key], text: e.target.value, saved: false } }))}
                  />
                )}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={!state.text.trim()}
                    onClick={() => savePlatform(p.key)}
                  >
                    <Check className="h-3 w-3" />
                    Zapisz
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Final submit */}
      {allSaved ? (
        <Button onClick={() => onSubmit(buildJSON(platforms))} className="w-full mt-1">
          <FileText className="mr-2 h-4 w-4" />
          Prześlij wszystkie opisy
        </Button>
      ) : savedCount > 0 && (
        <p className="text-center text-xs text-muted-foreground pt-1">
          Zapisz opisy dla wszystkich 4 platform, żeby przesłać
        </p>
      )}
    </div>
  );
};

export default SocialDescriptionsInput;
