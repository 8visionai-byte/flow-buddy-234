import { useState } from 'react';
import { ActorEntry, ActorSourceType, Client, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Building2, UserPlus, User as UserIcon, Send, X, BellOff, Bell,
  CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Phone helpers ─────────────────────────────────────────────────────────────

// Used only for parsing legacy compact format (no UI dropdown)
const KNOWN_DIAL_CODES = ['+420', '+380', '+381', '+385', '+386', '+421',
  '+48', '+49', '+44', '+33', '+39', '+34', '+31', '+32', '+41', '+43',
  '+45', '+46', '+47', '+30', '+36', '+40', '+7', '+1'];

function parsePhone(phone: string): { dialCode: string; local: string } {
  if (!phone) return { dialCode: '+48', local: '' };
  // Preferred format with space separator: "+48 507345902"
  const spaceIdx = phone.indexOf(' ');
  if (spaceIdx > 0) return { dialCode: phone.slice(0, spaceIdx), local: phone.slice(spaceIdx + 1) };
  // Legacy compact format — match known codes (longest first to avoid ambiguity)
  for (const code of KNOWN_DIAL_CODES) {
    if (phone.startsWith(code) && phone.length > code.length) {
      return { dialCode: code, local: phone.slice(code.length) };
    }
  }
  return { dialCode: '+48', local: phone };
}

function toCompactPhone(dialCode: string, local: string): string {
  const localNoSpaces = local.replace(/\s/g, '');
  // Store with space separator so re-parsing is unambiguous
  return localNoSpaces ? `${dialCode} ${localNoSpaces}` : '';
}

interface PhoneFieldProps {
  value: string;
  onChange: (compact: string) => void;
  className?: string;
}

const PhoneField = ({ value, onChange, className = '' }: PhoneFieldProps) => {
  const { dialCode, local } = parsePhone(value);

  const handleDialCode = (raw: string) => {
    const code = raw.startsWith('+') ? raw : '+' + raw;
    onChange(toCompactPhone(code, local));
  };
  const handleLocal = (raw: string) => {
    onChange(toCompactPhone(dialCode, raw));
  };

  return (
    <div className={`flex gap-1.5 ${className}`}>
      <Input
        className="h-7 text-xs w-16 shrink-0 font-mono tabular-nums px-2"
        type="text"
        value={dialCode}
        onChange={e => handleDialCode(e.target.value)}
        maxLength={5}
      />
      <Input
        className="h-7 text-xs flex-1 tabular-nums"
        type="tel"
        inputMode="numeric"
        value={local}
        onChange={e => handleLocal(e.target.value)}
        placeholder="600 100 200"
        maxLength={15}
      />
    </div>
  );
};

// ─── tiny helpers ──────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface ActorRowProps {
  actor: ActorEntry;
  onRemove: (id: string) => void;
  onToggleNotify: (id: string) => void;
  onTelegramChange: (id: string, val: string) => void;
}

const ActorRow = ({ actor, onRemove, onToggleNotify, onTelegramChange }: ActorRowProps) => {
  const sourceLabel =
    actor.sourceType === 'client_contact' ? 'Kontakt klienta' :
    actor.sourceType === 'client_user' ? 'Konto klienta' :
    'Zewnętrzny';

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <UserIcon className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{actor.name}</span>
              {actor.roleLabel && (
                <Badge variant="secondary" className="text-[10px] border-0">{actor.roleLabel}</Badge>
              )}
              <Badge variant="outline" className="text-[10px]">{sourceLabel}</Badge>
            </div>
          </div>
        </div>
        <button
          onClick={() => onRemove(actor.id)}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Telegram notification row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onToggleNotify(actor.id)}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors shrink-0 ${
            actor.notifyChannel === 'telegram'
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {actor.notifyChannel === 'telegram'
            ? <><Bell className="h-3 w-3" /> Telegram</>
            : <><BellOff className="h-3 w-3" /> Brak powiadomień</>
          }
        </button>
        {actor.notifyChannel === 'telegram' && (
          <PhoneField
            value={actor.telegramHandle}
            onChange={compact => onTelegramChange(actor.id, compact)}
            className="flex-1 min-w-[160px]"
          />
        )}
      </div>
    </div>
  );
};

// ─── DB suggestion card ────────────────────────────────────────────────────────
interface SuggestionCardProps {
  name: string;
  label: string;
  sourceType: ActorSourceType;
  sourceId: string;
  alreadyAdded: boolean;
  onAdd: () => void;
}

const SuggestionCard = ({ name, label, sourceType, alreadyAdded, onAdd }: SuggestionCardProps) => (
  <div className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
    alreadyAdded ? 'border-success/30 bg-success/5' : 'border-border hover:border-primary/30 hover:bg-muted/30'
  }`}>
    <div className="flex items-center gap-2">
      <UserIcon className={`h-4 w-4 ${alreadyAdded ? 'text-success' : 'text-muted-foreground'}`} />
      <div>
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
    {alreadyAdded ? (
      <Badge className="text-[10px] bg-success/10 text-success border-0">Dodano</Badge>
    ) : (
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAdd}>
        <UserPlus className="mr-1 h-3 w-3" />
        Dodaj
      </Button>
    )}
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────────

interface ActorAssignmentInputProps {
  client: Client | null;
  clientUsers: User[];
  onSubmit: (actors: ActorEntry[]) => void;
  initialActors?: ActorEntry[];
  disabled?: boolean;
}

export default function ActorAssignmentInput({
  client,
  clientUsers,
  onSubmit,
  initialActors,
  disabled,
}: ActorAssignmentInputProps) {
  const [actors, setActors] = useState<ActorEntry[]>(initialActors ?? []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newPhone, setNewPhone] = useState('');  // compact format
  const [error, setError] = useState('');

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isAdded = (sourceId: string) => actors.some(a => a.sourceId === sourceId);

  const addFromDB = (
    sourceId: string,
    name: string,
    sourceType: ActorSourceType,
    defaultRole: string,
    phone?: string,
  ) => {
    if (isAdded(sourceId)) return;
    // phone is already compact from client data
    const handle = phone || '';
    setActors(prev => [...prev, {
      id: uid(),
      sourceType,
      sourceId,
      name,
      roleLabel: defaultRole,
      notifyChannel: handle ? 'telegram' : 'none',
      telegramHandle: handle,
    }]);
  };

  const addExternal = () => {
    if (!newName.trim()) { setError('Wpisz imię i nazwisko'); return; }
    setError('');
    setActors(prev => [...prev, {
      id: uid(),
      sourceType: 'external',
      name: newName.trim(),
      roleLabel: newRole.trim(),
      notifyChannel: newPhone ? 'telegram' : 'none',
      telegramHandle: newPhone,
    }]);
    setNewName(''); setNewRole(''); setNewPhone('');
    setShowAddForm(false);
  };

  const removeActor = (id: string) => setActors(prev => prev.filter(a => a.id !== id));

  const toggleNotify = (id: string) =>
    setActors(prev => prev.map(a =>
      a.id === id
        ? { ...a, notifyChannel: a.notifyChannel === 'telegram' ? 'none' : 'telegram', telegramHandle: a.notifyChannel === 'telegram' ? '' : a.telegramHandle }
        : a
    ));

  const setTelegram = (id: string, val: string) =>
    setActors(prev => prev.map(a => a.id === id ? { ...a, telegramHandle: val } : a));

  const handleSubmit = () => {
    if (actors.length === 0) { setError('Dodaj co najmniej jedną osobę'); return; }
    setError('');
    onSubmit(actors);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const hasDBSuggestions = client || clientUsers.length > 0;

  return (
    <div className="space-y-4">

      {/* ── From database ─────────────────────────────────────────────── */}
      {hasDBSuggestions && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Building2 className="h-3.5 w-3.5" />
            {client?.companyName ?? 'Z bazy klientów'}
          </div>

          {clientUsers.map(u => {
            const phone = (u as User & { phone?: string }).phone;
            return (
              <SuggestionCard
                key={u.id}
                name={u.name}
                label={phone ? `Klient — ${phone}` : 'Klient'}
                sourceType="client_user"
                sourceId={u.id}
                alreadyAdded={isAdded(u.id)}
                onAdd={() => addFromDB(u.id, u.name, 'client_user', 'Klient', phone)}
              />
            );
          })}
        </div>
      )}

      {/* ── Add external ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
        >
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Dodaj osobę zewnętrzną (aktor, specjalista…)
          </span>
          {showAddForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showAddForm && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Imię i nazwisko *</label>
                <Input
                  placeholder="Jan Nowak"
                  value={newName}
                  onChange={e => { setNewName(e.target.value); setError(''); }}
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Rola / opis</label>
                <Input
                  placeholder="np. Aktor, Dentysta"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Telefon do Telegrama
                <span className="ml-1 font-normal opacity-60">(opcjonalnie — do powiadomień)</span>
              </label>
              <PhoneField value={newPhone} onChange={setNewPhone} className="[&>button]:h-8 [&>input]:h-8 [&>input]:text-sm" />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={addExternal} className="flex-1">
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Dodaj
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddForm(false); setError(''); }}>
                Anuluj
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Assigned actors list ──────────────────────────────────────── */}
      {actors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Osoby na planie ({actors.length})
          </p>
          {actors.map(actor => (
            <ActorRow
              key={actor.id}
              actor={actor}
              onRemove={removeActor}
              onToggleNotify={toggleNotify}
              onTelegramChange={setTelegram}
            />
          ))}
        </div>
      )}

      {/* ── Submit ───────────────────────────────────────────────────── */}
      {error && actors.length === 0 && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <Button
        onClick={handleSubmit}
        className="w-full"
        disabled={disabled || actors.length === 0}
        size="lg"
      >
        <CheckCircle2 className="mr-2 h-4 w-4" />
        Przypisz {actors.length > 0 ? `${actors.length} ${actors.length === 1 ? 'osobę' : actors.length < 5 ? 'osoby' : 'osób'}` : 'osoby'} do planu
      </Button>

      {actors.some(a => a.notifyChannel === 'telegram' && a.telegramHandle) && (
        <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
          <Send className="h-3 w-3" />
          Powiadomienia Telegram zostaną wysłane przez Make.com w wyznaczonym terminie
        </p>
      )}
    </div>
  );
}
