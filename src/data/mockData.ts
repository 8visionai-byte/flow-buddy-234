import { User, Project, Task, UserRole } from '@/types';

export const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Marcin (Admin)', role: 'admin' },
  { id: 'u2', name: 'Anna (Klient)', role: 'klient' },
  { id: 'u3', name: 'Tomek (Influencer)', role: 'influencer' },
  { id: 'u4', name: 'Kuba (Montażysta)', role: 'montazysta' },
  { id: 'u5', name: 'Ola (Kierownik Planu)', role: 'kierownik_planu' },
];

export const INITIAL_PROJECTS: Project[] = [
  { id: 'p1', name: 'Jak często trzeba robić higienę?', clientName: 'Anna', company: 'Dental Care Sp. z o.o.', clientEmail: 'anna@dentalcare.pl', clientPhone: '+48 600 100 200', currentStageIndex: 0, status: 'active', assignedInfluencerId: 'u3', assignedEditorId: 'u4', assignedClientId: 'u2', assignedKierownikId: 'u5', publicationDate: null, priority: 'medium' },
  { id: 'p2', name: 'Jakie słowo komuś ukradłeś?', clientName: 'Anna', company: 'Dental Care Sp. z o.o.', clientEmail: 'anna@dentalcare.pl', clientPhone: '+48 600 100 200', currentStageIndex: 0, status: 'active', assignedInfluencerId: null, assignedEditorId: null, assignedClientId: null, assignedKierownikId: null, publicationDate: null, priority: 'medium' },
  { id: 'p3', name: '5 trików na produktywność', clientName: 'Anna', company: 'Dental Care Sp. z o.o.', clientEmail: 'anna@dentalcare.pl', clientPhone: '+48 600 100 200', currentStageIndex: 0, status: 'active', assignedInfluencerId: null, assignedEditorId: null, assignedClientId: null, assignedKierownikId: null, publicationDate: null, priority: 'medium' },
];

interface StageDefinition {
  roles: UserRole[];
  title: string;
  description: string;
  inputType: Task['inputType'];
}

export const PIPELINE_STAGES: StageDefinition[] = [
  { roles: ['influencer'], title: 'Dodaj pomysł / temat', description: 'Wpisz temat lub pomysł na film.', inputType: 'text' },
  { roles: ['influencer'], title: 'Przypisz osobę do filmu', description: 'Wybierz klienta lub dodaj inną osobę, która wystąpi w filmie.', inputType: 'actor_assignment' },
  { roles: ['klient'], title: 'Zaakceptuj pomysł', description: 'Przejrzyj pomysł influencera i zaakceptuj lub poproś o zmiany.', inputType: 'approval' },
  { roles: ['klient'], title: 'Zaakceptuj przypisanie osoby', description: 'Przejrzyj przypisaną osobę do filmu i zaakceptuj lub poproś o zmiany.', inputType: 'approval' },
  { roles: ['influencer'], title: 'Dodaj link do scenariusza', description: 'Wklej link do dokumentu ze scenariuszem.', inputType: 'url' },
  { roles: ['klient'], title: 'Zaakceptuj scenariusz', description: 'Przejrzyj scenariusz i zatwierdź lub poproś o zmiany.', inputType: 'approval' },
  { roles: ['influencer'], title: 'Określ rekwizyty', description: 'Wymień potrzebne rekwizyty do nagrania.', inputType: 'text' },
  { roles: ['admin'], title: 'Ustaw termin planu zdjęciowego', description: 'Wybierz datę planu zdjęciowego w kalendarzu.', inputType: 'boolean' },
  { roles: ['admin'], title: 'Nadaj priorytet', description: 'Ustaw priorytet projektu.', inputType: 'text' },
  { roles: ['kierownik_planu'], title: 'Potwierdź nagranie', description: 'Potwierdź, że nagranie się odbyło.', inputType: 'boolean' },
  { roles: ['influencer', 'kierownik_planu', 'admin'], title: 'Dodaj uwagi przed montażem', description: 'Wpisz uwagi istotne dla montażu.', inputType: 'text' },
  { roles: ['admin'], title: 'Wstaw link do frame.io', description: 'Wklej link do filmu na frame.io dla montażysty.', inputType: 'url' },
  { roles: ['montazysta'], title: 'Wgraj surówkę', description: 'Wklej link do surowego materiału.', inputType: 'url' },
  { roles: ['montazysta'], title: 'Wgraj zmontowany film', description: 'Wklej link do zmontowanego filmu.', inputType: 'url' },
  { roles: ['klient'], title: 'Weryfikuj film na frame.io', description: 'Przejrzyj zmontowany film i zaakceptuj.', inputType: 'approval' },
  { roles: ['montazysta'], title: 'Wgraj poprawki', description: 'Wgraj poprawiony film po uwagach klienta.', inputType: 'url' },
  { roles: ['klient', 'admin'], title: 'Akceptacja materiału', description: 'Finalna akceptacja gotowego materiału. Klient może dodać komentarz.', inputType: 'approval' },
  { roles: ['influencer'], title: 'Opisy i tytuły do publikacji', description: 'Uzupełnij opis na Facebooka, Twittera, Instagrama oraz tytuł na YouTube.', inputType: 'social_descriptions' },
  { roles: ['admin'], title: 'Ustaw datę publikacji', description: 'Wybierz datę publikacji filmu.', inputType: 'boolean' },
];

export function createTasksForProject(projectId: string, currentStage: number): Task[] {
  return PIPELINE_STAGES.map((stage, i) => ({
    id: `${projectId}-t${i}`,
    projectId,
    order: i,
    assignedRole: stage.roles[0],
    assignedRoles: stage.roles,
    title: stage.title,
    description: stage.description,
    inputType: stage.inputType,
    status: i < currentStage ? 'done' as const : i === currentStage ? 'todo' as const : 'locked' as const,
    value: i < currentStage ? (stage.inputType === 'boolean' ? 'true' : stage.inputType === 'url' ? 'https://example.com/link' : stage.inputType === 'approval' ? 'approved' : stage.inputType === 'social_descriptions' ? '{"facebook":"Opis FB","twitter":"Tweet","instagram":"Opis IG","youtube":"Tytuł YT"}' : stage.inputType === 'actor_assignment' ? '{"type":"client","name":"Anna"}' : 'Przykładowa wartość') : null,
    previousValue: null,
    clientFeedback: null,
    assignedAt: i === currentStage ? new Date().toISOString() : i < currentStage ? new Date(Date.now() - (currentStage - i) * 86400000).toISOString() : null,
    completedAt: i < currentStage ? new Date(Date.now() - (currentStage - i) * 86400000).toISOString() : null,
    completedBy: i < currentStage ? stage.roles[0] : null,
    deadlineDate: null,
    history: [],
    roleCompletions: {},
  }));
}

export function getInitialTasks(): Task[] {
  return INITIAL_PROJECTS.flatMap(p => createTasksForProject(p.id, p.currentStageIndex));
}
