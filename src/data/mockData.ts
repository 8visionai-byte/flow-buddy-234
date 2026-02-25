import { User, Project, Task } from '@/types';

export const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Marcin (Admin)', role: 'admin' },
  { id: 'u2', name: 'Anna (Klient)', role: 'klient' },
  { id: 'u3', name: 'Tomek (Influencer)', role: 'influencer' },
  { id: 'u4', name: 'Kuba (Montażysta)', role: 'montazysta' },
  { id: 'u5', name: 'Ola (Kierownik Planu)', role: 'kierownik_planu' },
];

export const INITIAL_PROJECTS: Project[] = [
  { id: 'p1', name: 'Jak często trzeba robić higienę?', clientName: 'Anna', company: 'Dental Care Sp. z o.o.', clientEmail: 'anna@dentalcare.pl', clientPhone: '+48 600 100 200', currentStageIndex: 0, status: 'active', assignedInfluencerId: 'u3', assignedEditorId: 'u4', publicationDate: null, priority: 'medium' },
  { id: 'p2', name: 'Jakie słowo komuś ukradłeś?', clientName: 'Anna', company: 'Dental Care Sp. z o.o.', clientEmail: 'anna@dentalcare.pl', clientPhone: '+48 600 100 200', currentStageIndex: 0, status: 'active', assignedInfluencerId: null, assignedEditorId: null, publicationDate: null, priority: 'medium' },
  { id: 'p3', name: '5 trików na produktywność', clientName: 'Anna', company: 'Dental Care Sp. z o.o.', clientEmail: 'anna@dentalcare.pl', clientPhone: '+48 600 100 200', currentStageIndex: 0, status: 'active', assignedInfluencerId: null, assignedEditorId: null, publicationDate: null, priority: 'medium' },
];

export function createTasksForProject(projectId: string, currentStage: number): Task[] {
  const stages: { role: Task['assignedRole']; title: string; description: string; inputType: Task['inputType'] }[] = [
    { role: 'influencer', title: 'Dodaj pomysł / temat', description: 'Wpisz temat lub pomysł na film.', inputType: 'text' },
    { role: 'klient', title: 'Zaakceptuj pomysł', description: 'Przejrzyj pomysł influencera i zaakceptuj lub poproś o zmiany.', inputType: 'approval' },
    { role: 'influencer', title: 'Dodaj link do scenariusza', description: 'Wklej link do dokumentu ze scenariuszem.', inputType: 'url' },
    { role: 'klient', title: 'Zaakceptuj scenariusz', description: 'Przejrzyj scenariusz i zatwierdź lub poproś o zmiany.', inputType: 'approval' },
    { role: 'influencer', title: 'Określ rekwizyty', description: 'Wymień potrzebne rekwizyty do nagrania.', inputType: 'text' },
    { role: 'admin', title: 'Ustaw termin planu zdjęciowego', description: 'Wybierz datę planu zdjęciowego w kalendarzu (zazwyczaj 3 dni przed nagraniem).', inputType: 'boolean' },
    { role: 'admin', title: 'Nadaj priorytet', description: 'Ustaw priorytet projektu.', inputType: 'text' },
    { role: 'kierownik_planu', title: 'Potwierdź nagranie', description: 'Potwierdź, że nagranie się odbyło.', inputType: 'boolean' },
    { role: 'influencer', title: 'Dodaj uwagi przed montażem', description: 'Wpisz swoje uwagi i sugestie do montażu.', inputType: 'text' },
    { role: 'kierownik_planu', title: 'Dodaj uwagi przed montażem', description: 'Wpisz uwagi z planu zdjęciowego istotne dla montażu.', inputType: 'text' },
    { role: 'admin', title: 'Dodaj uwagi przed montażem', description: 'Wpisz uwagi admina istotne dla montażu.', inputType: 'text' },
    { role: 'admin', title: 'Wstaw link do frame.io', description: 'Wklej link do filmu na frame.io dla montażysty.', inputType: 'url' },
    { role: 'montazysta', title: 'Wgraj surówkę', description: 'Wklej link do surowego materiału.', inputType: 'url' },
    { role: 'montazysta', title: 'Wgraj zmontowany film', description: 'Wklej link do zmontowanego filmu.', inputType: 'url' },
    { role: 'klient', title: 'Weryfikuj film na frame.io', description: 'Przejrzyj zmontowany film i zaakceptuj.', inputType: 'approval' },
    { role: 'montazysta', title: 'Wgraj poprawki', description: 'Wgraj poprawiony film po uwagach klienta.', inputType: 'url' },
    { role: 'admin', title: 'Akceptacja materiału', description: 'Finalna akceptacja materiału przez admina.', inputType: 'boolean' },
    { role: 'influencer', title: 'Akceptacja materiału', description: 'Finalna akceptacja materiału przez influencera.', inputType: 'boolean' },
    { role: 'admin', title: 'Ustaw datę publikacji', description: 'Wybierz datę publikacji filmu.', inputType: 'boolean' },
  ];

  return stages.map((stage, i) => ({
    id: `${projectId}-t${i}`,
    projectId,
    order: i,
    assignedRole: stage.role,
    title: stage.title,
    description: stage.description,
    inputType: stage.inputType,
    status: i < currentStage ? 'done' as const : i === currentStage ? 'todo' as const : 'locked' as const,
    value: i < currentStage ? (stage.inputType === 'boolean' ? 'true' : stage.inputType === 'url' ? 'https://example.com/link' : stage.inputType === 'approval' ? 'approved' : 'Przykładowa wartość') : null,
    previousValue: null,
    clientFeedback: null,
    assignedAt: i === currentStage ? new Date().toISOString() : i < currentStage ? new Date(Date.now() - (currentStage - i) * 86400000).toISOString() : null,
    completedAt: i < currentStage ? new Date(Date.now() - (currentStage - i) * 86400000).toISOString() : null,
    completedBy: i < currentStage ? stage.role : null,
    deadlineDate: null,
    history: [],
  }));
}

export function getInitialTasks(): Task[] {
  return INITIAL_PROJECTS.flatMap(p => createTasksForProject(p.id, p.currentStageIndex));
}
