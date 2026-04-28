import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ROLE_LABELS } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  LogOut,
  Video,
  CalendarClock,
  CheckCircle2,
  MessageSquare,
  Send,
} from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

const KierownikDashboard = () => {
  const { currentUser, setCurrentUser, projects, tasks, completeTask } = useApp();
  const [uwagiValues, setUwagiValues] = useState<Record<string, string>>({});

  if (!currentUser) return null;

  const activeProjects = projects.filter(
    p => p.status === 'active' && p.assignedKierownikId === currentUser.id,
  );

  const getProjectTasks = (projectId: string) =>
    tasks.filter(t => t.projectId === projectId && t.assignedRoles.includes('kierownik_planu'));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/yads-logo.png" alt="YADS" className="h-8 w-auto rounded" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">Panel Kierownika Planu</h1>
              <p className="text-xs text-muted-foreground">
                {currentUser.name} · {ROLE_LABELS[currentUser.role]}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentUser(null)}
            title="Zmień użytkownika"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 md:p-6">
        {activeProjects.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Video className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Brak aktywnych pomysłów</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Column headers */}
            <div className="grid grid-cols-[auto_1fr_1fr] gap-0 px-3 pb-1">
              <div className="w-8" />
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pl-3">
                Potwierdzenie nagrania
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pl-4 border-l border-border">
                Uwagi przed montażem
              </div>
            </div>

            {activeProjects.map((project, idx) => {
              const projectTasks = getProjectTasks(project.id);
              const confirmTask = projectTasks.find(t => t.title === 'Potwierdź nagranie');
              const uwagiTask = projectTasks.find(t => t.title === 'Wnieś uwagi przed montażem');

              const isConfirmed = confirmTask?.status === 'done';
              const notesSent = !!(uwagiTask?.roleCompletions['kierownik_planu']);
              const noteVal = uwagiValues[project.id] ?? '';

              const handleConfirm = () => {
                if (!confirmTask || isConfirmed) return;
                completeTask(confirmTask.id, 'true', 'kierownik_planu');
              };

              const handleSendNotes = () => {
                const val = noteVal.trim();
                if (!val || !uwagiTask) return;
                completeTask(uwagiTask.id, val, 'kierownik_planu');
                setUwagiValues(prev => { const n = { ...prev }; delete n[project.id]; return n; });
              };

              return (
                <div
                  key={project.id}
                  className="grid grid-cols-[auto_1fr_1fr] items-stretch rounded-xl border border-border bg-card overflow-hidden"
                >
                  {/* Index */}
                  <div className="flex items-center justify-center w-10 border-r border-border bg-muted/30">
                    <span className="text-sm font-semibold text-muted-foreground">{idx + 1}</span>
                  </div>

                  {/* LEFT: Confirm */}
                  <div className="p-4 space-y-2 border-r border-border">
                    {/* Project info */}
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-tight">
                        {project.name || project.company}
                      </p>
                      {project.company && project.name && (
                        <p className="text-[11px] text-muted-foreground">{project.company}</p>
                      )}
                    </div>

                    {/* Filming date */}
                    {confirmTask?.deadlineDate ? (
                      <div className={`flex items-center gap-1.5 text-xs font-medium ${
                        new Date(confirmTask.deadlineDate) < new Date()
                          ? 'text-destructive'
                          : 'text-warning'
                      }`}>
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                        {format(new Date(confirmTask.deadlineDate), 'dd.MM.yyyy', { locale: pl })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                        Brak terminu
                      </div>
                    )}

                    {/* Confirm action */}
                    {isConfirmed ? (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-success">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        Nagranie potwierdzone
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
                        onClick={handleConfirm}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Potwierdź nagranie
                      </Button>
                    )}
                  </div>

                  {/* RIGHT: Notes */}
                  <div className="p-4 space-y-2">
                    {notesSent ? (
                      /* Already sent */
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-success">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          Uwagi wysłane
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {uwagiTask!.roleCompletions['kierownik_planu']}
                        </p>
                      </div>
                    ) : (
                      /* Input */
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Wpisz uwagi z planu zdjęciowego…"
                          value={noteVal}
                          onChange={e =>
                            setUwagiValues(prev => ({ ...prev, [project.id]: e.target.value }))
                          }
                          rows={2}
                          className="text-sm resize-none"
                          disabled={!uwagiTask}
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1.5"
                            disabled={!noteVal.trim() || !uwagiTask}
                            onClick={handleSendNotes}
                          >
                            <Send className="h-3 w-3" />
                            Wyślij uwagi
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5 text-muted-foreground"
                            disabled={!uwagiTask}
                            onClick={() => {
                              if (!uwagiTask) return;
                              completeTask(uwagiTask.id, 'Brak uwag', 'kierownik_planu');
                            }}
                          >
                            Brak uwag
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default KierownikDashboard;
