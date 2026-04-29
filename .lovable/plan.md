## Problem

Operator obecnie musi otworzyć każdy pomysł osobno i wkleić ten sam link do surówki dla każdego z osobna (zadanie "Wgraj surówkę na serwer", `inputType: 'raw_footage'`). W praktyce jedno nagranie z planu zawiera materiał do kilku pomysłów, więc ten sam link powinien zostać przypisany do wielu zadań jednym kliknięciem — analogicznie do batchowego "Ustaw termin nagrania" w panelu Admina.

## Rozwiązanie

Rozszerzyć panel zadania "Wgraj surówkę na serwer" w `TaskCard.tsx` o sekcję wyboru, do których innych pomysłów (tasków `raw_footage` w statusie `todo`) Operator chce zastosować ten sam link, numer nagrania i notatkę. Po kliknięciu "Wgraj surówkę" wszystkie zaznaczone zadania zostają oznaczone jako wykonane z tymi samymi danymi.

### Zachowanie UI

W panelu zadania (sekcja `inputType === 'raw_footage'` w `TaskCard.tsx`, linie 816–858) pod polami "Link / Numer / Notatka" dodać blok:

```text
┌─ Zastosuj do innych pomysłów ────────────────┐
│ ☑ Aktualny pomysł (zawsze, disabled)          │
│ ☐ "Tytuł pomysłu B" — Klient X                │
│ ☐ "Tytuł pomysłu C" — Klient X                │
│ ☐ "Tytuł pomysłu D" — Klient Y                │
└───────────────────────────────────────────────┘
Wgrasz surówkę do: 3 pomysłów
[ ✈ Wgraj surówkę do 3 pomysłów ]
```

Reguły listy:
- Pokazują się wszystkie inne taski Operatora typu `raw_footage` w statusie `todo` (czyli pozycje z lewej kolumny "Do zrobienia"), niezależnie od klienta — Operator sam decyduje, co należy do tej samej sesji nagraniowej.
- Sortowanie: najpierw projekty tego samego klienta co bieżący, potem reszta. Pokazujemy tytuł pomysłu + nazwę firmy klienta dla rozróżnienia.
- Jeżeli nie ma innych zadań `raw_footage todo`, sekcja w ogóle się nie renderuje (zachowanie identyczne jak dziś).
- Bieżący task jest zawsze włączony i nie da się go odznaczyć.
- Etykieta przycisku zmienia się dynamicznie: "Wgraj surówkę" (1 pomysł) lub "Wgraj surówkę do N pomysłów".

### Logika submit

W `handleSubmit` dla `raw_footage`:
1. Zwalidować URL i numer nagrania (bez zmian).
2. Zbudować jednolity `jsonValue = { url, recordingNumber, notes }`.
3. Wywołać `completeTask(taskId, jsonValue, currentUser?.role)` dla bieżącego zadania **oraz** dla każdego zaznaczonego dodatkowego taska.
4. Każde wywołanie przechodzi przez istniejące mechanizmy `AppContext` (historia, odblokowanie kolejnego etapu „Wgraj zmontowany film" dla każdego pomysłu, webhooki) — nie dotykamy logiki sekwencji.

### Stan komponentu

Dodać w `TaskCard.tsx` nowy lokalny stan:
- `additionalTaskIds: Set<string>` — początkowo pusty.
- Wyliczana lista kandydatów: `tasks.filter(t => t.id !== task.id && t.inputType === 'raw_footage' && t.status === 'todo' && t.assignedRoles?.includes('operator'))`.

Reset stanu po wykonaniu (komponent i tak się odmontowuje, gdy task znika z listy).

## Pliki do zmiany

- `src/components/TaskCard.tsx`
  - dodać stan `additionalTaskIds`
  - rozszerzyć `handleSubmit` o pętlę `completeTask` dla zaznaczonych
  - rozszerzyć blok `raw_footage` (linie 816–858) o checklistę innych pomysłów i dynamiczną etykietę przycisku
  - użyć `useApp()` do pobrania `tasks` i `projects` (już importowane)

Brak zmian w bazie, kontekście, schemacie tasków ani w logice odblokowywania kolejnych etapów. Brak migracji.

## Edge cases

- Gdy Operator zaznaczy kilka pomysłów, ale walidacja URL/numeru zawiedzie → żaden task nie jest zapisany (walidacja przed pętlą).
- Gdy dwa zaznaczone taski należą do różnych klientów — to świadomy wybór Operatora (np. jedno nagranie dla dwóch firm), dozwolony.
- Numer nagrania jest ten sam dla wszystkich zaznaczonych pozycji — zgodne z user storym (jedno fizyczne nagranie = jeden numer).
