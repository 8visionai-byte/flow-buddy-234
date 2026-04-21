import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { Idea, IdeaStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2, ThumbsUp, Bookmark, XCircle, Plus, Pencil, Trash2,
  Lightbulb, Clock, MessageSquare, X, Check, FolderOpen,
} from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type PanelRole = 'admin' | 'influencer' | 'klient';

interface IdeasPanelProps {
  campaignId: string;
  role: PanelRole;
  projectName?: string;
}

const STATUS_CONFIG: Record<IdeaStatus, { label: string; color: string; icon: React.FC<{ className?: string }> }> = {
  pending:             { label: 'Oczekuje',        color: 'bg-muted text-muted-foreground',           icon: Clock },
  accepted:            { label: 'Zaakceptowany',   color: 'bg-success/15 text-success',               icon: CheckCircle2 },
  accepted_with_notes: { label: 'Tak, ale...',     color: 'bg-warning/15 text-warning',               icon: MessageSquare },
  saved_for_later:     { label: 'Na później',      color: 'bg-primary/10 text-primary',               icon: Bookmark },
  rejected:            { label: 'Odrzucony',       color: 'bg-destructive/10 text-destructive',       icon: XCircle },
};

type ClientAction = 'accepted' | 'accepted_with_notes' | 'saved_for_later' | 'rejected' | null;

const IdeasPanel = ({ campaignId, role, projectName }: IdeasPanelProps) => {
  const { currentUser, ideas, campaigns, clients, addIdea, updateIdea, deleteIdea, reviewIdea, acceptIdeaAsProject } = useApp();
  const projectIdeas = ideas.filter(i => i.campaignId === campaignId);
  const campaign = campaigns.find(c => c.id === campaignId);
  const campaignClient = campaign ? clients.find(c => c.id === campaign.clientId) : null;

  // Influencer: add/edit form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Client: per-idea action state + re-edit mode
  const [clientAction, setClientAction] = useState<Record<string, ClientAction>>({});
  const [clientNotes, setClientNotes] = useState<Record<string, string>>({});
  const [reEditingIds, setReEditingIds] = useState<Set<string>>(new Set());

  // Clear per-idea UI state when switching campaigns
  useEffect(() => {
    setClientAction({});
    setClientNotes({});
    setReEditingIds(new Set());
  }, [campaignId]);

  if (!currentUser) return null;

  const pendingCount = projectIdeas.filter(i => i.status === 'pending').length;
  const acceptedCount = projectIdeas.filter(i => i.status === 'accepted' || i.status === 'accepted_with_notes').length;
  const submittedCount = projectIdeas.length;
  const targetCount = campaign?.targetIdeaCount ?? 0;
  const targetReached = targetCount > 0 && submittedCount >= targetCount;

  // --- Influencer helpers ---
  const startAdd = () => {
    setEditingId(null);
    setFormTitle('');
    setFormDesc('');
    setShowAddForm(true);
  };
  const startEdit = (idea: Idea) => {
    setShowAddForm(false);
    setEditingId(idea.id);
    setFormTitle(idea.title);
    setFormDesc(idea.description);
  };
  const cancelForm = () => { setShowAddForm(false); setEditingId(null); setFormTitle(''); setFormDesc(''); };
  const saveIdea = () => {
    if (!formTitle.trim()) return;
    const title = formTitle.trim();
    if (editingId) {
      updateIdea(editingId, title, formDesc.trim());
      setEditingId(null);
    } else {
      addIdea(campaignId, title, formDesc.trim(), currentUser.id);
      setShowAddForm(false);
      toast({ title: '✓ Pomysł dodany', description: `„${title}" został wysłany do oceny.`, duration: 3000 });
    }
    setFormTitle(''); setFormDesc('');
  };

  // --- Client helpers ---
  // Single-click: accepted/saved_for_later → immediate save; accepted_with_notes/rejected → show notes first
  const handleClientClick = (idea: Idea, action: ClientAction) => {
    if (!action) return;
    if (action === 'accepted' || action === 'saved_for_later') {
      // Immediate — no notes needed
      reviewIdea(idea.id, action, null, currentUser.id);
      if (action === 'accepted') acceptIdeaAsProject(idea.id);
      setReEditingIds(prev => { const n = new Set(prev); n.delete(idea.id); return n; });
      setClientAction(prev => { const n = { ...prev }; delete n[idea.id]; return n; });
    } else {
      // Show notes textarea first (accepted_with_notes / rejected)
      setClientAction(prev => ({ ...prev, [idea.id]: prev[idea.id] === action ? null : action }));
    }
  };
  const confirmWithNotes = (idea: Idea) => {
    const action = clientAction[idea.id];
    if (!action) return;
    reviewIdea(idea.id, action, clientNotes[idea.id]?.trim() || null, currentUser.id);
    if (action === 'accepted_with_notes') acceptIdeaAsProject(idea.id);
    setReEditingIds(prev => { const n = new Set(prev); n.delete(idea.id); return n; });
    setClientAction(prev => { const n = { ...prev }; delete n[idea.id]; return n; });
    setClientNotes(prev => { const n = { ...prev }; delete n[idea.id]; return n; });
  };
  const startReEdit = (ideaId: string) => {
    setReEditingIds(prev => new Set([...prev, ideaId]));
    setClientAction(prev => { const n = { ...prev }; delete n[ideaId]; return n; });
    setClientNotes(prev => { const n = { ...prev }; delete n[ideaId]; return n; });
  };

  const renderIdeaForm = (isNew: boolean) => (
    <div className={`rounded-lg border p-3 space-y-2 ${isNew ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'}`}>
      {isNew && <p className="text-xs font-semibold text-primary">Nowy pomysł</p>}
      <div className="space-y-1">
        <Label className="text-xs">Tytuł pomysłu *</Label>
        <Input
          className="h-8 text-sm"
          placeholder="np. Jak dbać o zęby w podróży?"
          value={formTitle}
          onChange={e => setFormTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveIdea(); } }}
          autoFocus
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Opis / koncepcja (opcjonalnie)</Label>
        <Textarea
          className="text-sm min-h-[60px] resize-none"
          placeholder="Opisz pomysł, kąt narracyjny, grupę docelową..."
          value={formDesc}
          onChange={e => setFormDesc(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelForm}>
          <X className="mr-1 h-3 w-3" />Anuluj
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={saveIdea} disabled={!formTitle.trim()}>
          <Check className="mr-1 h-3 w-3" />{isNew ? 'Dodaj pomysł' : 'Zapisz'}
        </Button>
      </div>
    </div>
  );

  const renderInfluencerIdea = (idea: Idea) => {
    const isEditing = editingId === idea.id;
    const cfg = STATUS_CONFIG[idea.status];
    const Icon = cfg.icon;
    if (isEditing) return <div key={idea.id}>{renderIdeaForm(false)}</div>;
    const canEdit = idea.status === 'pending';
    return (
      <div key={idea.id} className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{idea.title}</span>
              <Badge variant="secondary" className={`${cfg.color} border-0 text-[10px] gap-1`}>
                <Icon className="h-3 w-3" />{cfg.label}
              </Badge>
            </div>
            {idea.description && (
              <p className="text-xs text-muted-foreground mt-1">{idea.description}</p>
            )}
            {idea.clientNotes && (
              <div className="mt-2 rounded bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground italic">
                <span className="font-medium not-italic text-foreground">Uwagi klienta: </span>{idea.clientNotes}
              </div>
            )}
            {idea.resultingProjectId && (
              <div className="mt-1.5 flex items-center gap-1">
                <FolderOpen className="h-3 w-3 text-success" />
                <span className="text-[10px] font-medium text-success">Projekt stworzony</span>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Dodano {format(new Date(idea.createdAt), 'dd.MM.yyyy HH:mm', { locale: pl })}
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(idea)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setDeleteConfirm(idea.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderClientIdeaButtons = (idea: Idea) => {
    const activeAction = clientAction[idea.id];
    const needsNotes = activeAction === 'accepted_with_notes' || activeAction === 'rejected';
    return (
      <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            onClick={() => handleClientClick(idea, 'accepted')}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-border p-3 text-xs font-medium transition-all hover:shadow-sm hover:border-success/50 hover:bg-success/5"
          >
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span>Akceptacja</span>
            <span className="text-[10px] font-normal text-muted-foreground">brak uwag</span>
          </button>
          <button
            onClick={() => handleClientClick(idea, 'accepted_with_notes')}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-all hover:shadow-sm",
              activeAction === 'accepted_with_notes'
                ? "border-warning bg-warning/20 text-warning ring-1 ring-warning/40"
                : "border-border hover:border-warning/50 hover:bg-warning/5"
            )}
          >
            <ThumbsUp className="h-5 w-5 text-warning" />
            <span>Podoba mi się,</span>
            <span className="text-[10px] font-normal text-muted-foreground">ale...</span>
          </button>
          <button
            onClick={() => handleClientClick(idea, 'saved_for_later')}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-border p-3 text-xs font-medium transition-all hover:shadow-sm hover:border-primary/50 hover:bg-primary/5"
          >
            <Bookmark className="h-5 w-5 text-primary" />
            <span>Na później</span>
            <span className="text-[10px] font-normal text-muted-foreground">dobry pomysł</span>
          </button>
          <button
            onClick={() => handleClientClick(idea, 'rejected')}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-all hover:shadow-sm",
              activeAction === 'rejected'
                ? "border-destructive bg-destructive/20 text-destructive ring-1 ring-destructive/40"
                : "border-border hover:border-destructive/50 hover:bg-destructive/5"
            )}
          >
            <XCircle className="h-5 w-5 text-destructive" />
            <span>Odrzucam</span>
            <span className="text-[10px] font-normal text-muted-foreground">ten pomysł</span>
          </button>
        </div>
        {needsNotes && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {activeAction === 'accepted_with_notes' ? 'Twoje uwagi / co chciałbyś zmienić:' : 'Co było nie tak? (opcjonalnie)'}
            </Label>
            <Textarea
              className="text-sm min-h-[70px] resize-none"
              placeholder={activeAction === 'accepted_with_notes' ? 'np. Zmień temat na bardziej praktyczny...' : 'np. Temat nie pasuje do naszej marki...'}
              value={clientNotes[idea.id] || ''}
              onChange={e => setClientNotes(prev => ({ ...prev, [idea.id]: e.target.value }))}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setClientAction(prev => { const n = { ...prev }; delete n[idea.id]; return n; })}>
                <X className="mr-1 h-3 w-3" />Anuluj
              </Button>
              <Button
                size="sm"
                className={cn("h-7 text-xs", activeAction === 'accepted_with_notes' ? "bg-warning hover:bg-warning/90 text-white" : "bg-destructive hover:bg-destructive/90 text-white")}
                onClick={() => confirmWithNotes(idea)}
                disabled={activeAction === 'accepted_with_notes' && !(clientNotes[idea.id]?.trim())}
              >
                <Check className="mr-1 h-3 w-3" />Zapisz
              </Button>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderClientIdea = (idea: Idea) => {
    const cfg = STATUS_CONFIG[idea.status];
    const Icon = cfg.icon;
    const alreadyReviewed = idea.status !== 'pending';
    const isReEditing = reEditingIds.has(idea.id);

    if (alreadyReviewed && !isReEditing) {
      const borderCls = cfg.color.includes('success') ? 'border-success/30 bg-success/5'
        : cfg.color.includes('warning') ? 'border-warning/30 bg-warning/5'
        : cfg.color.includes('primary') ? 'border-primary/30 bg-primary/5'
        : 'border-destructive/30 bg-destructive/5';
      return (
        <div key={idea.id} className={`rounded-xl border p-4 ${borderCls}`}>
          <div className="flex items-start gap-3">
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color.split(' ')[1]}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{idea.title}</span>
                <Badge variant="secondary" className={`${cfg.color} border-0 text-[10px]`}>{cfg.label}</Badge>
              </div>
              {idea.description && <p className="text-xs text-muted-foreground mt-1">{idea.description}</p>}
              {idea.clientNotes && (
                <p className="text-xs text-muted-foreground mt-1 italic">Uwagi: „{idea.clientNotes}"</p>
              )}
            </div>
            <button
              onClick={() => startReEdit(idea.id)}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Zmień ocenę"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={idea.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold text-sm text-foreground">{idea.title}</h4>
            {idea.description && <p className="text-sm text-muted-foreground mt-1">{idea.description}</p>}
          </div>
          {isReEditing && (
            <button
              onClick={() => { setReEditingIds(prev => { const n = new Set(prev); n.delete(idea.id); return n; }); setClientAction(prev => { const n = { ...prev }; delete n[idea.id]; return n; }); }}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              title="Anuluj edycję"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {renderClientIdeaButtons(idea)}
      </div>
    );
  };

  const renderAdminIdea = (idea: Idea) => {
    const cfg = STATUS_CONFIG[idea.status];
    const Icon = cfg.icon;
    return (
      <div key={idea.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color.split(' ')[1]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{idea.title}</span>
            <Badge variant="secondary" className={`${cfg.color} border-0 text-[10px] gap-1`}>
              {cfg.label}
            </Badge>
          </div>
          {idea.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{idea.description}</p>}
          {idea.clientNotes && (
            <p className="text-xs text-muted-foreground mt-1 italic">Klient: „{idea.clientNotes}"</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Brief card — visible to influencer and klient */}
      {campaign && (role === 'influencer' || role === 'klient') && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-warning shrink-0" />
            <span className="text-sm font-semibold text-foreground">
              Brief od DZ — {campaignClient?.companyName || 'Klient'}
            </span>
            <Badge variant="secondary" className="border-0 bg-warning/10 text-warning text-[10px] ml-auto">
              {campaign.targetIdeaCount} pomysłów · {campaign.slaHours}h deadline
            </Badge>
          </div>
          {campaign.briefNotes ? (
            <p className="text-sm text-foreground/80 leading-relaxed">{campaign.briefNotes}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Brak dodatkowych wskazówek od DZ.</p>
          )}
        </div>
      )}

      {/* Header with stats */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-warning" />
          <span className="font-semibold text-sm text-foreground">
            Pomysły{projectName ? ` — ${projectName}` : ''}
          </span>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant="secondary" className="border-0 bg-muted text-muted-foreground text-xs">
            {projectIdeas.length} łącznie
          </Badge>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="border-0 bg-warning/10 text-warning text-xs">
              {pendingCount} oczekuje
            </Badge>
          )}
          {acceptedCount > 0 && (
            <Badge variant="secondary" className="border-0 bg-success/10 text-success text-xs">
              {acceptedCount} zaakceptowanych
            </Badge>
          )}
        </div>

        {role === 'influencer' && targetCount > 0 && (
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
            targetReached
              ? "border-success/40 bg-success/10 text-success"
              : "border-warning/40 bg-warning/10 text-warning"
          )}>
            {targetReached ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {submittedCount}/{targetCount}
            {targetReached ? ' ✓ cel osiągnięty' : ' pomysłów'}
          </span>
        )}
        {role === 'influencer' && !showAddForm && editingId === null && (
          <Button size="sm" variant="outline" className="ml-auto h-7 text-xs gap-1" onClick={startAdd}>
            <Plus className="h-3.5 w-3.5" />Dodaj pomysł
          </Button>
        )}
      </div>

      {/* Add form */}
      {role === 'influencer' && showAddForm && renderIdeaForm(true)}

      {/* Empty state */}
      {projectIdeas.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center rounded-xl border border-dashed border-border">
          <Lightbulb className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">
            {role === 'influencer' ? 'Nie dodałeś jeszcze żadnych pomysłów.' : 'Brak pomysłów do wyświetlenia.'}
          </p>
          {role === 'influencer' && (
            <Button size="sm" variant="outline" className="mt-1 h-7 text-xs gap-1" onClick={startAdd}>
              <Plus className="h-3.5 w-3.5" />Dodaj pierwszy pomysł
            </Button>
          )}
        </div>
      )}

      {/* Ideas list */}
      <div className="space-y-2">
        {role === 'influencer' && projectIdeas.map(idea => renderInfluencerIdea(idea))}
        {role === 'klient' && projectIdeas.map(idea => renderClientIdea(idea))}
        {role === 'admin' && projectIdeas.map(idea => renderAdminIdea(idea))}
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń pomysł?</AlertDialogTitle>
            <AlertDialogDescription>
              Pomysł „{ideas.find(i => i.id === deleteConfirm)?.title}" zostanie trwale usunięty.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteConfirm) { deleteIdea(deleteConfirm); setDeleteConfirm(null); } }}
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default IdeasPanel;
