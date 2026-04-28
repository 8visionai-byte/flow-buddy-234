# Korekta przypisania osób przez influencera (przed akceptacją klienta)

## Problem
Influencer wysłał zadanie „Przypisz osobę do filmu" z błędną obsadą (np. dał tylko Annę Kowalską, a miała być Dorota zamiast Janusza). Klient jeszcze nie zaakceptował, ale w zakładce „Wykonane" influencer widzi tylko podgląd przesłanej treści — bez żadnej opcji korekty. Nie ma jak naprawić pomyłki, dopóki klient nie kliknie „Zmień", a to wprowadza niepotrzebną pętlę i hałas w historii.

## Rozwiązanie
Dodać tę samą mechanikę „Popraw", która już działa dla URL-i (przycisk **„Popraw link"** widoczny w `CompletedTaskCard` dla influencera). Analogicznie pojawi się **„Popraw obsadę"** dla zadań typu `actor_assignment`, ale tylko dopóki klient ma jeszcze decyzję przed sobą.

### Warunki dostępności (kiedy widać „Popraw obsadę")
1. `task.inputType === 'actor_assignment'`
2. `task.status === 'done'`
3. `currentUser.role === 'influencer'` i task ma w `assignedRoles` rolę `influencer`
4. **Bramka bezpieczeństwa:** powiązane zadanie akceptacji u klienta (`actor_approval` w tym samym `projectId`, najnowsze) ma `status === 'pending_client_approval'` — czyli klient jeszcze nie kliknął „Zaakceptuj" ani „Zmień". Po decyzji klienta przycisk znika i korekta odbywa się normalną ścieżką ping-pong (zadanie wraca do influencera ze statusem `needs_influencer_revision`, gdzie edycja obsady już istnieje).

### UI
Po wejściu w ukończony task „Przypisz osobę do filmu":
- W ramce „Przesłana treść" obok listy aktorów pojawia się mały przycisk **„Popraw obsadę"** (ikonka ołówka), spójny stylistycznie z istniejącym „Popraw link".
- Klik otwiera ten sam komponent `ActorAssignmentInput` (z `initialActors` wczytanymi z aktualnej wartości), z dwoma akcjami: **„Zapisz"** (potwierdza nową obsadę) i **„Anuluj"** (powrót do podglądu, bez zmian).
- Po zapisaniu: aktualizujemy `task.value` nową listą `ActorEntry[]` i równolegle aktualizujemy `previousValue` w powiązanym zadaniu akceptacji klienta, żeby klient widział poprawioną obsadę bez przeładowania kontekstu.
- Komunikat toast: „Obsada poprawiona. Klient zobaczy zaktualizowaną propozycję."

### Wpis do historii
Akcja zapisuje wpis w `task.history` typu `resubmitted` z opisem „Influencer skorygował obsadę przed decyzją klienta" — zgodnie z zasadą memory: historię tworzymy tylko przy świadomych akcjach użytkownika. SLA klienta nie jest resetowane (to nie jest pełen ping-pong, klient po prostu otrzymuje świeższą wersję tej samej propozycji).

## Zakres zmian (technicznie)

### `src/components/CompletedTaskCard.tsx`
- Dodać stan: `editingActors: boolean`.
- Dodać kalkulację `canEditActors` analogicznie do `canEditUrl`, dodatkowo sprawdzającą czy istnieje powiązany task `actor_approval` w `pending_client_approval` (przez `tasks` z kontekstu — już destrukturyzowane).
- W bloku renderującym aktorów (linie ~370-392) — gdy `canEditActors && !editingActors`, pokazać przycisk „Popraw obsadę" w nagłówku ramki (analogicznie jak `canEditUrl`).
- Gdy `editingActors`, w miejscu listy aktorów wyrenderować `<ActorAssignmentInput initialActors={...} client={...} clientUsers={...} onSubmit={...} />` z handlerem zapisu i przyciskiem „Anuluj".

### `src/context/AppContext.tsx`
- Dodać metodę `updateActorAssignment(taskId, newActorsJson)` (lub rozszerzyć semantycznie istniejące `updateTaskValue` o synchronizację `previousValue` powiązanego zadania `actor_approval`). Preferowane: nowa metoda dla jasności intencji.
- Implementacja:
  1. Znajdź target task; sprawdź warunki (influencer, done, actor_assignment).
  2. Znajdź powiązane zadanie `actor_approval` (`projectId === target.projectId && inputType === 'actor_approval' && status === 'pending_client_approval'`); jeśli brak — przerwij (edycja niedozwolona).
  3. Zaktualizuj `target.value` na nową JSON-listę aktorów.
  4. Zaktualizuj `approval.previousValue` na tę samą nową listę.
  5. Dopisz wpis do `target.history`: `{ action: 'resubmitted', value: nowa lista, role: 'influencer', timestamp: now }`.
  6. Zapisz w localStorage; webhook (jeśli aktywny) — wysyła notyfikację o korekcie do klienta (zgodnie z istniejącym wzorcem `webhook.ts`).

### Pamięć projektu
Zaktualizować `mem://features/task-archiving` lub utworzyć nowy wpis `mem://features/inflight-correction` opisujący zasadę: „Influencer może poprawić swoją odpowiedź (URL lub obsada) dopóki kolejny aktor nie podjął decyzji. Po decyzji obowiązuje pełna ścieżka ping-pong."

## Efekt dla użytkownika
W zakładce „Wykonane" → „Przypisz osobę do filmu", obok listy aktorów, pojawia się przycisk **„Popraw obsadę"**. Klik otwiera edytor z aktualną obsadą, gdzie influencer może dodać Dorotę i usunąć Janusza. Po zapisaniu klient (Anna Kowalska) zobaczy już poprawioną propozycję — bez sztucznego cyklu „Zmień → Popraw → Wyślij ponownie".
