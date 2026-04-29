## Przyczyna

W `src/components/AdminDashboard.tsx` mamy DWA niezależne UI ustawiania terminu nagrania:

1. **Popover na kafelku pomysłu** (linie 1185–1238) — przycisk „Ustaw termin nagrania!" / „Warto zaplanować termin nagrania". Po wyborze daty wywołuje TYLKO `setFilmingDate(project.id, date.toISOString())` i zamyka się. Brak kroku przypisania zespołu.
2. **Popover w panelu zadań admina** (linie 1852–1997) — pełny 2-krokowy flow: data → wybór KP/Operator + checklista pomysłów w sesji → „Zatwierdź termin", który równocześnie wywołuje `assignToProject(..., 'assignedKierownikId', ...)`, `assignToProject(..., 'assignedOperatorId', ...)` oraz `setFilmingDate(...)`.

Użytkownik kliknął czerwony, pulsujący przycisk na kafelku — pierwszy przepływ. Stąd po ustawieniu daty trzeba ręcznie wracać po Kierownika i Operatora.

## Rozwiązanie

Zastąpić uproszczony popover z kafelka (linie 1182–1240) tym samym 2-krokowym flow (data → KP/Operator → Zatwierdź), który jest już w panelu zadań admina (1852–1997). Wyodrębnić ten flow do jednego współdzielonego komponentu, żeby uniknąć duplikacji.

### Konkretne zmiany w `src/components/AdminDashboard.tsx`

1. Wyodrębnić wewnętrzny komponent `FilmingDatePopover` (lub inline render-helper) zawierający:
   - Krok 1: kalendarz wyboru daty (z blokadą dat przeszłych).
   - Krok 2: pola Select „Kierownik Planu" i „Operator" pre-wypełnione obecnymi przypisaniami projektu, opcjonalna checklista innych pomysłów tego samego klienta z otwartym zadaniem „Ustaw termin planu zdjęciowego" (jak dziś w panelu zadań), przycisk „Zatwierdź termin" wykonujący równocześnie `assignToProject` (KP, Operator) + `setFilmingDate` dla wszystkich zaznaczonych pomysłów.
   - Opcja „Wyczyść — do ustalenia" gdy data już ustawiona (zachowanie z obecnego popovera kafelka).

2. Użyć tego komponentu w obu miejscach:
   - Kafelek pomysłu (linie 1185–1238) — zamiast obecnego prostego kalendarza.
   - Panel zadań admina (linie 1852–1997) — refaktor, żeby usunąć duplikację.

3. Stan `filmingSetup` (już istniejący) wykorzystać wspólnie. Klucz pozostaje per-task (`ftId`); dla wywołania z kafelka, gdzie nie ma `ftId`, użyć `project.id` jako klucza.

### Efekt

- Klik „Ustaw termin nagrania!" na kafelku → kalendarz → po wyborze daty od razu pokazują się pola KP + Operator (pre-wypełnione obecnymi wartościami) i checklista innych pomysłów klienta z tym samym otwartym zadaniem → „Zatwierdź termin" zapisuje wszystko jednym kliknięciem.
- Brak konieczności ręcznego dosztywania KP/Operatora po ustawieniu daty.
- Spójność z panelem zadań admina (ten sam UX w obu miejscach).

## Weryfikacja

1. Pomysł 4 z aktywnym zadaniem „Ustaw termin planu zdjęciowego" → klik czerwonego przycisku na kafelku → wybór daty → pojawiają się pola KP/Operator → „Zatwierdź" → na karcie pomysłu od razu widać przypisanych KP i Operatora oraz datę nagrania.
2. Zmiana już ustawionej daty → ten sam flow, pre-wypełnione pola.
3. „Wyczyść — do ustalenia" działa jak dotychczas (czyści tylko datę, nie ruszamy przypisań).
4. Panel zadań admina — bez regresji (ten sam komponent).

Brak migracji DB. Zmiany w jednym pliku.
