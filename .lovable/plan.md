# Influencer: dwie ścieżki po naniesieniu poprawek

## Problem

Gdy klient odeśle zadanie do poprawy (np. "Dodaj link do scenariusza" z `approved_with_file_notes` lub odrzuceniem), Influencer w stanie `needs_influencer_revision` ma dziś tylko **jedną** opcję: **„Poprawki wprowadzone — proszę o weryfikację"**. To zawsze cofa pętlę z powrotem do klienta na nowy cykl akceptacji.

W praktyce nie każda poprawka wymaga ponownej akceptacji klienta — czasem są to drobne, jednoznaczne uwagi, które Influencer nanosi i pipeline powinien iść dalej bez pingowania klienta.

## Rozwiązanie

W widoku `needs_influencer_revision` (TaskCard.tsx, linie ~647–660 dla scenariusza i ~679–692 dla pozostałych typów) dodajemy **drugi przycisk**:

- **Główny (jak dziś):** „Poprawki wprowadzone — proszę o weryfikację" → `resubmitTask(...)` → wraca do klienta jak teraz.
- **Wtórny (nowy):** „Poprawki naniesione — bez akceptacji klienta" → traktuje zadanie jak zaakceptowane przez klienta i pipeline przechodzi do następnego etapu **z pominięciem** kroku akceptacji.

Wtórny przycisk stylowany jako `variant="outline"` (mniej dominujący), pod głównym, z krótkim helperem: *„Użyj, gdy uwagi były drobne i klient nie musi tego ponownie zatwierdzać."*.

## Mechanika (AppContext.tsx)

Nowa akcja w kontekście: `resubmitTaskAndAutoApprove(taskId, value)`. Działa tak:

1. Znajduje task w `needs_influencer_revision`.
2. Ustawia go `status: 'done'`, `value` = nowy/aktualny URL/tekst, `completedBy: 'influencer'`, dorzuca wpis historii `{ action: 'resubmitted_auto_approved', by: 'influencer', timestamp: now }` (nowy typ akcji w `TaskHistoryEntry`).
3. Znajduje powiązany task akceptacji klienta (kolejny `order` z `inputType === 'approval'` lub `script_review` w tym samym `projectId`), jeśli istnieje i jest w `pending_client_approval` / `todo` / `locked`:
   - Ustawia go `status: 'done'`, `value: 'auto_approved'`, `completedBy: 'influencer'`, `completedAt: now`, dorzuca wpis historii `{ action: 'auto_approved_by_influencer', by: 'influencer', feedback: 'Influencer oznaczył poprawki jako niewymagające ponownej akceptacji klienta', timestamp: now }`.
4. Odblokowuje kolejny task w pipeline (taki sam mechanizm jak normalne `completeTask` na approval) — wykorzystujemy istniejącą funkcję pomocniczą do rozpropagowania `unlocked` (te same reguły co w `completeTask` po approval).

Dzięki temu w historii i w widoku admina/klienta jasno widać, że akceptacja była „auto" przez Influencera (a nie sfałszowana jako klikniętą przez klienta).

## UI dla klienta (defensywnie)

Gdy zadanie akceptacji ma `value === 'auto_approved'`, w `CompletedTaskCard` / panelu klienta wyświetlamy badge: **„Pominięto akceptację — Influencer uznał poprawki za drobne"** (kolor `muted`, nie alarmowy). To utrzymuje przejrzystość i nie wprowadza klienta w błąd, że to on kliknął.

## Webhooki

`resubmitTaskAndAutoApprove` wywołuje ten sam webhook co normalne completion — z polem `auto_approved: true` w payloadzie, żeby Make.com mógł rozróżnić oba scenariusze (zgodne z `mem://technical/webhook-readiness`).

## Pliki do edycji

- `src/types/index.ts` — dodać `'resubmitted_auto_approved' | 'auto_approved_by_influencer'` do `TaskHistoryEntry.action`; dopuścić `'auto_approved'` jako wartość `value` w taskach approval.
- `src/context/AppContext.tsx` — nowa akcja `resubmitTaskAndAutoApprove`, eksport w wartości kontekstu.
- `src/components/TaskCard.tsx` — drugi przycisk w obu gałęziach widoku `needs_influencer_revision` (scenariusz i pozostałe inputy URL/tekst/aktorzy).
- `src/components/CompletedTaskCard.tsx` — badge „Pominięto akceptację" dla `value === 'auto_approved'`.
- `mem://logic/feedback-loop` — rozszerzyć regułę o drugą ścieżkę („auto-zatwierdzenie przez Influencera").

## Czego nie zmieniamy

- Ścieżki klienta (Akceptuj / Zmień / Uwagi w pliku) — bez zmian.
- Logiki SLA, ping-ponga przy normalnym `resubmitTask` — bez zmian.
- Mechaniki multi-reviewer i `client_votes` — nie dotyczy (to jest tylko pojedyncza akceptacja po poprawkach).
