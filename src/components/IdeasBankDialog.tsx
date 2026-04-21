import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Building2, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

const IdeasBankDialog = () => {
  const { ideas, campaigns, clients } = useApp();
  const [open, setOpen] = useState(false);

  const savedIdeas = ideas.filter(i => i.status === 'saved_for_later');

  // Group by campaign
  const byCampaign = new Map<string, typeof savedIdeas>();
  for (const idea of savedIdeas) {
    const list = byCampaign.get(idea.campaignId) || [];
    list.push(idea);
    byCampaign.set(idea.campaignId, list);
  }

  const groups = Array.from(byCampaign.entries()).map(([campaignId, campaignIdeas]) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    const client = campaign?.clientId ? clients.find(c => c.id === campaign.clientId) : null;
    return { campaignId, campaign, client, ideas: campaignIdeas };
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 relative">
          <Bookmark className="h-4 w-4" />
          Bank pomysłów
          {savedIdeas.length > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px] bg-primary text-primary-foreground border-0">
              {savedIdeas.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-primary" />
            Bank pomysłów — Do wykorzystania w przyszłości
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1 py-1">
          {savedIdeas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <Lightbulb className="h-10 w-10 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">Brak zapisanych pomysłów.</p>
              <p className="text-xs text-muted-foreground">Klient może oznaczyć pomysł jako „Dobry pomysł na później" podczas przeglądu.</p>
            </div>
          ) : (
            groups.map(({ campaignId, campaign, client, ideas: groupIdeas }) => (
              <div key={campaignId} className="rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/20 rounded-t-xl">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-sm">{client?.companyName || 'Nieznany klient'}</span>
                  {campaign?.briefNotes && (
                    <>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground truncate">{campaign.briefNotes.slice(0, 40)}{campaign.briefNotes.length > 40 ? '...' : ''}</span>
                    </>
                  )}
                  <Badge variant="secondary" className="ml-auto border-0 bg-primary/10 text-primary text-[10px]">
                    {groupIdeas.length}
                  </Badge>
                </div>
                <div className="divide-y divide-border">
                  {groupIdeas.map(idea => (
                    <div key={idea.id} className="px-4 py-3 flex items-start gap-3">
                      <Bookmark className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground">{idea.title}</p>
                        {idea.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{idea.description}</p>
                        )}
                        {idea.clientNotes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">Uwagi: „{idea.clientNotes}"</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Zapisano {format(new Date(idea.reviewedAt || idea.createdAt), 'dd.MM.yyyy', { locale: pl })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IdeasBankDialog;
