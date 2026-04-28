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

// --- Phone helpers (shared with ClientManagementDialog) ---

const DIAL_CODES = [
  { code: '+48',  flag: '🇵🇱', country: 'PL' },
  { code: '+1',   flag: '🇺🇸', country: 'US/CA' },
  { code: '+44',  flag: '🇬🇧', country: 'UK' },
  { code: '+49',  flag: '🇩🇪', country: 'DE' },
  { code: '+33',  flag: '🇫🇷', country: 'FR' },
  { code: '+39',  flag: '🇮🇹', country: 'IT' },
  { code: '+34',  flag: '🇪🇸', country: 'ES' },
  { code: '+31',  flag: '🇳🇱', country: 'NL' },
  { code: '+380', flag: '🇺🇦', country: 'UA' },
  { code: '+420', flag: '🇨🇿', country: 'CZ' },
];

function formatLocalPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 9);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 3));
  if (digits.length > 3) parts.push(digits.slice(3, 6));
  if (digits.length > 6) parts.push(digits.slice(6, 9));
  return parts.join(' ');
}

function parsePhone(phone: string): { dialCode: string; local: string } {
  if (!phone) return { dialCode: '+48', local: '' };
  const withLocal = phone.match(/^(\+\d+)\s(.+)$/);
  if (withLocal) return { dialCode: withLocal[1], local: withLocal[2] };
  // compact format e.g. "+48123456789"
  const sorted = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const d of sorted) {
    if (phone.startsWith(d.code) && phone.length > d.code.length) {
      return { dialCode: d.code, local: phone.slice(d.code.length) };
    }
  }
  const justCode = phone.match(/^(\+\d+)$/);
  if (justCode) return { dialCode: justCode[1], local: '' };
  return { dialCode: '+48', local: phone };
}

const PhoneField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const { dialCode, local } = parsePhone(value);
  const selected = DIAL_CODES.find(d => d.code === dialCode) ?? DIAL_CODES[0];

  const handleDialCode = (code: string) => onChange(local ? `${code} ${local}` : code);
  const handleLocal = (raw: string) => {
    const formatted = formatLocalPhone(raw);
    onChange(formatted ? `${dialCode} ${formatted}` : dialCode);
  };

  return (
    <div className="flex gap-1.5">
      <Select value={dialCode} onValueChange={handleDialCode}>
        <SelectTrigger className="h-8 w-[90px] text-xs shrink-0 px-2 gap-1">
          <span className="flex items-center gap-1 truncate">
            <span>{selected.flag}</span>
            <span className="font-mono">{selected.code}</span>
          </span>
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          {DIAL_CODES.map(d => (
            <SelectItem key={d.code} value={d.code} className="text-xs font-mono">
              {d.flag} {d.code} <span className="text-muted-foreground ml-1 font-sans">{d.country}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="h-8 text-sm flex-1 tabular-nums"
        type="tel"
        inputMode="numeric"
        value={local}
        onChange={e => handleLocal(e.target.value)}
        placeholder="600 100 200"
        maxLength={11}
      />
    </div>
  );
};

// ---

const EMPTY_CLIENT_FORM = { companyName: '', contactName: '', email: '', phone: '+48', notes: '' };

const AddCampaignDialog = ({ onCreated }: { onCreated?: () => void } = {}) => {
  const { clients, users, addCampaign, addUser, addClient } = useApp();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [influencerId, setInfluencerId] = useState('');
  const [clientUserId, setClientUserId] = useState('');
  const [targetCount, setTargetCount] = useState('12');
  const [slaHours, setSlaHours] = useState('48');
  const [briefNotes, setBriefNotes] = useState('');

  // Inline new client — full form
  const [showNewClient, setShowNewClient] = useState(false);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);
  // additional people beyond the main contact (each with their own phone for Telegram)
  const [pendingContacts, setPendingContacts] = useState<{ name: string; phone: string }[]>([]);
  const [pendingContactName, setPendingContactName] = useState('');
  const [pendingContactPhone, setPendingContactPhone] = useState('+48');

  // Inline new influencer form
  const [showNewInfluencer, setShowNewInfluencer] = useState(false);
  const [newInfluencerName, setNewInfluencerName] = useState('');

  // Inline add reviewer
  const [showAddReviewer, setShowAddReviewer] = useState(false);
  const [newReviewerName, setNewReviewerName] = useState('');
  const [newReviewerPhone, setNewReviewerPhone] = useState('+48');
  // tracks if admin explicitly chose "no reviewer" to prevent auto-reselect
  const [reviewerCleared, setReviewerCleared] = useState(false);

  const influencers = users.filter(u => u.role === 'influencer');
  const clientUsers = clientId ? users.filter(u => u.role === 'klient' && u.clientId === clientId) : [];
  // auto-select only when exactly one klient user AND none manually chosen AND not explicitly cleared
  const autoSelectedClientUser = clientUsers.length === 1 && !clientUserId && !reviewerCleared ? clientUsers[0] : null;
  const effectiveClientUserId = clientUserId || (autoSelectedClientUser?.id ?? '');
  const isValid = !!clientId && !!influencerId;

  const [clientEmailError, setClientEmailError] = useState('');

  const isValidEmail = (email: string) =>
    email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const updateClientForm = (key: string, value: string) => {
    setClientForm(prev => ({ ...prev, [key]: value }));
    if (key === 'email') setClientEmailError('');
  };

  const addPendingContact = () => {
    const name = pendingContactName.trim();
    if (!name) return;
    const { dialCode, local } = parsePhone(pendingContactPhone);
    const localNoSpaces = local.replace(/\s/g, '');
    const phone = localNoSpaces.length > 0 ? `${dialCode}${localNoSpaces}` : '';
    setPendingContacts(prev => [...prev, { name, phone }]);
    setPendingContactName('');
    setPendingContactPhone('+48');
  };

  const cancelNewClient = () => {
    setShowNewClient(false);
    setClientForm(EMPTY_CLIENT_FORM);
    setPendingContacts([]);
    setPendingContactName('');
    setPendingContactPhone('+48');
    setClientEmailError('');
  };

  const handleAddNewClient = () => {
    if (!clientForm.companyName.trim()) return;
    if (clientForm.email && !isValidEmail(clientForm.email)) {
      setClientEmailError('Podaj poprawny adres email');
      return;
    }
    const { dialCode, local } = parsePhone(clientForm.phone);
    const localNoSpaces = local.replace(/\s/g, '');
    const cleanPhone = localNoSpaces.length > 0 ? `${dialCode}${localNoSpaces}` : '';
    const newId = addClient({ ...clientForm, phone: cleanPhone });
    // Auto-create klient user from main contact (with company phone)
    if (clientForm.contactName.trim()) {
      addUser({ name: clientForm.contactName.trim(), role: 'klient', clientId: newId, phone: cleanPhone });
    }
    // Create additional people with their individual phones
    pendingContacts.forEach(p => addUser({ name: p.name, role: 'klient', clientId: newId, phone: p.phone || undefined }));
    setClientId(newId);
    cancelNewClient();
  };

  const handleAddNewInfluencer = () => {
    if (!newInfluencerName.trim()) return;
    const newId = addUser({ name: newInfluencerName.trim(), role: 'influencer' });
    setInfluencerId(newId);
    setNewInfluencerName('');
    setShowNewInfluencer(false);
  };

  const handleAddReviewer = () => {
    if (!newReviewerName.trim() || !clientId) return;
    const { dialCode, local } = parsePhone(newReviewerPhone);
    const localNoSpaces = local.replace(/\s/g, '');
    const phone = localNoSpaces.length > 0 ? `${dialCode}${localNoSpaces}` : undefined;
    const newId = addUser({ name: newReviewerName.trim(), role: 'klient', clientId, phone });
    setClientUserId(newId);
    setShowAddReviewer(false);
    setNewReviewerName('');
    setNewReviewerPhone('+48');
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
    setClientId(''); setInfluencerId(''); setClientUserId(''); setReviewerCleared(false);
    setTargetCount('12'); setSlaHours('48'); setBriefNotes('');
    cancelNewClient();
    setShowNewInfluencer(false); setNewInfluencerName('');
    setOpen(false);
    onCreated?.();
  };

  const resetDialog = () => {
    setClientId(''); setInfluencerId(''); setClientUserId(''); setReviewerCleared(false);
    setTargetCount('12'); setSlaHours('48'); setBriefNotes('');
    cancelNewClient();
    setShowNewInfluencer(false); setNewInfluencerName('');
    setShowAddReviewer(false); setNewReviewerName(''); setNewReviewerPhone('+48');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetDialog(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Lightbulb className="h-4 w-4" />
          Nowa kampania
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Utwórz kampanię pomysłów</DialogTitle>
          <DialogDescription>
            Wybierz klienta i influencera — influencer otrzyma brief i ma podany czas na złożenie pomysłów.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Klient *</Label>
              {!showNewClient && (
                <button
                  type="button"
                  onClick={() => setShowNewClient(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <UserPlus className="h-3 w-3" />Dodaj nowego
                </button>
              )}
            </div>

            {showNewClient ? (
              <div className="rounded-lg border border-primary bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary">Nowy klient</span>
                  <button onClick={cancelNewClient} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nazwa firmy *</Label>
                    <Input
                      className="h-8 text-sm"
                      value={clientForm.companyName}
                      onChange={e => updateClientForm('companyName', e.target.value)}
                      placeholder="Nazwa firmy"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Osoba kontaktowa</Label>
                    <Input
                      className="h-8 text-sm"
                      value={clientForm.contactName}
                      onChange={e => updateClientForm('contactName', e.target.value)}
                      placeholder="Imię i nazwisko"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Email firmy</Label>
                  <Input
                    className={`h-8 text-sm ${clientEmailError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    type="text"
                    value={clientForm.email}
                    onChange={e => updateClientForm('email', e.target.value)}
                    onBlur={() => {
                      if (clientForm.email && !isValidEmail(clientForm.email))
                        setClientEmailError('Podaj poprawny adres email');
                    }}
                    placeholder="email@firma.pl"
                  />
                  {clientEmailError && (
                    <p className="text-[11px] text-destructive">{clientEmailError}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Telefon</Label>
                  <PhoneField value={clientForm.phone} onChange={v => updateClientForm('phone', v)} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Notatki</Label>
                  <Textarea
                    className="text-sm min-h-[48px] resize-none"
                    value={clientForm.notes}
                    onChange={e => updateClientForm('notes', e.target.value)}
                    placeholder="Dodatkowe informacje..."
                  />
                </div>

                {/* Pending contacts */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                      Dostęp do systemu
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {/* Auto entry: main contact person */}
                  {clientForm.contactName.trim() ? (
                    <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">
                        {clientForm.contactName.trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium">{clientForm.contactName.trim()}</span>
                        <span className="ml-1.5 text-[10px] text-primary/70">— osoba kontaktowa</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{parsePhone(clientForm.phone).local || '—'}</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">
                      Wpisz osobę kontaktową powyżej — automatycznie otrzyma dostęp do systemu.
                    </p>
                  )}

                  {/* Additional people */}
                  {pendingContacts.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 text-xs font-medium">{p.name}</span>
                      {p.phone && <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{parsePhone(p.phone).local}</span>}
                      <button onClick={() => setPendingContacts(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Add another person */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground">
                      Jeśli inna osoba będzie oceniać lub prowadzić pomysły, dodaj ją z numerem telefonu (Telegram):
                    </p>
                    <div className="flex gap-1.5">
                      <Input
                        className="h-8 text-sm flex-1"
                        placeholder="Imię i nazwisko..."
                        value={pendingContactName}
                        onChange={e => setPendingContactName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPendingContact())}
                      />
                    </div>
                    <div className="flex gap-1.5">
                      <PhoneField value={pendingContactPhone} onChange={setPendingContactPhone} />
                      <Button size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={addPendingContact} disabled={!pendingContactName.trim()}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={!clientForm.companyName.trim()}
                    onClick={handleAddNewClient}
                  >
                    <Check className="h-3 w-3" />Dodaj i wybierz
                  </Button>
                </div>
              </div>
            ) : clients.length === 0 ? (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-sm text-muted-foreground">Brak klientów — użyj "Dodaj nowego" powyżej.</p>
              </div>
            ) : (
              <Select value={clientId} onValueChange={v => { setClientId(v); setClientUserId(''); setReviewerCleared(false); }}>
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

          {/* Client reviewer */}
          <div className="space-y-1.5">
            <Label>Kto ocenia pomysły?</Label>
            {!clientId ? (
              <p className="text-xs text-muted-foreground italic py-1">Wybierz najpierw klienta.</p>
            ) : (
              <>
                <Select
                  value={effectiveClientUserId || 'none'}
                  onValueChange={v => {
                    if (v === '__add_new__') {
                      setShowAddReviewer(true);
                    } else if (v === 'none') {
                      setClientUserId('');
                      setReviewerCleared(true);
                      setShowAddReviewer(false);
                    } else {
                      setClientUserId(v);
                      setReviewerCleared(false);
                      setShowAddReviewer(false);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Wybierz osobę oceniającą..." /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="none">— Ocenia admin —</SelectItem>
                    {clientUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                    <SelectItem value="__add_new__" className="text-primary font-medium">
                      + Dodaj nową osobę...
                    </SelectItem>
                  </SelectContent>
                </Select>

                {showAddReviewer && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                    <span className="text-xs font-semibold text-primary">Nowa osoba oceniająca</span>
                    <Input
                      className="h-8 text-sm"
                      placeholder="Imię i nazwisko *"
                      value={newReviewerName}
                      onChange={e => setNewReviewerName(e.target.value)}
                      autoFocus
                    />
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Telefon (Telegram)</label>
                      <PhoneField value={newReviewerPhone} onChange={setNewReviewerPhone} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Osoba zostanie zapisana do klienta i będzie dostępna w przyszłych kampaniach.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="h-7 text-xs gap-1 flex-1" disabled={!newReviewerName.trim()} onClick={handleAddReviewer}>
                        <Check className="h-3 w-3" />Dodaj i wybierz
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAddReviewer(false); setNewReviewerName(''); setNewReviewerPhone('+48'); }}>
                        Anuluj
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Liczba pomysłów</Label>
              <Input
                type="number" min="1" max="50"
                value={targetCount}
                onChange={e => setTargetCount(e.target.value)}
                className="h-9"
              />
            </div>
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
