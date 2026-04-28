# Pomysły utykają, gdy nie ma oceniającego

## Diagnoza

Pomysł utknął, bo kampania miała `assignedClientUserId = null`. W tym stanie:

- **Klient nie widzi pomysłów** — w `UserDashboard.tsx:181` filtr `c.assignedClientUserId !== currentUser.id` odrzuca kampanię dla każdego użytkownika klienta.
- **Admin też nic nie widzi** — w panelu admina nie ma żadnej zakładki/sekcji „pomysły do oceny przeze mnie", mimo że opcja `— Ocenia admin —` istnieje w selectach.
- Auto-przypisanie w `AddCampaignDialog` działa tylko gdy klient ma **dokładnie jedną** osobę kontaktową (linia 131). Gdy jest 2+ kontaktów i admin nie wybierze ręcznie → zapisuje się `null`.

Z założenia (Twoje słowa) oceniającym powinna być **osoba przypisana do kontaktu** ze strony klienta — czyli osoba oznaczona jako primary contact (mamy taką flagę zgodnie z memory `client-user-unification`).

## Zakres zmian

### 1. Domyślny oceniający = primary contact klienta
Plik: `src/components/AddCampaignDialog.tsx` (linie ~126–132).

Zmiana logiki `autoSelectedClientUser`:
- jeśli wśród `clientUsers` jest osoba z flagą primary contact → wybierz ją,
- w przeciwnym razie, jeśli jest dokładnie jedna osoba → wybierz ją (obecne zachowanie),
- w przeciwnym razie → bez auto-wyboru (admin musi świadomie wybrać).

Dodatkowo: walidacja `isValid` — jeśli admin świadomie nie zaznaczył „Ocenia admin" i nie wybrał nikogo z listy, blokujemy „Utwórz" i pokazujemy hint pod selectem („Wybierz osobę oceniającą lub wybierz «Ocenia admin»"). Cel: nie da się zapisać kampanii w stanie „nikt nie ocenia, bez świadomej decyzji".

### 2. Backfill istniejących kampanii
Plik: `src/context/AppContext.tsx`.

W momencie ładowania kampanii (lub przy pierwszym renderze) — dla kampanii ze statusem `awaiting_ideas`/`in_review` i `assignedClientUserId === null`, jeśli istnieje primary contact klienta, ustawiamy go jako oceniającego (jednorazowy soft-fix). Dzięki temu Twój utknięty pomysł rozwiąże się sam po wejściu, bez konieczności ręcznego klikania.

### 3. Widok admina: „Pomysły do oceny"
Plik: `src/components/AdminDashboard.tsx`.

W zakładce **Moje Zadania** (i na badge'u zakładki) admin powinien widzieć również pomysły, dla których jest oceniającym — czyli te, gdzie `campaign.assignedClientUserId === null` **oraz** `idea.status === 'pending'`. Dodajemy:
- sekcję „Pomysły do oceny" w „Moje Zadania" admina, listującą każdy pending idea + kampanię + przyciski „Akceptuj / Tak, ale… / Odrzuć / Zachowaj na później" (te same akcje co u klienta, wywołujące `reviewIdea(..., currentUser.id)`),
- licznik tych pomysłów dolicza się do badge'a „Moje Zadania" admina (spójne z regułą `unified-badges`).

### 4. Komunikat „nie ma oceniającego" (defensywny UX)
Plik: `src/components/AdminDashboard.tsx` (lista kampanii, linia ~1492).

Gdy `assignedClientUserId === null` i są pending pomysły → przy nazwie kampanii mała czerwona plakietka „Brak oceniającego — ustaw" (klikalna, otwiera istniejący select). Żeby na przyszłość admin od razu widział anomalię.

## Czego nie zmieniamy

- Mechaniki głosowania klienta (`client_votes`, multi-reviewer) — zostają bez zmian.
- Webhooków — `reviewIdea` już dziś przekazuje aktora, więc działa poprawnie też dla admina jako oceniającego.
- Filtra widoczności klienta (`c.assignedClientUserId !== currentUser.id`) — nadal poprawny, bo backfill + walidacja zapewnią, że dla kampanii „klient ocenia" zawsze jest ID.

## Pamięć
Dopisać memory `mem://logic/idea-reviewer-defaults`: domyślnym oceniającym pomysły jest primary contact klienta; jeśli admin świadomie wybrał „Ocenia admin", pomysły pojawiają się w jego „Moje Zadania" jako sekcja „Pomysły do oceny". Brak oceniającego = blokada zapisu kampanii i czerwona plakietka na istniejących kampaniach.

## Pliki do edycji
- `src/components/AddCampaignDialog.tsx` (auto-wybór primary + walidacja)
- `src/context/AppContext.tsx` (backfill kampanii bez oceniającego)
- `src/components/AdminDashboard.tsx` (sekcja „Pomysły do oceny" w Moich Zadaniach + badge + plakietka „Brak oceniającego")
- `mem://logic/idea-reviewer-defaults` (+ wpis w `mem://index.md`)
