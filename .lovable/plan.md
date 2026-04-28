# Uproszczenie decyzji klienta — 2 przyciski zamiast 3

## Problem (od klienta)
W zadaniach typu „akceptacja przypisanych osób" oraz „akceptacja materiału" są **trzy** przyciski decyzji:
1. **Zaakceptuj**
2. **Zaakceptuj z uwagami**
3. **Poproś o poprawki**

To jest za dużo i myli użytkownika. Klient prosi o **dwa** przyciski:
1. **Zaakceptuj** — pełna akceptacja, idziemy dalej
2. **Zmień** — z polem na komentarz (uwagi obowiązkowe)

Trzeba też zaktualizować opis (tooltip „i" przy tytule zadania), który dziś tłumaczy logikę trzech opcji.

## Zakres zmian

### 1. `src/components/TaskCard.tsx` — główny widok akceptacji (linie ~539-567)
Dotyczy zadań typu `approval` i `actor_approval` (m.in. „Zaakceptuj przypisanie osoby", „Akceptacja propozycji influencera", „Akceptacja materiału").

**Nowy układ przycisków:**
- **Zaakceptuj** (zielony, pełna szerokość) — wywołuje `handleApprove()` jak dziś
- **Zmień** (outline, warning, pełna szerokość) — otwiera formularz z polem tekstowym (wymagane), po wysłaniu wywołuje `rejectTask(task.id, feedbackValue)` (czyli ten sam mechanizm co dziś „Poproś o poprawki" — wraca do influencera/montażysty z prośbą o poprawki)

**Co usuwamy:**
- Środkowy przycisk „Zaakceptuj z uwagami" wraz z całym blokiem `showAcceptWithNotesForm` (stan, formularz, handler `completeTask(..., 'approved: <notes>')`)
- Stan `acceptNotes`, `setAcceptNotes`, `showAcceptWithNotesForm`, `setShowAcceptWithNotesForm`

**Etykieta formularza „Zmień":**
- Tytuł: „Opisz, co należy zmienić" (wymagane)
- CTA: „Wyślij prośbę o zmiany"
- Anuluj — wraca do widoku 2 przycisków

### 2. `src/components/TaskCard.tsx` — tooltip opisu (linie ~444-460)
Aktualny tooltip wymienia 3 opcje. Zaktualizujemy do dwóch wariantów:

**Dla `actor_approval`:**
- **Zaakceptuj** — skład aktorów zatwierdzony, produkcja idzie dalej
- **Zmień** — opisz, jakich zmian oczekujesz; influencer zaproponuje nowy skład i wróci do Ciebie po akceptację

**Dla pozostałych (script/material approval):**
- **Zaakceptuj** — materiał zatwierdzony, produkcja przechodzi do kolejnego etapu
- **Zmień** — opisz, co należy poprawić; wykonawca wprowadzi zmiany i prześle materiał ponownie do Twojej akceptacji

### 3. Pozostałe widoki — pozostawiamy bez zmian
Te miejsca już mają dwie opcje i są zgodne z intencją klienta:
- **Script review** (linie ~292-317): „Akceptuję scenariusz" / „Uwagi naniesione w pliku"
- **Frame.io review** (linie ~385-410): „Akceptuję film bez uwag" / „Uwagi dodałam/em we frame.io"

Nie zmieniamy ich — używają komentarzy w zewnętrznych narzędziach (Google Docs, frame.io), nie w aplikacji.

### 4. Logika backendu (`AppContext.tsx`, `webhook.ts`) — bez zmian
- `handleApprove` → `completeTask(..., 'approved', ...)` — bez zmian
- „Zmień" → `rejectTask(task.id, feedback)` — istniejąca ścieżka odrzucenia, która generuje zadanie poprawkowe i resetuje SLA (zgodnie z pamięcią Ping-Pong / Feedback Loop)
- Wartość `approved_with_comments` / `approved: <notes>` znika z nowych zadań typu `approval`/`actor_approval`. Stare zadania w historii pozostają wyświetlane poprawnie (CompletedTaskCard już obsługuje ten format — odczyt nie jest dotknięty).

### 5. Pamięć projektu
Zaktualizować `mem://logic/approval-consensus` (wzmianka o „Tak, ale..." / ping-pong) tak, by odzwierciedlała uproszczony model: każdy reviewer ma dwie opcje — **Zaakceptuj** lub **Zmień (z komentarzem)**. Brak pośredniego stanu „akceptuję z uwagami".

## Efekt dla użytkownika
- Klient widzi dwa wyraźne przyciski: zielony „Zaakceptuj" i pomarańczowy „Zmień"
- Po kliknięciu „Zmień" pojawia się pole na komentarz (wymagane) i przycisk „Wyślij prośbę o zmiany"
- Tooltip „i" przy tytule zadania opisuje już tylko dwie opcje, spójnie z UI
