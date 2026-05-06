import { useState } from 'react';
import { Facebook, Instagram, Youtube, Check, ChevronDown, ChevronUp, FileText, Link2, Link2Off } from 'lucide-react';
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.74a8.18 8.18 0 0 0 4.79 1.52V6.79a4.85 4.85 0 0 1-1.02-.1z"/>
  </svg>
);
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { tryParseSocialDescriptions } from '@/components/SocialDescriptionsDisplay';

type GroupKey = 'facebook' | 'instagram' | 'tiktok';
type PlatformKey = GroupKey | 'youtube';

interface PlatformConfig {
  key: PlatformKey;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  isInput?: boolean;
  groupable: boolean;
}

const PLATFORMS: PlatformConfig[] = [
  { key: 'facebook',  label: 'Facebook',  placeholder: 'Opis posta na Facebooka...',   icon: <Facebook className="h-4 w-4 text-[#1877F2]" />, groupable: true },
  { key: 'tiktok',    label: 'TikTok',    placeholder: 'Opis/tytuł na TikToku...',     icon: <TikTokIcon className="h-4 w-4 text-foreground" />, groupable: true },
  { key: 'instagram', label: 'Instagram', placeholder: 'Opis posta na Instagrama...',  icon: <Instagram className="h-4 w-4 text-[#E4405F]" />, groupable: true },
  { key: 'youtube',   label: 'YouTube',   placeholder: 'Tytuł filmu na YouTube...',    icon: <Youtube className="h-4 w-4 text-[#FF0000]" />, isInput: true, groupable: false },
];

const GROUP_PLATFORMS = PLATFORMS.filter(p => p.groupable) as (PlatformConfig & { key: GroupKey })[];

interface PlatformState {
  text: string;
  saved: boolean;
  expanded: boolean;
}

type PlatformsState = Record<PlatformKey, PlatformState>;

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

function computeInitialLinked(data: Record<string, string> | null): { linked: Set<GroupKey>; groupText: string } {
  if (!data) return { linked: new Set<GroupKey>(['facebook', 'instagram', 'tiktok']), groupText: '' };
  const fb = data.facebook ?? '';
  const ig = data.instagram ?? '';
  const tt = data.tiktok ?? '';
  const empty = (s: string) => !s || !s.trim();
  // All empty → default group all 3
  if (empty(fb) && empty(ig) && empty(tt)) {
    return { linked: new Set<GroupKey>(['facebook', 'instagram', 'tiktok']), groupText: '' };
  }
  // Find largest equal-text subset (non-empty)
  const candidates: GroupKey[] = ['facebook', 'instagram', 'tiktok'];
  const texts: Record<GroupKey, string> = { facebook: fb, instagram: ig, tiktok: tt };
  // try all == 
  const nonEmpty = candidates.filter(k => !empty(texts[k]));
  if (nonEmpty.length >= 2) {
    // group keys whose texts all match each other
    const ref = texts[nonEmpty[0]];
    const allMatch = nonEmpty.every(k => texts[k] === ref);
    if (allMatch) {
      return { linked: new Set<GroupKey>(nonEmpty), groupText: ref };
    }
    // try pairs
    for (let i = 0; i < nonEmpty.length; i++) {
      for (let j = i + 1; j < nonEmpty.length; j++) {
        if (texts[nonEmpty[i]] === texts[nonEmpty[j]]) {
          return { linked: new Set<GroupKey>([nonEmpty[i], nonEmpty[j]]), groupText: texts[nonEmpty[i]] };
        }
      }
    }
  }
  // No matches → none linked (all separate)
  return { linked: new Set<GroupKey>(), groupText: '' };
}

const SocialDescriptionsInput = ({ initialValue, onSaveDraft, onSubmit }: Props) => {
  const data = tryParseSocialDescriptions(initialValue) as Record<string, string> | null;

  const initial = computeInitialLinked(data);

  const [linkedSet, setLinkedSet] = useState<Set<GroupKey>>(initial.linked);
  const [groupText, setGroupText] = useState<string>(initial.groupText);
  const [groupExpanded, setGroupExpanded] = useState<boolean>(true);
  const [groupSaved, setGroupSaved] = useState<boolean>(initial.linked.size > 0 && !!initial.groupText);

  const [platforms, setPlatforms] = useState<PlatformsState>(() => {
    const init = {} as PlatformsState;
    PLATFORMS.forEach(p => {
      if (p.groupable) {
        const text = data?.[p.key] ?? '';
        const inGroup = initial.linked.has(p.key as GroupKey);
        init[p.key] = {
          text: inGroup ? initial.groupText : text,
          saved: inGroup ? !!initial.groupText : !!text,
          expanded: !text,
        };
      } else {
        const text = data?.[p.key] ?? '';
        init[p.key] = { text, saved: !!text, expanded: !text };
      }
    });
    return init;
  });

  const persistDraft = (state: PlatformsState) => onSaveDraft(buildJSON(state));

  const updatePlatform = (key: PlatformKey, patch: Partial<PlatformState>) => {
    setPlatforms(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  // ── Group handlers ────────────────────────────────────────────────────────
  const onGroupTextChange = (text: string) => {
    setGroupText(text);
    setGroupSaved(false);
    setPlatforms(prev => {
      const next = { ...prev };
      linkedSet.forEach(k => { next[k] = { ...next[k], text, saved: false }; });
      return next;
    });
  };

  const saveGroup = () => {
    setGroupSaved(true);
    setGroupExpanded(false);
    setPlatforms(prev => {
      const next = { ...prev };
      linkedSet.forEach(k => { next[k] = { ...next[k], text: groupText, saved: true, expanded: false }; });
      persistDraft(next);
      return next;
    });
  };

  const unlinkPlatform = (key: GroupKey) => {
    const newSet = new Set(linkedSet);
    newSet.delete(key);
    setLinkedSet(newSet);
    setPlatforms(prev => {
      const next = { ...prev, [key]: { text: groupText, saved: false, expanded: true } };
      return next;
    });
    if (newSet.size === 0) setGroupSaved(false);
  };

  const linkPlatform = (key: GroupKey) => {
    const platformText = platforms[key].text;
    if (linkedSet.size > 0 && groupText && platformText && platformText !== groupText) {
      const ok = window.confirm(`Tekst dla ${PLATFORMS.find(p => p.key === key)?.label} zostanie zastąpiony tekstem grupy. Kontynuować?`);
      if (!ok) return;
    }
    const newSet = new Set(linkedSet);
    newSet.add(key);
    setLinkedSet(newSet);
    let newGroupText = groupText;
    if (linkedSet.size === 0) {
      newGroupText = platformText;
      setGroupText(newGroupText);
    }
    setPlatforms(prev => ({
      ...prev,
      [key]: { text: newGroupText, saved: groupSaved && !!newGroupText, expanded: false },
    }));
    setGroupExpanded(true);
  };

  // ── Per-platform (unlinked) handlers ──────────────────────────────────────
  const savePlatform = (key: PlatformKey) => {
    setPlatforms(prev => {
      const next = { ...prev, [key]: { ...prev[key], saved: true, expanded: false } };
      persistDraft(next);
      return next;
    });
  };

  const togglePlatformExpand = (key: PlatformKey) => {
    setPlatforms(prev => ({ ...prev, [key]: { ...prev[key], expanded: !prev[key].expanded } }));
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const allSaved = PLATFORMS.every(p => platforms[p.key].saved);
  const savedCount = PLATFORMS.filter(p => platforms[p.key].saved).length;

  const groupedKeys = GROUP_PLATFORMS.filter(p => linkedSet.has(p.key));
  const unlinkedGroupKeys = GROUP_PLATFORMS.filter(p => !linkedSet.has(p.key));
  const youtubeCfg = PLATFORMS.find(p => p.key === 'youtube')!;

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

      {/* Grouped card (FB / IG / TT) */}
      {groupedKeys.length > 0 && (
        <div className={`rounded-lg border transition-colors ${groupSaved ? 'border-success/40 bg-success/5' : 'border-primary/30 bg-primary/5'}`}>
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            onClick={() => setGroupExpanded(e => !e)}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground mr-1">Grupa:</span>
              {groupedKeys.map(p => (
                <span
                  key={p.key}
                  role="button"
                  tabIndex={0}
                  title={`Odepnij ${p.label} z grupy`}
                  onClick={(e) => { e.stopPropagation(); unlinkPlatform(p.key); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); unlinkPlatform(p.key); } }}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 hover:border-destructive/50 hover:bg-destructive/5 cursor-pointer transition-colors"
                >
                  {p.icon}
                  <span className="text-xs">{p.label}</span>
                  <Link2 className="h-3 w-3 text-muted-foreground" />
                </span>
              ))}
              {groupSaved && (
                <Badge className="gap-1 border-0 bg-success/15 text-success text-[10px] font-medium">
                  <Check className="h-2.5 w-2.5" />
                  Zapisano
                </Badge>
              )}
            </div>
            {groupExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>

          {groupExpanded && (
            <div className="border-t border-border/50 px-3 pb-3 pt-2.5 space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Wpisz wspólny opis — zostanie użyty dla {groupedKeys.map(p => p.label).join(', ')}. Kliknij ikonę platformy powyżej, aby ją odpiąć i edytować osobno.
              </p>
              <Textarea
                placeholder="Wspólny opis dla zaznaczonych platform..."
                rows={4}
                value={groupText}
                onChange={e => onGroupTextChange(e.target.value)}
              />
              <div className="flex justify-end">
                <Button size="sm" className="h-7 text-xs gap-1" disabled={!groupText.trim()} onClick={saveGroup}>
                  <Check className="h-3 w-3" />
                  Zapisz dla grupy
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unlinked groupable platforms */}
      {unlinkedGroupKeys.map(p => {
        const state = platforms[p.key];
        const isDirty = !state.saved && state.text.trim().length > 0;
        return (
          <div key={p.key} className={`rounded-lg border transition-colors ${state.saved ? 'border-success/40 bg-success/5' : 'border-border bg-card'}`}>
            <div className="flex w-full items-center justify-between px-3 py-2.5">
              <button type="button" className="flex items-center gap-2 flex-1 text-left" onClick={() => togglePlatformExpand(p.key)}>
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
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Połącz z grupą"
                  onClick={() => linkPlatform(p.key)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Link2Off className="h-3 w-3" />
                  Połącz
                </button>
                {state.expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            </div>

            {state.expanded && (
              <div className="border-t border-border/50 px-3 pb-3 pt-2.5 space-y-2">
                {state.saved && state.text && (
                  <p className="rounded bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground whitespace-pre-wrap italic">{state.text}</p>
                )}
                <Textarea
                  placeholder={p.placeholder}
                  rows={3}
                  value={state.text}
                  onChange={e => updatePlatform(p.key, { text: e.target.value, saved: false })}
                />
                <div className="flex justify-end">
                  <Button size="sm" className="h-7 text-xs gap-1" disabled={!state.text.trim()} onClick={() => savePlatform(p.key)}>
                    <Check className="h-3 w-3" />
                    Zapisz
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* YouTube — always separate */}
      {(() => {
        const p = youtubeCfg;
        const state = platforms.youtube;
        const isDirty = !state.saved && state.text.trim().length > 0;
        return (
          <div className={`rounded-lg border transition-colors ${state.saved ? 'border-success/40 bg-success/5' : 'border-border bg-card'}`}>
            <button type="button" className="flex w-full items-center justify-between px-3 py-2.5 text-left" onClick={() => togglePlatformExpand('youtube')}>
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
                  <p className="rounded bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground whitespace-pre-wrap italic">{state.text}</p>
                )}
                <input
                  type="text"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder={p.placeholder}
                  value={state.text}
                  onChange={e => updatePlatform('youtube', { text: e.target.value, saved: false })}
                />
                <div className="flex justify-end">
                  <Button size="sm" className="h-7 text-xs gap-1" disabled={!state.text.trim()} onClick={() => savePlatform('youtube')}>
                    <Check className="h-3 w-3" />
                    Zapisz
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
