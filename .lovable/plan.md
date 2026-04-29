## Cel
Przed spotkaniem z klientem: wszystkie zmiany (pomysły, zadania, kampanie, oceny, notatki) widoczne live na różnych przeglądarkach/urządzeniach. Bez migracji danych z localStorage — startujemy świeżo z danych już istniejących w Lovable Cloud.

## Stan obecny
- Cały `AppContext.tsx` (1102 linie) trzyma stan w `useState` + zapisuje do `localStorage` (9 kluczy `yads_*`).
- Tabele w Cloud już istnieją i mają dane testowe (102 tasks, 6 projects, 8 ideas, 4 campaigns, 4 clients, 13 app_users). RLS = permissive (USING true), więc anon key wystarczy.
- Każda zakładka ma własny, izolowany stan — stąd brak synchronizacji.

## Zakres (3 kroki, bez migracji danych)

### Krok 1 — Zapisy do bazy (write-through)
W `src/context/AppContext.tsx` każda mutacja stanu, która obecnie woła `setX(...)`, dodatkowo wykona odpowiedni `supabase.from('...').upsert(...)` / `.delete()`. Dotyczy:
- `tasks` — completeTask, rejectTask, resubmitTask, updateTaskValue, saveDraftValue, deferTask, rejectFinalTask, reopenTask, setTaskDeadline, updatePartyNote, setFilmingDate
- `projects` — addProject, deleteProject, toggleFreezeProject, assignToProject, setPublicationDate, setProjectPriority, setProjectSla
- `ideas` — addIdea, updateIdea, deleteIdea, reviewIdea, acceptIdeaAsProject (z bulk-insertem nowych tasks)
- `campaigns` — addCampaign, updateCampaign, deleteCampaign (kaskada do ideas)
- `clients` — add/update/delete
- `app_users` — addUser/updateUser/deleteUser
- `recordings`, `project_notes` — add/delete

Stan lokalny aktualizujemy optymistycznie (jak teraz), a w tle leci zapis. Błędy logujemy do konsoli + toast (nie blokujemy UX podczas demo).

### Krok 2 — Odczyt z bazy przy starcie
Zamiast `loadFromStorage(...)` z fallbackiem do `INITIAL_*`, na mount `AppProvider` pobiera wszystkie tabele równolegle (`Promise.all` 8x `select('*')`). Do czasu załadowania pokazujemy krótki loader (spinner full-screen). 

Wprowadzamy mappery DB ↔ aplikacja (snake_case → camelCase), bo nasze typy w `src/types/index.ts` używają camelCase, a kolumny w bazie snake_case. Jeden plik `src/integrations/supabase/mappers.ts` z funkcjami `taskFromRow/taskToRow`, `projectFromRow/projectToRow` itd.

`localStorage` zostawiamy tylko dla `currentUser` (wybór roli/użytkownika to preferencja przeglądarki, nie współdzielony stan). Pozostałe klucze `yads_*` przestają być używane — kod ładujący je usuwamy.

### Krok 3 — Realtime między zakładkami
W `AppProvider` jeden kanał Supabase Realtime nasłuchuje `postgres_changes` (event `*`, schema `public`) na 8 tabelach. Każde zdarzenie INSERT/UPDATE/DELETE aktualizuje odpowiednią tablicę w stanie React (merge po `id`). Dzięki temu zmiana w zakładce A pojawia się w zakładce B w <1s.

Wymagane SQL (jednorazowa migracja schematu — włączenie tabel do publikacji realtime):
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ideas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recordings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_notes;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.ideas REPLICA IDENTITY FULL;
ALTER TABLE public.campaigns REPLICA IDENTITY FULL;
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.app_users REPLICA IDENTITY FULL;
ALTER TABLE public.recordings REPLICA IDENTITY FULL;
ALTER TABLE public.project_notes REPLICA IDENTITY FULL;
```

## Co się NIE zmienia
- API `useApp()` — żaden komponent nie wymaga edycji. Wszystkie funkcje (`completeTask`, `addIdea`, itd.) zachowują tę samą sygnaturę.
- Logika biznesowa (sekwencja 19 etapów, ping-pong, konsensus, SLA) — bez zmian.
- Webhooks do Make.com — bez zmian.
- Wybór użytkownika (role switcher) — nadal w localStorage tej przeglądarki.

## Uwagi techniczne
- Pola JSONB (`history`, `role_completions`, `client_votes`, `evaluations`) — Supabase serializuje automatycznie, mapper tylko przekazuje obiekt.
- Pola ARRAY (`assigned_roles`, `assigned_client_ids`, `reviewer_ids`) — natywne tablice Postgres.
- `acceptIdeaAsProject` to złożona operacja (idea→accepted, campaign update, nowy project, ~17 nowych tasks). Zrobimy ją sekwencyjnie: upsert idea → upsert campaign → insert project → bulk insert tasks. Realtime zsynchronizuje pozostałe zakładki.
- Bez migracji danych: jeśli w bazie brakuje encji, których używasz lokalnie, znikną po przeładowaniu strony. Świadoma decyzja — start od czystego stanu w Cloud.

## Po wdrożeniu — szybki test
1. Otwórz aplikację w 2 zakładkach jako różni użytkownicy.
2. W zakładce A dodaj pomysł / oceń pomysł / zatwierdź zadanie.
3. W zakładce B (bez F5) zmiana powinna pojawić się w ciągu sekundy.

Po Twojej akceptacji wykonuję wszystkie 3 kroki w jednym przebiegu (migracja SQL + refactor `AppContext.tsx` + nowy plik `mappers.ts`).
