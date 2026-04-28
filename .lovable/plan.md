## Diagnoza — znalazłem przyczynę

Porównałem dane w bazie dla pomysłów widocznych na screenshotach:

| Pomysł (UI) | Projekt (DB) | Status order 5 (akcept. obsady) | Status order 6 (Określ rekwizyty) | Status order 7 (Ustaw termin — admin) |
|---|---|---|---|---|
| Pomysł 2 | `1` | done | done | **done** ✅ |
| Pomysł 3 | `2`/`3` | done | done | **done** ✅ |
| **Pomysł 4** | `Test1` | done | **todo** | **locked** ❌ |

Wniosek: w pomysłach 2 i 3 użytkownik przeszedł "klasyczną" akceptację obsady przez Klienta — `completeTask` zawiera blok `parallelMate` (linie 427–442 w `AppContext.tsx`), który **równolegle** odblokowuje `Określ rekwizyty` (Influencer) i `Ustaw termin planu zdjęciowego` (Admin). Dlatego admin od razu widzi zadanie.

W pomyśle 4 użytkownik użył ścieżki **"Poprawki naniesione, nie wymagana kolejna akceptacja klienta"** → wywołane zostało `resubmitTaskAndAutoApprove` (linie 650–725). Ta funkcja po naprawce z poprzedniego planu poprawnie auto-akceptuje `actor_approval` i odblokowuje `afterApproval` = order 6 (`Określ rekwizyty`), ale **NIE ZAWIERA logiki parallelMate** — order 7 zostaje `locked`. Stąd w widoku admina nie ma żadnego badge'a / blokera dla Pomysłu 4.

To nie jest problem badge'ów — to brakujące parallel-unlock w jednej z dwóch ścieżek odblokowywania.

## Plan naprawy

### 1. `src/context/AppContext.tsx` — `resubmitTaskAndAutoApprove` (~linia 681–720)

Po znalezieniu `afterApproval`, dodać symetryczny `parallelMate` — dokładnie jak w `completeTask`:

```ts
const parallelMate = (afterApproval?.title === 'Określ rekwizyty')
  ? projectTasks.find(t => t.title === 'Ustaw termin planu zdjęciowego' && t.status === 'locked')
  : null;
```

W `prev.map(...)` dodać branch:

```ts
if (parallelMate && t.id === parallelMate.id) {
  return { ...t, status: 'todo' as const, assignedAt: now };
}
```

To jedyna zmiana logiki. ~5 linii. Chirurgicznie kopiuje istniejący wzorzec z `completeTask` — żadnego nowego zachowania, tylko wyrównanie obu ścieżek.

### 2. Naprawa istniejących danych dla Pomysłu 4 (`Test1`)

Dane są w Supabase (nie localStorage — sprawdziłem schema). Najprostsza naprawa to migracja jednorazowa, która ustawi order 7 na `todo` dla projektów, w których order 5 = `done`, order 6 ∈ {`todo`, `done`}, a order 7 = `locked`. Bezpieczna — pasuje tylko do realnie zepsutych danych z tej dziury.

Alternatywnie, jeśli wolisz nie ruszać produkcyjnych danych migracją: po wdrożeniu fixa po prostu klikniesz na Pomyśle 4 jakiekolwiek następne zadanie zmieniające stan, ale to nie odblokuje order 7 wstecznie. **Rekomenduję migrację** dla tego jednego rekordu, bo inaczej Pomysł 4 zostanie permanentnie zawieszony.

### 3. Test po wdrożeniu

1. Stworzyć nowy pomysł, przejść do akceptacji obsady.
2. Klient: "Zmień" → Influencer poprawia → "Poprawki naniesione, nie wymagana kolejna akceptacja".
3. **Oczekiwane:** order 6 = `todo` (Influencer widzi "Określ rekwizyty"), order 7 = `todo` (Admin widzi "Ustaw termin planu zdjęciowego" w "Moje Zadania" + badge).
4. Powtórzyć ścieżkę "klasyczną" (Klient akceptuje obsadę bezpośrednio) — sprawdzić, że dalej działa bez regresji.

## Pliki

- `src/context/AppContext.tsx` — ~5 linii w `resubmitTaskAndAutoApprove`
- migracja SQL — jeden `UPDATE` dla naprawy `Test1`

## Co NIE jest w zakresie

- Brak zmian w `AdminDashboard.tsx` — predykaty `isAdminTaskActionable` / `isAdminTaskBlocking` działają poprawnie (potwierdzone na danych Pomysłów 2 i 3 — admin widzi tam blocker, bo order 7 jest `todo`).
- Brak zmian w UI / badge'ach.
