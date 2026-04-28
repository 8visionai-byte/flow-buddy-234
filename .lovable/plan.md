# Rebrand UI: "Projekt" → "Pomysł" (tylko warstwa wizualna)

## Założenia (potwierdzone z użytkownikiem)

- **Co zmieniamy:** wyłącznie teksty widoczne dla użytkownika (etykiety, nagłówki, toasty, opisy, placeholdery, tytuły dialogów).
- **Czego NIE ruszamy:** nazwy tabel (`projects`), typów (`Project`), pól (`projectId`, `assignedInfluencerId`), nazwy plików (`AddProjectDialog.tsx`, `ProjectReadOnlyView.tsx`), kluczy w localStorage, kontekstu, queryKeys.
- **Reguła:** "Kampania" zostaje "Kampanią". "Pomysł" przed akceptacją zostaje "Pomysłem". Encja `Project` (czyli zaakceptowany pomysł w realizacji) — w UI zaczyna nazywać się "Pomysł".

## Mapowanie tłumaczeń

| Było | Będzie |
|---|---|
| Projekt | Pomysł |
| projekt | pomysł |
| Projekty | Pomysły |
| projekty | pomysły |
| projektu | pomysłu |
| projektów | pomysłów |
| projektem | pomysłem |
| projektami | pomysłami |
| Nowy projekt | Nowy pomysł |
| Dodaj nowy projekt | Dodaj nowy pomysł |
| Nazwa projektu / temat filmu | Nazwa pomysłu / temat filmu |
| Utwórz projekt | Utwórz pomysł |
| Usuń projekt | Usuń pomysł |
| Wszystkie projekty | Wszystkie pomysły |
| Moje projekty | Moje pomysły |
| Brak projektów | Brak pomysłów |
| Projekt zakończony | Pomysł zakończony |
| Projekt stworzony | Pomysł utworzony |
| Projekt nie znaleziony | Pomysł nie znaleziony |
| „...stały się projektami" | „...stało się pomysłami" |

**Świadome wyjątki — NIE zmieniamy:**
- W `ClientManagementDialog.tsx:289` zdanie "oceniać pomysły / projekty" → zmienia się na po prostu „oceniać pomysły" (usuwamy redundancję).
- W `AdminDashboard.tsx:2379` „Projektów stworzonych z tej kampanii to nie dotyczy" → „Pomysłów utworzonych z tej kampanii to nie dotyczy".
- W `mockData.ts:112` opis zadania pipeline'u „priorytet tego projektu" → „priorytet tego pomysłu".

## Pliki do edycji (tylko stringi, ~50 linii łącznie)

1. **src/components/AddProjectDialog.tsx** — 4 stringi (przycisk, tytuł, opis, label, CTA).
2. **src/components/AdminDashboard.tsx** — ~13 stringów (zakładka „Wszystkie projekty", nagłówki, toasty usuwania, badge „Projekt zakończony", komunikaty pustych stanów, dialog potwierdzenia usunięcia).
3. **src/components/UserDashboard.tsx** — ~15 stringów (nagłówki list, kolumny tabeli, puste stany, zakładka „Projekty" → „Pomysły", komunikaty operatora/montażysty/KP).
4. **src/components/PriorityAssignmentDialog.tsx** — ~6 stringów (nagłówki tabeli, opisy, liczniki).
5. **src/components/IdeasPanel.tsx** — 1 string („Projekt stworzony" → „Pomysł utworzony").
6. **src/components/KierownikDashboard.tsx** — 1 string („Brak aktywnych projektów" → „Brak aktywnych pomysłów").
7. **src/components/ProjectReadOnlyView.tsx** — 1 string („Brak etapów dla tego projektu" → „...dla tego pomysłu").
8. **src/components/ClientManagementDialog.tsx** — 2 stringi.
9. **src/components/AddCampaignDialog.tsx** — 1 string („prowadzić projekty" → „prowadzić pomysły").
10. **src/data/mockData.ts** — 1 string (opis zadania pipeline'u).

## Czego nie zmieniamy (świadomie)

- Nazwa pliku `AddProjectDialog.tsx`, `ProjectReadOnlyView.tsx` — bez zmian (tylko UI).
- Typ `Project`, pola `projectId`, `assignedInfluencerId` itd. w `src/types/index.ts` — bez zmian.
- Tabela `projects` w bazie — bez zmian.
- Komentarze w kodzie — bez zmian (nie są widoczne dla użytkownika).
- `console.log`-i, klucze queryKey — bez zmian.

## Walidacja po wdrożeniu

- Przejść po widokach: Admin → Wszystkie pomysły, Klient → lista pomysłów po akceptacji, Influencer/Montażysta/KP → „Moje pomysły", dialog dodawania pomysłu, dialog priorytetów, dialog usuwania.
- Sprawdzić, że odmiana gramatyczna jest poprawna („1 pomysł", „2 pomysły", „5 pomysłów").
- Upewnić się, że logika (tworzenie z idei, generowanie pipeline'u) działa identycznie — to czysto kosmetyczna zmiana.

## Po akceptacji

Zaktualizuję pamięć projektu wzmianką: „W UI encja Project nazywa się 'Pomysł'; w kodzie/bazie pozostaje `Project`/`projects`."
