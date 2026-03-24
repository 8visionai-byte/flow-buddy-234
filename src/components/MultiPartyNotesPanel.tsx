import { useState } from 'react';
import { Task } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Clock, MessageSquare, User as UserIcon, Send, CheckCircle2, Check } from 'lucide-react';

export const NOTES_ROLE_LABELS: Record<string, string> = {
  kierownik_planu: 'Kierownik Planu',
  admin: 'Dyrektor Zarządzający',
  klient: 'Klient',
  influencer: 'Influencer (notatki robocze)',
};

export const NOTES_ROLE_COLORS: Record<string, string> = {
  kierownik_planu: 'bg-secondary/80 text-secondary-foreground',
  admin: 'bg-primary/80 text-primary-foreground',
  klient: 'bg-success/80 text-success-foreground',
  influencer: 'bg-warning/30 text-warning-foreground border border-warning/30',
};

function MultiPartyNotesPanel({
  task,
  role,
  onSubmit,
  onUpdate,
}: {
  task: Task;
  role: string;
  onSubmit: (note: string) => void;
  onUpdate: (note: string) => void;
}) {
  const requiredRoles = task.assignedRoles; // ['kierownik_planu', 'admin', 'klient']
  const myNote = task.roleCompletions[role] ?? '';
  const [draft, setDraft] = useState(myNote);
  const [editing, setEditing] = useState(!myNote); // start in edit mode if no note yet
  const [saved, setSaved] = useState(false);

  const isInfluencer = role === 'influencer';
  const isSubmitted = !!task.roleCompletions[role];

  const othersNotes = Object.entries(task.roleCompletions).filter(
    ([r]) => r !== role && r !== 'influencer' // influencer notes hidden from others
  );

  const handleSave = () => {
    if (!draft.trim()) return;
    if (isSubmitted) {
      onUpdate(draft.trim());
    } else {
      onSubmit(draft.trim());
    }
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Others' submitted notes */}
      {othersNotes.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3" />
            Uwagi od zespołu
          </div>
          {othersNotes.map(([r, note]) => (
            <div key={r} className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <div className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${NOTES_ROLE_COLORS[r] ?? 'bg-muted text-muted-foreground'}`}>
                {NOTES_ROLE_LABELS[r] ?? r}
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap pl-1">{note}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pending roles */}
      {requiredRoles.filter(r => r !== role && !task.roleCompletions[r]).length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground">Oczekuje na:</span>
          {requiredRoles.filter(r => r !== role && !task.roleCompletions[r]).map(r => (
            <span key={r} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground border border-border">
              <Clock className="h-2.5 w-2.5" />
              {NOTES_ROLE_LABELS[r] ?? r}
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Own note */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <UserIcon className="h-3 w-3" />
            {isInfluencer ? 'Twoje notatki robocze (widoczne tylko dla Ciebie)' : 'Twoje uwagi'}
          </span>
          {isSubmitted && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-[10px] text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Edytuj
            </button>
          )}
        </div>

        {!editing && isSubmitted ? (
          <div className="rounded-lg border border-success/30 bg-success/5 p-3">
            <p className="text-sm text-foreground whitespace-pre-wrap">{myNote}</p>
            {!isInfluencer && (
              <div className="flex items-center gap-1 mt-2 text-xs text-success">
                <CheckCircle2 className="h-3 w-3" />
                Wysłano
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea
              placeholder={isInfluencer ? 'Twoje robocze notatki — zespół ich nie widzi...' : 'Wpisz swoje uwagi dla montażysty...'}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={4}
            />
            <Button
              className="w-full"
              disabled={!draft.trim()}
              onClick={handleSave}
            >
              {saved ? (
                <><Check className="mr-2 h-4 w-4" />Zapisano!</>
              ) : isInfluencer ? (
                <><Send className="mr-2 h-4 w-4" />Zapisz notatki</>
              ) : isSubmitted ? (
                <><Send className="mr-2 h-4 w-4" />Zaktualizuj uwagi</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />Wyślij uwagi</>
              )}
            </Button>
            {isInfluencer && (
              <p className="text-[11px] text-muted-foreground text-center">
                Te notatki są prywatne — KP, DZ i Klient ich nie widzą
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MultiPartyNotesPanel;
