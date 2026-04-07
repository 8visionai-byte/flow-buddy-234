import { useState, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Lightbulb, Plus, X, Check, UserPlus } from 'lucide-react';

const AddCampaignDialog = () => {
  const { clients, users, addCampaign, createDraftCampaign, updateCampaign, addUser } = useApp();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [influencerId, setInfluencerId] = useState('');
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [targetCount, setTargetCount] = useState('12');
  const [slaHours, setSlaHours] = useState('48');
  const [briefNotes, setBriefNotes] = useState('');
  const [reviewerError, setReviewerError] = useState(false);

  // Draft tracking
  const draftIdRef = useRef<string | null>(null);

  // Inline new influencer form
  const [showNewInfluencer, setShowNewInfluencer] = useState(false);
  const [newInfluencerName, setNewInfluencerName] = useState('');

  const influencers = users.filter(u => u.role === 'influencer');
  const clientUsers = clientId
    ? users.filter(u => u.role === 'klient' && u.clientId === clientId)
    : [];

  const isValid = !!clientId && !!influencerId;

  // Auto-save draft to DB
  const saveDraft = useCallback((overrides?: Record<string, any>) => {
    const data = {
      clientId: overrides?.clientId ?? clientId,
      assignedInfluencerId: overrides?.influencerId ?? influencerId,
      assignedClientUserId: null as string | null,
      reviewerIds: overrides?.reviewerIds ?? reviewerIds,
      targetIdeaCount: Math.max(1, parseInt(overrides?.targetCount ?? targetCount) || 12),
      slaHours: Math.max(1, parseInt(overrides?.slaHours ?? slaHours) || 48),
      briefNotes: (overrides?.briefNotes ?? briefNotes).trim(),
    };

    if (!draftIdRef.current) {
      // Create new draft
      const id = createDraftCampaign(data);
      draftIdRef.current = id;
    } else {
      // Update existing draft
      updateCampaign(draftIdRef.current, data);
    }
  }, [clientId, influencerId, reviewerIds, targetCount, slaHours, briefNotes, createDraftCampaign, updateCampaign]);

  const handleAddNewInfluencer = () => {
    if (!newInfluencerName.trim()) return;
    const newId = addUser({ name: newInfluencerName.trim(), role: 'influencer' });
    setInfluencerId(newId);
    setNewInfluencerName(''); setShowNewInfluencer(false);
    // Auto-save with new influencer
    setTimeout(() => saveDraft({ influencerId: newId }), 0);
  };

  const toggleReviewer = (id: string) => {
    setReviewerError(false);
    setReviewerIds(prev => {
      const next = prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id];
      // Auto-save
      setTimeout(() => saveDraft({ reviewerIds: next }), 0);
      return next;
    });
  };

  const handleClientChange = (v: string) => {
    setClientId(v);
    setReviewerIds([]);
    setReviewerError(false);
    // Auto-save with new client
    setTimeout(() => saveDraft({ clientId: v, reviewerIds: [] }), 0);
  };

  const handleInfluencerChange = (v: string) => {
    setInfluencerId(v);
    setTimeout(() => saveDraft({ influencerId: v }), 0);
  };

  const handleSubmit = () => {
    if (!isValid) return;
    if (reviewerIds.length === 0) {
      setReviewerError(true);
      return;
    }
    const firstClientReviewer = reviewerIds.find(id => id !== 'admin') || null;

    if (draftIdRef.current) {
      // Activate existing draft by updating it to awaiting_ideas
      updateCampaign(draftIdRef.current, {
        clientId,
        assignedInfluencerId: influencerId,
        assignedClientUserId: firstClientReviewer,
        reviewerIds,
        targetIdeaCount: Math.max(1, parseInt(targetCount) || 12),
        slaHours: Math.max(1, parseInt(slaHours) || 48),
        briefNotes: briefNotes.trim(),
        status: 'awaiting_ideas',
      });
    } else {
      addCampaign({
        clientId,
        assignedInfluencerId: influencerId,
        assignedClientUserId: firstClientReviewer,
        reviewerIds,
        targetIdeaCount: Math.max(1, parseInt(targetCount) || 12),
        slaHours: Math.max(1, parseInt(slaHours) || 48),
        briefNotes: briefNotes.trim(),
      });
    }
    // Reset
    setClientId(''); setInfluencerId(''); setReviewerIds([]);
    setTargetCount('12'); setSlaHours('48'); setBriefNotes('');
    setShowNewInfluencer(false); setNewInfluencerName('');
    setReviewerError(false);
    draftIdRef.current = null;
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // If closing without submitting, draft stays in DB as "Szkic"
      // Reset local form state
      setClientId(''); setInfluencerId(''); setReviewerIds([]);
      setTargetCount('12'); setSlaHours('48'); setBriefNotes('');
      setShowNewInfluencer(false); setNewInfluencerName('');
      setReviewerError(false);
      draftIdRef.current = null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Lightbulb className="h-4 w-4" />
          Nowa kampania
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Utwórz kampanię pomysłów</DialogTitle>
          <DialogDescription>
            Wybierz klienta i influencera — dane zapisują się automatycznie jako szkic. Możesz zamknąć okno i wrócić później.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client */}
          <div className="space-y-1.5">
            <Label>Klient *</Label>
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Dodaj najpierw klienta w panelu „Klienci".</p>
            ) : (
              <Select value={clientId} onValueChange={handleClientChange}>
                <SelectTrigger><SelectValue placeholder="Wybierz klienta..." /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-medium">{c.companyName}</span>
                      <span className="text-muted-foreground ml-1">— {c.contactName}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Influencer */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Influencer *</Label>
              {!showNewInfluencer && (
                <button
                  type="button"
                  onClick={() => setShowNewInfluencer(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <UserPlus className="h-3 w-3" />Dodaj nowego
                </button>
              )}
            </div>
            {showNewInfluencer ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary">Nowy influencer</span>
                  <button onClick={() => { setShowNewInfluencer(false); setNewInfluencerName(''); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  placeholder="Imię i nazwisko *"
                  value={newInfluencerName}
                  onChange={e => setNewInfluencerName(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={!newInfluencerName.trim()}
                    onClick={handleAddNewInfluencer}
                  >
                    <Check className="h-3 w-3" />Dodaj i wybierz
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Influencer zostanie dodany do zespołu i automatycznie wybrany dla tej kampanii.</p>
              </div>
            ) : influencers.length === 0 ? (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-sm text-muted-foreground">Brak influencerów — użyj "Dodaj nowego" powyżej.</p>
              </div>
            ) : (
              <Select value={influencerId} onValueChange={handleInfluencerChange}>
                <SelectTrigger><SelectValue placeholder="Wybierz influencera..." /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {influencers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Reviewers — multi-select checklist */}
          <div className="space-y-1.5">
            <Label>Kto ocenia pomysły? *</Label>
            {!clientId ? (
              <p className="text-xs text-muted-foreground italic py-1">Wybierz najpierw klienta.</p>
            ) : (
              <>
                <div className="rounded-md border border-border p-2 max-h-[200px] overflow-y-auto space-y-1">
                  {/* Admin option — always first */}
                  <label className="flex items-center gap-2.5 rounded-md px-2 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={reviewerIds.includes('admin')}
                      onCheckedChange={() => toggleReviewer('admin')}
                    />
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary shrink-0">
                      A
                    </div>
                    <span className="text-sm font-medium text-foreground">Ocenia admin</span>
                    <Badge variant="secondary" className="ml-auto text-[10px] border-0 bg-primary/10 text-primary">Admin</Badge>
                  </label>

                  {/* Client users */}
                  {clientUsers.map(u => (
                    <label key={u.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors">
                      <Checkbox
                        checked={reviewerIds.includes(u.id)}
                        onCheckedChange={() => toggleReviewer(u.id)}
                      />
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-xs font-medium text-success shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-foreground">{u.name}</span>
                      <Badge variant="secondary" className="ml-auto text-[10px] border-0 bg-success/10 text-success">Klient</Badge>
                    </label>
                  ))}

                  {clientUsers.length === 0 && (
                    <p className="text-xs text-muted-foreground italic px-2 py-1">
                      Brak kont klienta przypisanych do tej firmy.
                    </p>
                  )}
                </div>
                {reviewerError && (
                  <p className="text-xs text-destructive font-medium">
                    Wybierz co najmniej jedną osobę oceniającą
                  </p>
                )}
              </>
            )}
            <p className="text-[11px] text-muted-foreground">
              Konto do logowania ustawiasz w panelu <strong>Zespół → Klienci</strong>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            {/* Target idea count */}
            <div className="space-y-1.5">
              <Label>Liczba pomysłów</Label>
              <Input
                type="number" min="1" max="50"
                value={targetCount}
                onChange={e => { setTargetCount(e.target.value); setTimeout(() => saveDraft({ targetCount: e.target.value }), 0); }}
                className="h-9"
              />
            </div>
            {/* SLA hours */}
            <div className="space-y-1.5">
              <Label>Deadline influencera (h)</Label>
              <Input
                type="number" min="1" max="168"
                value={slaHours}
                onChange={e => { setSlaHours(e.target.value); setTimeout(() => saveDraft({ slaHours: e.target.value }), 0); }}
                className="h-9"
              />
            </div>
          </div>

          {/* Brief notes */}
          <div className="space-y-1.5">
            <Label>Brief / wskazówki dla influencera</Label>
            <Textarea
              className="min-h-[80px] resize-none text-sm"
              placeholder="np. Szukamy pomysłów na serię filmów o higienie jamy ustnej..."
              value={briefNotes}
              onChange={e => setBriefNotes(e.target.value)}
              onBlur={() => saveDraft()}
            />
          </div>

          {/* Draft indicator */}
          {draftIdRef.current && (
            <p className="text-[10px] text-muted-foreground text-center">
              💾 Szkic zapisany automatycznie — możesz zamknąć i wrócić później
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleSubmit} disabled={!isValid}>Utwórz kampanię</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCampaignDialog;
