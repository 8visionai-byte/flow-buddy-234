import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Client } from '@/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Pencil, Trash2, X, Check, UserPlus } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// --- Phone helpers ---

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
  const justCode = phone.match(/^(\+\d+)$/);
  if (justCode) return { dialCode: justCode[1], local: '' };
  return { dialCode: '+48', local: phone };
}

interface PhoneFieldProps {
  value: string;
  onChange: (full: string) => void;
  size?: 'sm' | 'normal';
}

const PhoneField = ({ value, onChange, size = 'sm' }: PhoneFieldProps) => {
  const { dialCode, local } = parsePhone(value);
  const h = size === 'sm' ? 'h-8' : 'h-9';
  const selected = DIAL_CODES.find(d => d.code === dialCode) ?? DIAL_CODES[0];

  const handleDialCode = (code: string) => {
    onChange(local ? `${code} ${local}` : code);
  };

  const handleLocal = (raw: string) => {
    const formatted = formatLocalPhone(raw);
    onChange(formatted ? `${dialCode} ${formatted}` : dialCode);
  };

  return (
    <div className="flex gap-1.5">
      <Select value={dialCode} onValueChange={handleDialCode}>
        <SelectTrigger className={`${h} w-[90px] text-xs shrink-0 px-2 gap-1`}>
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
        className={`${h} text-sm flex-1 tabular-nums tracking-widest`}
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

// --- Main component ---

const EMPTY_FORM = { companyName: '', contactName: '', email: '', phone: '+48', notes: '' };

const ClientManagementDialog = () => {
  const { clients, addClient, updateClient, deleteClient, users, addUser, deleteUser } = useApp();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // Pending contacts for new-company form (before company is saved)
  const [pendingContacts, setPendingContacts] = useState<string[]>([]);
  const [pendingContactInput, setPendingContactInput] = useState('');

  // Adding contact to an existing company
  const [addingContactForId, setAddingContactForId] = useState<string | null>(null);
  const [contactInput, setContactInput] = useState('');

  // Delete confirmations
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<string | null>(null);

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const isValid = form.companyName.trim().length > 0;

  // Users linked to a specific company
  const getLinkedUsers = (clientId: string) =>
    users.filter(u => u.role === 'klient' && u.clientId === clientId);

  // ── New-company pending contacts ──────────────────────────────────────────
  const addPendingContact = () => {
    const name = pendingContactInput.trim();
    if (!name) return;
    setPendingContacts(prev => [...prev, name]);
    setPendingContactInput('');
  };

  const removePendingContact = (index: number) =>
    setPendingContacts(prev => prev.filter((_, i) => i !== index));

  // ── Add contact to existing company ──────────────────────────────────────
  const confirmAddContact = (clientId: string) => {
    const name = contactInput.trim();
    if (!name) return;
    addUser({ name, role: 'klient', clientId });
    setContactInput('');
    setAddingContactForId(null);
  };

  // ── Form lifecycle ────────────────────────────────────────────────────────
  const startEdit = (client: Client) => {
    setEditingId(client.id);
    setAddingNew(false);
    setForm({
      companyName: client.companyName,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone || '+48',
      notes: client.notes,
    });
  };

  const startAdd = () => {
    setEditingId(null);
    setAddingNew(true);
    setForm(EMPTY_FORM);
    setPendingContacts([]);
    setPendingContactInput('');
  };

  const cancel = () => {
    setEditingId(null);
    setAddingNew(false);
    setForm(EMPTY_FORM);
    setPendingContacts([]);
    setPendingContactInput('');
  };

  const save = () => {
    if (!isValid) return;
    const { local } = parsePhone(form.phone);
    const cleanPhone = local.replace(/\s/g, '').length > 0 ? form.phone : '';
    const data = { ...form, phone: cleanPhone };

    if (addingNew) {
      // addClient now returns the new ID so we can link users immediately
      const newClientId = addClient(data);
      pendingContacts.forEach(name => {
        addUser({ name, role: 'klient', clientId: newClientId });
      });
    } else if (editingId) {
      updateClient(editingId, data);
    }
    cancel();
  };

  const confirmDelete = (id: string) => setDeleteConfirm(id);
  const handleDelete = () => {
    if (deleteConfirm) {
      deleteClient(deleteConfirm);
      if (editingId === deleteConfirm) cancel();
      setDeleteConfirm(null);
    }
  };

  const handleDeleteUser = () => {
    if (deleteUserConfirm) {
      deleteUser(deleteUserConfirm);
      setDeleteUserConfirm(null);
    }
  };

  const deleteTarget = clients.find(c => c.id === deleteConfirm);
  const deleteUserTarget = users.find(u => u.id === deleteUserConfirm);

  // ── Shared company form fields ────────────────────────────────────────────
  const renderFormFields = (isNew = false) => (
    <div className="space-y-2">
      {isNew && <p className="text-xs font-semibold text-primary">Nowy klient</p>}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Nazwa firmy *</Label>
          <Input
            className="h-8 text-sm"
            value={form.companyName}
            onChange={e => update('companyName', e.target.value)}
            placeholder="Nazwa firmy"
            autoFocus={isNew}
            onKeyDown={e => e.key === 'Enter' && save()}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Osoba kontaktowa</Label>
          <Input
            className="h-8 text-sm"
            value={form.contactName}
            onChange={e => update('contactName', e.target.value)}
            placeholder="Imię i nazwisko"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Email firmy</Label>
        <Input
          className="h-8 text-sm"
          type="email"
          value={form.email}
          onChange={e => update('email', e.target.value)}
          placeholder="email@firma.pl"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Telefon</Label>
        <PhoneField value={form.phone} onChange={v => update('phone', v)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notatki</Label>
        <Textarea
          className="text-sm min-h-[48px] resize-none"
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
          placeholder="Dodatkowe informacje..."
        />
      </div>

      {/* Pending contacts (only for new company) */}
      {isNew && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
              Osoby z dostępem do systemu
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Dodaj osoby, które będą logować się jako klient i oceniać pomysły / projekty.
          </p>

          {pendingContacts.map((name, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-2.5 py-1.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-[10px] font-semibold text-success">
                {name.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 text-xs font-medium text-foreground">{name}</span>
              <button onClick={() => removePendingContact(i)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <div className="flex gap-1.5">
            <Input
              className="h-8 text-sm flex-1"
              placeholder="Imię i nazwisko osoby..."
              value={pendingContactInput}
              onChange={e => setPendingContactInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPendingContact())}
            />
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={addPendingContact} disabled={!pendingContactInput.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancel}>
          <X className="mr-1 h-3 w-3" />Anuluj
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={save} disabled={!isValid}>
          <Check className="mr-1 h-3 w-3" />{isNew ? 'Dodaj klienta' : 'Zapisz'}
        </Button>
      </div>
    </div>
  );

  // ── Contacts section for an existing company ──────────────────────────────
  const renderContactsSection = (clientId: string) => {
    const linked = getLinkedUsers(clientId);
    const isAddingHere = addingContactForId === clientId;

    return (
      <div className="mt-2 space-y-1.5 border-t border-border pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Osoby z dostępem ({linked.length})
          </span>
          {!isAddingHere && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => { setAddingContactForId(clientId); setContactInput(''); }}
            >
              <UserPlus className="h-3 w-3" />
              Dodaj osobę
            </Button>
          )}
        </div>

        {linked.length === 0 && !isAddingHere && (
          <p className="text-[11px] text-muted-foreground italic">
            Brak — dodaj osoby, które będą logować się jako klient.
          </p>
        )}

        {linked.map(user => (
          <div key={user.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 text-xs font-medium text-foreground">{user.name}</span>
            <Badge variant="secondary" className="border-0 bg-success/10 text-success text-[10px] px-1.5">klient</Badge>
            <button
              onClick={() => setDeleteUserConfirm(user.id)}
              className="text-muted-foreground hover:text-destructive"
              title="Usuń dostęp"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        {isAddingHere && (
          <div className="flex gap-1.5">
            <Input
              className="h-8 text-sm flex-1"
              placeholder="Imię i nazwisko nowej osoby..."
              value={contactInput}
              onChange={e => setContactInput(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') confirmAddContact(clientId);
                if (e.key === 'Escape') setAddingContactForId(null);
              }}
            />
            <Button size="sm" className="h-8 px-2" onClick={() => confirmAddContact(clientId)} disabled={!contactInput.trim()}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setAddingContactForId(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) cancel(); }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Building2 className="h-4 w-4" />
            Klienci
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Zarządzaj klientami</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1 max-h-[65vh] overflow-y-auto pr-1">
            {clients.length === 0 && !addingNew && (
              <p className="text-sm text-muted-foreground text-center py-4">Brak zarejestrowanych klientów</p>
            )}

            {clients.map(client => {
              const isEditing = editingId === client.id;
              return (
                <div
                  key={client.id}
                  className={`rounded-lg border p-3 transition-colors ${isEditing ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
                >
                  {isEditing ? renderFormFields(false) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{client.companyName}</span>
                            <Badge variant="secondary" className="text-[10px] border-0 bg-muted text-muted-foreground">firma</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {client.contactName && <span>{client.contactName}</span>}
                            {client.email ? <span> · {client.email}</span> : null}
                            {client.phone ? <span> · {client.phone}</span> : null}
                          </p>
                          {client.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 italic truncate">{client.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(client)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => confirmDelete(client.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {renderContactsSection(client.id)}
                    </>
                  )}
                </div>
              );
            })}

            {addingNew && (
              <div className="rounded-lg border border-primary bg-primary/5 p-3">
                {renderFormFields(true)}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {!addingNew && !editingId && (
              <Button size="sm" className="gap-2" onClick={startAdd}>
                <Plus className="h-4 w-4" />
                Nowy klient
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Zamknij</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete company confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń klienta?</AlertDialogTitle>
            <AlertDialogDescription>
              Firma „{deleteTarget?.companyName}" zostanie usunięta. Projekty i kampanie powiązane z tą firmą stracą powiązanie, ale nie zostaną usunięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Usuń</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete user/contact confirmation */}
      <AlertDialog open={!!deleteUserConfirm} onOpenChange={open => !open && setDeleteUserConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń dostęp?</AlertDialogTitle>
            <AlertDialogDescription>
              Konto „{deleteUserTarget?.name}" zostanie usunięte z systemu. Osoba straci dostęp do platformy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Usuń</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ClientManagementDialog;
