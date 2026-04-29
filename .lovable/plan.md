## Cel

W zadaniu "Wnieś uwagi przed montażem" (multi-party notes — KP, DZ, Klient) ma się dodatkowo pojawiać **notatka od operatora** wpisana w polu „Notatka / opis surówki" przy zadaniu „Wgraj surówkę na serwer". Operator nie jest stroną piszącą w tym zadaniu — jego uwaga ma być widoczna jako informacja zaciągnięta z poprzedniego kroku tej samej fazy.

Dziś tę notatkę widzą tylko Admin, Montażysta i historia projektu. Influencer (który robi „Brief dla montażysty") oraz pozostałe strony przy panelu nie mają jej pod ręką.

## Zakres zmian

### 1) `src/components/MultiPartyNotesPanel.tsx`

- Dodać opcjonalny prop `operatorNote?: { url?: string; notes?: string; uploadedBy?: string }`.
- Jeśli `operatorNote.notes` (lub url) istnieje, wyświetlić nową, wyróżnioną kartkę nad sekcją „Uwagi od zespołu":
  - Etykieta: „Uwaga od operatora (surówka)" + ikona 🎥 / `Film`.
  - Pokazać tekst notatki (`whitespace-pre-wrap`) i — jeśli jest — link do surówki jako mały link „Otwórz surówkę".
  - Read-only, lekko inny kolor tła (np. `bg-muted/40 border-muted`) żeby nie mylić z notatkami stron.
- Nie zmieniać logiki zapisu — operator nie wpisuje tu nic, jego uwaga przychodzi z innego zadania.

### 2) Helper do pobierania notatki operatora

W każdym z trzech miejsc, gdzie używany jest `MultiPartyNotesPanel`, znajdujemy zadanie operatora dla tego samego `projectId`:

```ts
const rawTask = tasks.find(
  t => t.projectId === task.projectId &&
       t.inputType === 'raw_footage' &&
       t.status === 'done'
);
let operatorNote;
try {
  if (rawTask?.value) {
    const parsed = JSON.parse(rawTask.value);
    if (parsed?.notes || parsed?.url) operatorNote = parsed;
  }
} catch {}
```

Przekazać `operatorNote` do `<MultiPartyNotesPanel ... operatorNote={operatorNote} />`.

### 3) Miejsca wywołań do zaktualizowania

- `src/components/TaskCard.tsx` (linia ~829) — panel widoczny dla KP/DZ/Klient, gdy otwierają zadanie.
- `src/components/UserDashboard.tsx` (linia ~411) — sekcja read-only przy zadaniu Montażysty „Wgraj zmontowany film".
- `src/components/UserDashboard.tsx` (linia ~1209) — live panel u Influencera.

W każdym miejscu mamy już dostęp do tablicy `tasks` z kontekstu, więc wyszukanie zadania `raw_footage` jest trywialne.

### 4) `src/components/CompletedTaskCard.tsx` (opcjonalnie)

Sekcja podsumowująca „Uwagi przed montażem" (linia ~323) — dla spójności dorzucić tę samą uwagę operatora jako pierwszy wpis (read-only), również wyciągając ją z zadania `raw_footage` tego projektu.

## Czego NIE robimy

- Nie dodajemy operatora do `assignedRoles` zadania „Wnieś uwagi przed montażem" — nie jest on uczestnikiem konsensusu i nie blokuje przejścia kroku.
- Nie tworzymy nowego pola w bazie — używamy istniejącej notatki z `raw_footage.value` (klucz `notes`).
- Nie ruszamy webhooków, historii, kolejności pipeline'u.

## Efekt dla użytkownika

- Influencer pisząc „Brief dla montażysty" widzi w jednym panelu: uwagę operatora z planu + uwagi KP/DZ/Klienta.
- KP/DZ/Klient otwierając zadanie „Wnieś uwagi przed montażem" od razu widzą, co operator zanotował przy wgrywaniu surówki.
- Montażysta w swoim widoku też ma tę uwagę pod ręką (już dziś widzi ją osobno, teraz będzie spójnie w panelu).
