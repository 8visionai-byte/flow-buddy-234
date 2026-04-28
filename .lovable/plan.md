
# Naprawa błędu: auto-akceptacja przeskakuje do złego etapu

## Diagnoza (potwierdzona w kodzie)

W `src/context/AppContext.tsx` (linia 670–672) funkcja `resubmitTaskAndAutoApprove` wyszukuje kolejne zadanie akceptacji klienta tak:

```ts
const approvalTask = projectTasks.find(
  t => t.order > task.order && (t.inputType === 'approval' || t.inputType === 'script_review')
);
```

Brakuje typu **`actor_approval`** — czyli właśnie tego, który występuje po `actor_assignment` (FAZA 3 — Obsada → "Zaakceptuj przypisanie osoby").

Skutek: gdy Influencer w widoku obsady kliknął "Poprawki naniesione, nie wymagana kolejna akceptacja klienta", funkcja **pominęła** najbliższy `actor_approval` i znalazła pierwszy następny `approval` w pipeline — czyli **"Akceptacja materiału"** w FAZIE 5 — i to ją oznaczyła jako auto-zatwierdzoną. Stąd na zrzucie:
- ✅ "Przypisz osobę do filmu" (Influencer) — zrobione
- 🔒 "Zaakceptuj przypisanie osoby" (Klient) — **wciąż locked, nigdy nie odblokowane**
- … cała FAZA 4 i 5 zablokowana …
- ✅ "Akceptacja materiału" (Klient, 28.04.2026 17:56) — **niepoprawnie auto-ukończone**

W projekcie istnieje już helper (linia 244) `isApprovalType` obejmujący `actor_approval` — `resubmitTaskAndAutoApprove` po prostu go nie używa.

## Plan naprawy

### 1. Naprawa logiki (`src/context/AppContext.tsx`)

W `resubmitTaskAndAutoApprove` (linia ~670) zmienić warunek wyszukiwania `approvalTask` tak, żeby obejmował `actor_approval`:

```ts
const approvalTask = projectTasks.find(
  t => t.order > task.order &&
       (t.inputType === 'approval' || t.inputType === 'script_review' || t.inputType === 'actor_approval')
);
```

Dodatkowo dla bezpieczeństwa: ograniczyć wyszukiwanie do **bezpośrednio następnego** zadania (`t.order === task.order + 1`), zamiast pierwszego `approval` w całym pipeline. Nawet gdyby ktoś w przyszłości dodał kolejny typ — nie odpalimy auto-akceptacji w odległym etapie. Jeśli następny task nie jest typem akceptacji, funkcja po prostu nie odblokuje niczego "na zapas" i wymusi ponowne sprawdzenie scenariusza.

```ts
const next = projectTasks.find(t => t.order === task.order + 1);
const approvalTask = next && (next.inputType === 'approval'
  || next.inputType === 'script_review'
  || next.inputType === 'actor_approval') ? next : null;
```

To jest chirurgiczna zmiana — nie dotyka żadnego innego flow.

### 2. Naprawa danych istniejącego pomysłu "Pomysł drugi"

Dane są w localStorage (mock data), więc skrypt SQL nie zadziała. Trzeba dać użytkownikowi prosty mechanizm do "cofnięcia" tego konkretnego stanu. Dwie opcje — proszę wybrać:

**A. Ręczny revert przez chat history** (zero kodu, zero ryzyka):
   - Cofnąć projekt do wersji sprzed błędnego "Poprawki naniesione…" (revert w chat).
   - Po revercie wgrać samą poprawkę logiki z punktu 1.
   - Wszystkie inne pomysły zachowają się.

**B. Skrypt naprawczy w UI** (jednorazowy "Reset etapu" w widoku Admina):
   - Admin Override już istnieje w panelu zadań — dodać akcję "Cofnij auto-akceptację" na zadaniu z `value === 'auto_approved'`, która:
     - resetuje to zadanie do `locked`,
     - resetuje wcześniejsze zadanie z `inputType === 'actor_assignment'` do `pending_client_approval` (żeby Klient mógł zaakceptować obsadę),
     - czyści wpisy `resubmitted_auto_approved` / `auto_approved_by_influencer` z historii.

Rekomenduję **opcję A** — szybciej, bezpieczniej, bez nowego kodu na produkcji.

### 3. Test po wdrożeniu (manualny)

Na nowym pomyśle przejść:
1. Influencer: "Przypisz osobę do filmu" → wprowadzić obsadę.
2. Klient: kliknąć "Zmień" w "Zaakceptuj przypisanie osoby".
3. Influencer: poprawić obsadę i potwierdzić.
4. **Oczekiwane:** "Zaakceptuj przypisanie osoby" → `Ukończono` (auto_approved). Następny etap (FAZA 4 — "Określ rekwizyty") → `todo` dla Influencera.
5. Reszta pipeline (Akceptacja materiału w FAZIE 5) — pozostaje `locked`.

Powtórzyć analogicznie dla scenariusza (`script_review`) — żeby potwierdzić, że ta ścieżka nadal działa bez regresji.

## Pliki

- `src/context/AppContext.tsx` — jedna funkcja, ~5 linii zmiany.

## Co NIE jest w zakresie

- Brak zmian w `TaskCard.tsx` — UI już wywołuje poprawną funkcję.
- Brak zmian w pamięci — istniejący wpis `mem://features/actor-assignment` opisuje poprawne zachowanie; to był bug implementacyjny, nie zmiana scenariusza.
