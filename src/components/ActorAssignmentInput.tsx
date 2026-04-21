import { useState } from 'react';
import { ActorEntry, ActorSourceType, Client, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Building2, UserPlus, User as UserIcon, Send, X, BellOff, Bell,
  CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react';

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
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggleNotify(actor.id)}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
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
          <Input
            placeholder="@username lub +48..."
            value={actor.telegramHandle}
            onChange={e => onTelegramChange(actor.id, e.target.value)}
            className="h-7 text-xs flex-1"
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
  clientUsers: User[];          // klient-role users linked to this client
  onSubmit: (actors: ActorEntry[]) => void;
  disabled?: boolean;
}

export default function ActorAssignmentInput({
  client,
  clientUsers,
  onSubmit,
  disabled,
}: ActorAssignmentInputProps) {
  const [actors, setActors] = useState<ActorEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newTelegram, setNewTelegram] = useState('');
  const [error, setError] = useState('');

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isAdded = (sourceId: string) => actors.some(a => a.sourceId === sourceId);

  const addFromDB = (
    sourceId: string,
    name: string,
    sourceType: ActorSourceType,
    defaultRole: string,
  ) => {
    if (isAdded(sourceId)) return;
    setActors(prev => [...prev, {
      id: uid(),
      sourceType,
      sourceId,
      name,
      roleLabel: defaultRole,
      notifyChannel: 'telegram',
      telegramHandle: '',
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
      notifyChannel: newTelegram.trim() ? 'telegram' : 'none',
      telegramHandle: newTelegram.trim(),
    }]);
    setNewName(''); setNewRole(''); setNewTelegram('');
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

          {/* Main client contact */}
          {client && (
            <SuggestionCard
              name={client.contactName}
              label={`Kontakt — ${client.email || client.phone || 'brak danych kontaktowych'}`}
              sourceType="client_contact"
              sourceId={`contact-${client.id}`}
              alreadyAdded={isAdded(`contact-${client.id}`)}
              onAdd={() => addFromDB(`contact-${client.id}`, client.contactName, 'client_contact', 'Klient')}
            />
          )}

          {/* Registered klient users */}
          {clientUsers.map(u => (
            <SuggestionCard
              key={u.id}
              name={u.name}
              label="Konto klienta w systemie"
              sourceType="client_user"
              sourceId={u.id}
              alreadyAdded={isAdded(u.id)}
              onAdd={() => addFromDB(u.id, u.name, 'client_user', 'Klient')}
            />
          ))}
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
                Telegram / telefon
                <span className="ml-1 font-normal opacity-60">(opcjonalnie — do powiadomień)</span>
              </label>
              <Input
                placeholder="@username lub +48 600 000 000"
                value={newTelegram}
                onChange={e => setNewTelegram(e.target.value)}
                className="h-8 text-sm"
              />
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
