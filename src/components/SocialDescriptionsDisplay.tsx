import { Facebook, Twitter, Instagram, Youtube } from 'lucide-react';

export interface SocialData {
  facebook?: string;
  facebookDate?: string;
  twitter?: string;
  twitterDate?: string;
  instagram?: string;
  instagramDate?: string;
  youtube?: string;
  youtubeDate?: string;
}

const SOCIAL_FIELDS: { key: keyof SocialData; dateKey: keyof SocialData; label: string; icon: React.ReactNode }[] = [
  { key: 'facebook', dateKey: 'facebookDate', label: 'Facebook', icon: <Facebook className="h-3.5 w-3.5 text-[#1877F2]" /> },
  { key: 'twitter', dateKey: 'twitterDate', label: 'Twitter / X', icon: <Twitter className="h-3.5 w-3.5 text-foreground" /> },
  { key: 'instagram', dateKey: 'instagramDate', label: 'Instagram', icon: <Instagram className="h-3.5 w-3.5 text-[#E4405F]" /> },
  { key: 'youtube', dateKey: 'youtubeDate', label: 'YouTube', icon: <Youtube className="h-3.5 w-3.5 text-[#FF0000]" /> },
];

export function tryParseSocialDescriptions(value: string | null): SocialData | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && ('facebook' in parsed || 'twitter' in parsed || 'instagram' in parsed || 'youtube' in parsed)) {
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
            {/* Dates are set separately by admin in "Ustaw datę publikacji" task */}
          </div>
        </div>
      ) : null)}
    </div>
  );
};

export default SocialDescriptionsDisplay;
