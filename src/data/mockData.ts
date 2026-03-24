import { User, Project, Task, UserRole, Client, Campaign, Idea } from '@/types';

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'c1',
    companyName: 'Dental Care Sp. z o.o.',
    contactName: 'Anna Kowalska',
    email: 'anna@dentalcare.pl',
    phone: '+48 600 100 200',
    notes: '',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
];

export const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Marcin (Admin)', role: 'admin' },
  { id: 'u2', name: 'Anna (Klient)', role: 'klient', clientId: 'c1' },
  { id: 'u3', name: 'Tomek (Influencer)', role: 'influencer' },
  { id: 'u4', name: 'Kuba (Montażysta)', role: 'montazysta' },
  { id: 'u5', name: 'Ola (Kierownik Planu)', role: 'kierownik_planu' },
  { id: 'u6', name: 'Paweł (Operator)', role: 'operator' },
  { id: 'u7', name: 'Zofia (Publikator)', role: 'publikator' },
];

export const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp1',
    clientId: 'c1',
    assignedInfluencerId: 'u3',
    assignedClientUserId: 'u2',
    targetIdeaCount: 12,
    status: 'awaiting_ideas',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
    slaHours: 48,
    briefNotes: 'Chcemy serię filmów o higienie jamy ustnej. Pomysły powinny być ciekawe i angażujące dla pacjentów kliniki stomatologicznej.',
  },
];

export const INITIAL_IDEAS: Idea[] = [
  {
    id: 'idea1',
    campaignId: 'camp1',
    resultingProjectId: null,
    title: 'Ile razy dziennie myć zęby?',
    description: 'Film edukacyjny pokazujący prawidłową technikę mycia zębów i dlaczego 2x dziennie to absolutne minimum. Skupiamy się na ciekawostkach, które zaskakują pacjentów.',
    createdByUserId: 'u3',
    createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
    status: 'pending',
    clientNotes: null,
    reviewedAt: null,
    reviewedByUserId: null,
  },
  {
    id: 'idea2',
    campaignId: 'camp1',
    resultingProjectId: null,
    title: 'Elektryczna vs szczoteczka ręczna — co wybrać?',
    description: 'Porównanie skuteczności obu metod poparte badaniami. Pokazujemy konkretne przypadki pacjentów i opinie dentysty.',
    createdByUserId: 'u3',
    createdAt: new Date(Date.now() - 75 * 60000).toISOString(),
    status: 'pending',
    clientNotes: null,
    reviewedAt: null,
    reviewedByUserId: null,
  },
  {
    id: 'idea3',
    campaignId: 'camp1',
    resultingProjectId: null,
    title: '5 produktów, które niszczą Twoje zęby bez wiedzy',
    description: 'Zaskakujące produkty codziennego użytku, o których szkodliwości mało kto wie — sok pomarańczowy, gumy do żucia, napoje energetyczne.',
    createdByUserId: 'u3',
    createdAt: new Date(Date.now() - 60 * 60000).toISOString(),
    status: 'pending',
    clientNotes: null,
    reviewedAt: null,
    reviewedByUserId: null,
  },
];

export const INITIAL_PROJECTS: Project[] = [
  { id: 'p1', name: 'Jak często trzeba robić higienę?', clientId: 'c1', clientName: 'Anna', company: 'Dental Care Sp. z o.o.', clientEmail: 'anna@dentalcare.pl', clientPhone: '+48 600 100 200', currentStageIndex: 0, status: 'active', assignedInfluencerId: 'u3', assignedEditorId: 'u4', assignedClientId: 'u2', assignedKierownikId: 'u5', assignedOperatorId: 'u6', publicationDate: null, priority: 'medium', slaHours: 48 },
  { id: 'p2', name: 'Jakie słowo komuś ukradłeś?', clientId: 'c1', clientName: 'Anna', company: 'Dental Care Sp. z o.o.', clientEmail: 'anna@dentalcare.pl', clientPhone: '+48 600 100 200', currentStageIndex: 0, status: 'active', assignedInfluencerId: null, assignedEditorId: null, assignedClientId: null, assignedKierownikId: null, assignedOperatorId: null, publicationDate: null, priority: 'medium', slaHours: 48 },
  { id: 'p3', name: '5 trików na produktywność', clientId: 'c1', clientName: 'Anna', company: 'Dental Care Sp. z o.o.', clientEmail: 'anna@dentalcare.pl', clientPhone: '+48 600 100 200', currentStageIndex: 0, status: 'active', assignedInfluencerId: null, assignedEditorId: null, assignedClientId: null, assignedKierownikId: null, assignedOperatorId: null, publicationDate: null, priority: 'medium', slaHours: 48 },
];

interface StageDefinition {
  roles: UserRole[];
  title: string;
  description: string;
  inputType: Task['inputType'];
}

export const PIPELINE_STAGES: StageDefinition[] = [
  // ── Faza 1: Pomysł (pre-done gdy idea zaakceptowana z kampanii) ──────────────
  { roles: ['influencer'], title: 'Dodaj pomysł / temat', description: 'Wpisz temat lub pomysł na film.', inputType: 'text' },
  { roles: ['klient'], title: 'Zaakceptuj pomysł', description: 'Przejrzyj pomysł influencera i zaakceptuj lub poproś o zmiany.', inputType: 'approval' },
  // ── Faza 2: Scenariusz (pierwsza aktywna faza po akceptacji idei) ────────────
  { roles: ['influencer'], title: 'Dodaj link do scenariusza', description: 'Wklej link do dokumentu ze scenariuszem (Google Docs, Notion itp.).', inputType: 'url' },
  { roles: ['klient'], title: 'Zaakceptuj scenariusz', description: 'Otwórz link do scenariusza, nanieś uwagi bezpośrednio w pliku (Google Docs itp.), a następnie zaznacz decyzję tutaj.', inputType: 'script_review' },
  // ── Faza 3: Obsada (DOPIERO po akceptacji scenariusza) ──────────────────────
  { roles: ['influencer'], title: 'Przypisz osobę do filmu', description: 'Wybierz klienta lub dodaj inną osobę, która wystąpi w filmie.', inputType: 'actor_assignment' },
  { roles: ['klient'], title: 'Zaakceptuj przypisanie osoby', description: 'Przejrzyj przypisaną osobę do filmu i zaakceptuj lub poproś o zmiany.', inputType: 'approval' },
  // ── Faza 4: Przygotowanie do nagrania ───────────────────────────────────────
  { roles: ['influencer'], title: 'Określ rekwizyty', description: 'Wymień potrzebne rekwizyty do nagrania.', inputType: 'text' },
  { roles: ['admin'], title: 'Ustaw termin planu zdjęciowego', description: 'Wybierz datę planu zdjęciowego w kalendarzu.', inputType: 'boolean' },
  { roles: ['kierownik_planu'], title: 'Potwierdź nagranie', description: 'Potwierdź, że sesja zdjęciowa się odbyła. Podaj numer nagrania i opcjonalną notatkę.', inputType: 'filming_confirmation' },
  { roles: ['operator'], title: 'Wgraj surówkę na serwer', description: 'Wgraj surowe nagranie na serwer, dodaj link do podglądu i podaj numer nagrania.', inputType: 'raw_footage' },
  { roles: ['kierownik_planu', 'admin', 'klient'], title: 'Wnieś uwagi przed montażem', description: 'Kierownik Planu, DZ i Klient wpisują swoje uwagi przed przekazaniem materiału do montażu.', inputType: 'multi_party_notes' },
  { roles: ['influencer'], title: 'Brief dla montażysty', description: 'Na podstawie zebranych uwag przygotuj finalny brief dla montażysty.', inputType: 'text' },
  // ── Faza 5: Montaż ──────────────────────────────────────────────────────────
  { roles: ['admin'], title: 'Nadaj priorytet montażu', description: 'Ustaw priorytet tego projektu w kolejce montażu i przypisz montażystę.', inputType: 'text' },
  { roles: ['montazysta'], title: 'Wgraj zmontowany film', description: 'Zmontuj materiał, wgraj na frame.io i wklej link. Klient zobaczy ten link do recenzji.', inputType: 'url' },
  { roles: ['klient'], title: 'Weryfikuj film na frame.io', description: 'Otwórz film we frame.io, dodaj komentarze bezpośrednio tam, a następnie zaznacz wynik tutaj.', inputType: 'frameio_review' },
  { roles: ['montazysta'], title: 'Wgraj poprawki', description: 'Wprowadź poprawki wg komentarzy we frame.io i wklej nowy link.', inputType: 'url' },
  { roles: ['klient'], title: 'Akceptacja materiału', description: 'Finalna akceptacja materiału przez klienta.', inputType: 'approval' },
  { roles: ['influencer'], title: 'Opisy i tytuły do publikacji', description: 'Uzupełnij opis na Facebooka, Twittera, Instagrama oraz tytuł na YouTube.', inputType: 'social_descriptions' },
  { roles: ['admin'], title: 'Ustaw datę publikacji', description: 'Ustaw daty publikacji dla każdej platformy (FB, Twitter, IG, YT).', inputType: 'social_dates' },
  { roles: ['publikator'], title: 'Opublikuj materiał', description: 'Opublikuj film i opisy na wszystkich platformach zgodnie z harmonogramem i potwierdź publikację.', inputType: 'publication_confirm' },
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
    value: i < currentStage ? (stage.inputType === 'boolean' ? 'true' : stage.inputType === 'url' ? 'https://example.com/link' : stage.inputType === 'approval' ? 'approved' : stage.inputType === 'social_descriptions' ? '{"facebook":"Opis FB","twitter":"Tweet","instagram":"Opis IG","youtube":"Tytuł YT"}' : stage.inputType === 'actor_assignment' ? '{"type":"client","name":"Anna"}' : stage.inputType === 'filming_confirmation' ? '{"recordingNumber":"001","notes":"Nagranie zakończone"}' : stage.inputType === 'raw_footage' ? '{"url":"https://example.com/surowa","recordingNumber":"001","notes":""}' : 'Przykładowa wartość') : null,
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
