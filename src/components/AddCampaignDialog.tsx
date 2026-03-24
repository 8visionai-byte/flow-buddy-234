import { useState } from 'react';
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
import { Lightbulb, Plus, X, Check, UserPlus } from 'lucide-react';

const AddCampaignDialog = () => {
  const { clients, users, addCampaign, addUser } = useApp();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [influencerId, setInfluencerId] = useState('');
  const [clientUserId, setClientUserId] = useState('');
  const [targetCount, setTargetCount] = useState('12');
  const [slaHours, setSlaHours] = useState('48');
  const [briefNotes, setBriefNotes] = useState('');

  // Inline new influencer form
  const [showNewInfluencer, setShowNewInfluencer] = useState(false);
  const [newInfluencerName, setNewInfluencerName] = useState('');
  const [newInfluencerEmail, setNewInfluencerEmail] = useState('');

  const influencers = users.filter(u => u.role === 'influencer');
  // Filter klient users by the selected client company (via user.clientId link)
  const clientUsers = clientId
    ? users.filter(u => u.role === 'klient' && u.clientId === clientId)
    : [];
  // Auto-select if exactly one matching klient user
  const autoSelectedClientUser = clientUsers.length === 1 ? clientUsers[0] : null;
  const effectiveClientUserId = autoSelectedClientUser ? autoSelectedClientUser.id : clientUserId;
  const isValid = !!clientId && !!influencerId;

  const handleAddNewInfluencer = () => {
    if (!newInfluencerName.trim()) return;
    const newId = addUser({ name: newInfluencerName.trim(), role: 'influencer' });
    setInfluencerId(newId);
    setNewInfluencerName(''); setNewInfluencerEmail(''); setShowNewInfluencer(false);
  };

  const handleSubmit = () => {
    if (!isValid) return;
    addCampaign({
      clientId,
      assignedInfluencerId: influencerId,
      assignedClientUserId: effectiveClientUserId || null,
      targetIdeaCount: Math.max(1, parseInt(targetCount) || 12),
      slaHours: Math.max(1, parseInt(slaHours) || 48),
      briefNotes: briefNotes.trim(),
    });
    // Reset
    setClientId(''); setInfluencerId(''); setClientUserId('');
    setTargetCount('12'); setSlaHours('48'); setBriefNotes('');
    setShowNewInfluencer(false); setNewInfluencerName(''); setNewInfluencerEmail('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Wybierz klienta i influencera — influencer otrzyma brief i ma podany czas na złożenie pomysłów.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client */}
          <div className="space-y-1.5">
            <Label>Klient *</Label>
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Dodaj najpierw klienta w panelu „Klienci".</p>
            ) : (
              <Select value={clientId} onValueChange={setClientId}>
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
              <Select value={influencerId} onValueChange={setInfluencerId}>
                <SelectTrigger><SelectValue placeholder="Wybierz influencera..." /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {influencers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Client reviewer — auto-resolved from company link */}
          <div className="space-y-1.5">
            <Label>Kto ocenia pomysły?</Label>
            {!clientId ? (
              <p className="text-xs text-muted-foreground italic py-1">Wybierz najpierw klienta.</p>
            ) : autoSelectedClientUser ? (
              // Exactly one user linked to this company — auto-selected
              <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/5 px-3 py-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/20 text-xs font-medium text-success">
                  {autoSelectedClientUser.name.charAt(0)}
                </div>
                <span className="text-sm font-medium text-foreground">{autoSelectedClientUser.name}</span>
                <span className="ml-auto text-[10px] text-success">auto</span>
              </div>
            ) : clientUsers.length > 1 ? (
              // Multiple users — show dropdown
              <Select value={clientUserId || 'none'} onValueChange={v => setClientUserId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Wybierz osobę oceniającą..." /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="none">— Ocenia admin —</SelectItem>
                  {clientUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              // No user linked to this company
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <span className="text-xs text-muted-foreground italic">
                  Brak konta klienta przypisanego do tej firmy.
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">ocenia admin</span>
              </div>
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
                onChange={e => setTargetCount(e.target.value)}
                className="h-9"
              />
            </div>
            {/* SLA hours */}
            <div className="space-y-1.5">
              <Label>Deadline influencera (h)</Label>
              <Input
                type="number" min="1" max="168"
                value={slaHours}
                onChange={e => setSlaHours(e.target.value)}
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
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
          <Button onClick={handleSubmit} disabled={!isValid}>Utwórz kampanię</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCampaignDialog;
