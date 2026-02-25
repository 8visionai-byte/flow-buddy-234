import { User, Project, Task } from '@/types';

export const USERS: User[] = [
  { id: 'u1', name: 'Marcin (Admin)', role: 'admin' },
  { id: 'u2', name: 'Anna (Klient)', role: 'klient' },
  { id: 'u3', name: 'Tomek (Influencer)', role: 'influencer' },
  { id: 'u4', name: 'Kuba (Montażysta)', role: 'montazysta' },
  { id: 'u5', name: 'Ola (Kierownik Planu)', role: 'kierownik_planu' },
];

export const PROJECTS: Project[] = [
  { id: 'p1', name: 'Jak często trzeba robić higienę?', clientName: 'Anna', currentStageIndex: 2 },
  { id: 'p2', name: 'Jakie słowo komuś ukradłeś?', clientName: 'Anna', currentStageIndex: 0 },
  { id: 'p3', name: '5 trików na produktywność', clientName: 'Anna', currentStageIndex: 5 },
];

function createTasksForProject(projectId: string, currentStage: number): Task[] {
  const stages: { role: Task['assignedRole']; title: string; description: string; inputType: Task['inputType'] }[] = [
    { role: 'influencer', title: 'Dodaj pomysł / temat', description: 'Wpisz temat lub pomysł na film.', inputType: 'text' },
    { role: 'klient', title: 'Zaakceptuj pomysł', description: 'Przejrzyj pomysł i zaakceptuj lub odrzuć.', inputType: 'boolean' },
    { role: 'influencer', title: 'Dodaj link do scenariusza', description: 'Wklej link do dokumentu ze scenariuszem.', inputType: 'url' },
    { role: 'klient', title: 'Zaakceptuj scenariusz', description: 'Przejrzyj scenariusz i zatwierdź.', inputType: 'boolean' },
    { role: 'kierownik_planu', title: 'Określ rekwizyty', description: 'Wymień potrzebne rekwizyty do nagrania.', inputType: 'text' },
    { role: 'kierownik_planu', title: 'Potwierdź nagranie', description: 'Potwierdź, że nagranie się odbyło.', inputType: 'boolean' },
    { role: 'influencer', title: 'Dodaj uwagi przed montażem', description: 'Wpisz swoje uwagi i sugestie do montażu.', inputType: 'text' },
    { role: 'montazysta', title: 'Wgraj surówkę', description: 'Wklej link do surowego materiału.', inputType: 'url' },
    { role: 'montazysta', title: 'Wgraj zmontowany film', description: 'Wklej link do zmontowanego filmu.', inputType: 'url' },
    { role: 'klient', title: 'Weryfikuj film na frame.io', description: 'Przejrzyj zmontowany film i zaakceptuj.', inputType: 'boolean' },
    { role: 'montazysta', title: 'Wgraj poprawki', description: 'Wgraj poprawiony film po uwagach klienta.', inputType: 'url' },
    { role: 'klient', title: 'Akceptacja materiału', description: 'Finalna akceptacja gotowego materiału.', inputType: 'boolean' },
  ];

  return stages.map((stage, i) => ({
    id: `${projectId}-t${i}`,
    projectId,
    order: i,
    assignedRole: stage.role,
    title: stage.title,
    description: stage.description,
    inputType: stage.inputType,
    status: i < currentStage ? 'done' : i === currentStage ? 'todo' : 'locked',
    value: i < currentStage ? (stage.inputType === 'boolean' ? 'true' : stage.inputType === 'url' ? 'https://example.com/link' : 'Przykładowa wartość') : null,
    completedAt: i < currentStage ? new Date(Date.now() - (currentStage - i) * 86400000).toISOString() : null,
    completedBy: i < currentStage ? stage.role : null,
  }));
}

export function getInitialTasks(): Task[] {
  return PROJECTS.flatMap(p => createTasksForProject(p.id, p.currentStageIndex));
}
