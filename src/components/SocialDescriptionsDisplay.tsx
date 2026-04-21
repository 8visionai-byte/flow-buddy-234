import { Facebook, Instagram, Youtube } from 'lucide-react';

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.74a8.18 8.18 0 0 0 4.79 1.52V6.79a4.85 4.85 0 0 1-1.02-.1z"/>
  </svg>
);

export interface SocialData {
  facebook?: string;
  facebookDate?: string;
  tiktok?: string;
  tiktokDate?: string;
  instagram?: string;
  instagramDate?: string;
  youtube?: string;
  youtubeDate?: string;
}

const SOCIAL_FIELDS: { key: keyof SocialData; dateKey: keyof SocialData; label: string; icon: React.ReactNode }[] = [
  { key: 'facebook', dateKey: 'facebookDate', label: 'Facebook', icon: <Facebook className="h-3.5 w-3.5 text-[#1877F2]" /> },
  { key: 'tiktok', dateKey: 'tiktokDate', label: 'TikTok', icon: <TikTokIcon className="h-3.5 w-3.5 text-foreground" /> },
  { key: 'instagram', dateKey: 'instagramDate', label: 'Instagram', icon: <Instagram className="h-3.5 w-3.5 text-[#E4405F]" /> },
  { key: 'youtube', dateKey: 'youtubeDate', label: 'YouTube', icon: <Youtube className="h-3.5 w-3.5 text-[#FF0000]" /> },
];

export function tryParseSocialDescriptions(value: string | null): SocialData | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && ('facebook' in parsed || 'tiktok' in parsed || 'instagram' in parsed || 'youtube' in parsed)) {
      return parsed as SocialData;
    }
  } catch {
    // not social JSON
  }
  return null;
}

interface Props {
  value: string | null;
  compact?: boolean;
}

const SocialDescriptionsDisplay = ({ value, compact = false }: Props) => {
  const data = tryParseSocialDescriptions(value);
  if (!data) return <span>{value}</span>;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {SOCIAL_FIELDS.map(f => data[f.key] ? (
          <span key={f.key} title={`${f.label}: ${data[f.key]}`}>{f.icon}</span>
        ) : null)}
        <span className="text-xs text-success font-medium">✓</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {SOCIAL_FIELDS.map(f => data[f.key] ? (
        <div key={f.key} className="flex gap-2">
          <div className="mt-0.5 shrink-0">{f.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-muted-foreground mb-0.5">{f.label}</div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{data[f.key]}</p>
          </div>
        </div>
      ) : null)}
    </div>
  );
};

export default SocialDescriptionsDisplay;
