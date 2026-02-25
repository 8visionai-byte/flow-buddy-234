import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ROLE_LABELS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  LogOut,
  Plus,
  Video,
  Link as LinkIcon,
  FileText,
  Trash2,
  CalendarClock,
  ExternalLink,
  CheckCircle2,
  X,
  Lock,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

const KierownikDashboard = () => {
  const { currentUser, setCurrentUser, projects, tasks, recordings, projectNotes, addRecording, deleteRecording, addProjectNote, deleteProjectNote, completeTask } = useApp();
  const [addingForProject, setAddingForProject] = useState<string | null>(null);
  const [addingNoteForProject, setAddingNoteForProject] = useState<string | null>(null);
  const [recUrl, setRecUrl] = useState('');
  const [recNote, setRecNote] = useState('');
  const [error, setError] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteError, setNoteError] = useState('');
  const [uwagiValues, setUwagiValues] = useState<Record<string, string>>({});
  const [uwagiError, setUwagiError] = useState('');

  if (!currentUser) return null;

  const activeProjects = projects.filter(p => p.status === 'active');

  const getProjectTasks = (projectId: string) =>
    tasks.filter(t => t.projectId === projectId && t.assignedRoles.includes('kierownik_planu'));

  const getProjectRecordings = (projectId: string) =>
    recordings.filter(r => r.projectId === projectId);

  const getProjectNotes = (projectId: string) =>
    projectNotes.filter(n => n.projectId === projectId);

  const handleAddRecording = (projectId: string) => {
    if (!recUrl.trim() && !recNote.trim()) {
      setError('Podaj link lub opis nagrania');
      return;
    }
    setError('');
    addRecording(projectId, recUrl.trim(), recNote.trim());
    setRecUrl('');
    setRecNote('');
    setAddingForProject(null);
  };

  const handleAddNote = (projectId: string) => {
    if (!noteContent.trim()) {
      setNoteError('Wpisz treść uwagi');
      return;
    }
    setNoteError('');
    addProjectNote(projectId, noteContent.trim());
    setNoteContent('');
    setAddingNoteForProject(null);
  };

  const handleCompleteTask = (taskId: string) => {
    completeTask(taskId, 'true', 'kierownik_planu');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Panel Kierownika Planu</h1>
            <p className="text-xs text-muted-foreground">{currentUser.name} · {ROLE_LABELS[currentUser.role]}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentUser(null)} title="Zmień użytkownika">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 md:p-6 space-y-6">
        {activeProjects.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Video className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Brak aktywnych projektów</p>
          </div>
        ) : (
          activeProjects.map(project => {
            const projectTasks = getProjectTasks(project.id);
            const projectRecordings = getProjectRecordings(project.id);
            const projectProjectNotes = getProjectNotes(project.id);
            const confirmTask = projectTasks.find(t => t.title === 'Potwierdź nagranie');
            const uwagiTask = projectTasks.find(t => t.title === 'Dodaj uwagi przed montażem');
            const isAdding = addingForProject === project.id;
            const isAddingNote = addingNoteForProject === project.id;

            return (
              <Card key={project.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <CardDescription>{project.company} · {project.clientName}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Show task status badges */}
                      {projectTasks.map(t => (
                        <Badge
                          key={t.id}
                          variant={t.status === 'done' ? 'default' : t.status === 'todo' ? 'secondary' : 'outline'}
                          className="text-[10px]"
                        >
                          {t.title}
                          {t.status === 'done' && <CheckCircle2 className="ml-1 h-3 w-3" />}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Deadline display */}
                  {confirmTask?.deadlineDate && (
                    <div className={`mt-2 flex items-center gap-2 text-xs font-medium ${
                      new Date(confirmTask.deadlineDate) < new Date() ? 'text-destructive' : 'text-warning'
                    }`}>
                      <CalendarClock className="h-3.5 w-3.5" />
                      Termin nagrania: {format(new Date(confirmTask.deadlineDate), 'dd.MM.yyyy', { locale: pl })}
                    </div>
                  )}
                  {confirmTask && !confirmTask.deadlineDate && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Brak przypisanego terminu — skontaktuj się z Adminem
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Existing recordings */}
                  {projectRecordings.length > 0 && (
                    <div className="space-y-2">
                      {projectRecordings.map((rec, i) => (
                        <div key={rec.id} className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            {rec.url && (
                              <a
                                href={rec.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-primary hover:underline truncate"
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                {rec.url}
                              </a>
                            )}
                            {rec.note && (
                              <p className="text-xs text-muted-foreground">{rec.note}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(rec.createdAt), 'dd.MM.yyyy, HH:mm', { locale: pl })}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteRecording(rec.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add recording form */}
                  {isAdding ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Link do nagrania</label>
                        <div className="relative">
                          <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="https://..."
                            value={recUrl}
                            onChange={e => { setRecUrl(e.target.value); setError(''); }}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Opis nagrania</label>
                        <Textarea
                          placeholder="Np. Scena 1 – gabinet, ujęcie frontalne..."
                          value={recNote}
                          onChange={e => setRecNote(e.target.value)}
                          rows={2}
                        />
                      </div>
                      {error && (
                        <p className="text-xs text-destructive">{error}</p>
                      )}
                      <div className="flex gap-2">
                        <Button onClick={() => handleAddRecording(project.id)} className="flex-1" size="sm">
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Zapisz nagranie
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setAddingForProject(null); setRecUrl(''); setRecNote(''); setError(''); }}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Anuluj
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => setAddingForProject(project.id)}
                    >
                      <Plus className="h-4 w-4" />
                      Dodaj nagranie ({projectRecordings.length})
                    </Button>
                  )}

                  {/* Uwagi z nagrania */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <MessageSquare className="h-4 w-4" />
                      Uwagi z nagrania ({projectProjectNotes.length})
                    </div>
                    {projectProjectNotes.map((note, i) => (
                      <div key={note.id} className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(note.createdAt), 'dd.MM.yyyy, HH:mm', { locale: pl })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteProjectNote(note.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {isAddingNote ? (
                      <div className="rounded-lg border border-secondary/40 bg-secondary/10 p-4 space-y-3">
                        <Textarea
                          placeholder="Wpisz uwagę lub sugestię z nagrania..."
                          value={noteContent}
                          onChange={e => { setNoteContent(e.target.value); setNoteError(''); }}
                          rows={3}
                        />
                        {noteError && <p className="text-xs text-destructive">{noteError}</p>}
                        <div className="flex gap-2">
                          <Button onClick={() => handleAddNote(project.id)} className="flex-1" size="sm">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Zapisz uwagę
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setAddingNoteForProject(null); setNoteContent(''); setNoteError(''); }}
                          >
                            <X className="mr-1 h-3 w-3" />
                            Anuluj
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => setAddingNoteForProject(project.id)}
                      >
                        <Plus className="h-4 w-4" />
                        Dodaj uwagę
                      </Button>
                    )}
                  </div>

                  {/* Confirm recording task button */}
                  {confirmTask && confirmTask.status === 'todo' && (
                    <Button
                      onClick={() => handleCompleteTask(confirmTask.id)}
                      className="w-full bg-success hover:bg-success/90 text-success-foreground"
                      size="sm"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Potwierdź zakończenie nagrań
                    </Button>
                  )}
                  {confirmTask && confirmTask.status === 'done' && (
                    <div className="flex items-center gap-2 text-xs text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Nagrania potwierdzone
                    </div>
                  )}

                  {/* Uwagi przed montażem */}
                  {uwagiTask && uwagiTask.status === 'todo' && !uwagiTask.roleCompletions['kierownik_planu'] && (
                    <div className="rounded-lg border border-border p-4 space-y-3">
                      <label className="block text-sm font-medium text-foreground">
                        <FileText className="inline mr-1.5 h-4 w-4" />
                        Uwagi przed montażem
                      </label>
                      <Textarea
                        placeholder="Wpisz uwagi z planu zdjęciowego..."
                        value={uwagiValues[uwagiTask.id] || ''}
                        onChange={e => {
                          setUwagiValues(prev => ({ ...prev, [uwagiTask.id]: e.target.value }));
                          setUwagiError('');
                        }}
                        rows={3}
                      />
                      {uwagiError && <p className="text-xs text-destructive">{uwagiError}</p>}
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={!(uwagiValues[uwagiTask.id] || '').trim()}
                        onClick={() => {
                          const val = (uwagiValues[uwagiTask.id] || '').trim();
                          if (!val) { setUwagiError('Wpisz uwagi'); return; }
                          completeTask(uwagiTask.id, val, 'kierownik_planu');
                          setUwagiValues(prev => { const n = { ...prev }; delete n[uwagiTask.id]; return n; });
                        }}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Wyślij uwagi
                      </Button>
                    </div>
                  )}
                  {uwagiTask && (uwagiTask.status === 'done' || uwagiTask.roleCompletions['kierownik_planu']) && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 text-xs text-success mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Uwagi wysłane
                      </div>
                      {uwagiTask.roleCompletions['kierownik_planu'] && (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{uwagiTask.roleCompletions['kierownik_planu']}</p>
                      )}
                    </div>
                  )}
                  {uwagiTask && uwagiTask.status === 'locked' && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Lock className="h-3 w-3" />
                      Uwagi przed montażem — odblokowane po potwierdzeniu nagrań
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
};

export default KierownikDashboard;
