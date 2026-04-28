# Personalizacja: nazwa firmy zamiast "Klient"

## Cel
Gdy zalogowany użytkownik ma rolę `klient`, w jego UI nie pokazujemy generycznego słowa „Klient", tylko nazwę jego firmy (`Client.companyName`, dostępna przez `user.clientId`). Reszta widoków (Admin, Influencer, Montażysta, historia, ślady audytu) zostaje bez zmian — tam „Klient" jest opisem roli innej osoby i ma sens.

## Zakres zmian

### 1. Helper roli (centralnie)
W `src/types/index.ts` dodać czystą funkcję pomocniczą:

```ts
export const getRoleDisplayLabel = (
  user: { role: UserRole; clientId?: string | null },
  clients: { id: string; companyName: string }[]
): string
```

Zwraca `companyName` gdy `user.role === 'klient'` i znaleziono firmę; w przeciwnym razie `ROLE_LABELS[user.role]`. Dzięki temu nie duplikujemy logiki.

### 2. Header użytkownika — `src/components/UserDashboard.tsx` (linia ~764)
Zamiast `{ROLE_LABELS[currentUser.role]}` użyć `getRoleDisplayLabel(currentUser, clients)`. To jest miejsce widoczne na zrzucie ekranu („Anna Kowalska / Klient" → „Anna Kowalska / Nazwa Firmy Sp. z o.o.").

### 3. RoleSelector — `src/components/RoleSelector.tsx`
Nagłówek grupy „Klient" (linia 72, `group[0].label`) — gdy grupa to klienci, zamiast jednego nagłówka „Klient" pogrupować przyciski klientów per firma (po `user.clientId`) i jako nagłówek wyświetlać nazwę firmy. Jeśli klient nie ma przypisanej firmy → fallback do „Klient".

### 4. Widoki własnych zadań/pomysłów klienta
Sprawdzić i podmienić ewentualne sformułowania typu „Jako Klient…", „Twoja rola: Klient" w:
- `src/components/UserDashboard.tsx` (sekcja powitalna i puste stany dla `currentUser.role === 'klient'`),
- `src/components/IdeasPanel.tsx` i `src/components/CompletedTaskCard.tsx` — ale **tylko** komunikaty skierowane do samego klienta („Czekasz aż Klient…"). W audycie historii (`history.by`, badge'e ról) zostawiamy `ROLE_LABELS` bez zmian — to opis kto wykonał akcję, nie personalizacja.

### 5. Czego NIE zmieniamy
- Wszystkie widoki Admina/Influencera/Montażysty/Kierownika — tam „Klient" oznacza inną stronę procesu i musi pozostać jako rola.
- Webhooki (`src/lib/webhook.ts`) — `role_label` to dane techniczne dla Make.com.
- Historia akcji, `roleCompletions`, badge'e ról w timeline — opisują rolę aktora, nie tożsamość zalogowanego.
- Ogólne komunikaty systemowe widoczne dla innych ról („Klient ocenia film…", „Klient zaakceptował pomysł…") — to opis czyjejś akcji, nie personalizacja siebie.

## Pamięć
Dopisać memory `mem://logic/client-personalization`: w widokach własnych klienta etykieta roli renderowana jest jako `companyName`; w widokach innych ról oraz w historii zostaje „Klient".

## Pliki do edycji
- `src/types/index.ts` (helper)
- `src/components/UserDashboard.tsx` (header + komunikaty do siebie)
- `src/components/RoleSelector.tsx` (nagłówki grup klientów per firma)
- `src/components/IdeasPanel.tsx`, `src/components/CompletedTaskCard.tsx` — przejrzeć i podmienić tylko komunikaty „do mnie jako klienta"
- `mem://logic/client-personalization` (nowy plik + wpis w `mem://index.md`)
