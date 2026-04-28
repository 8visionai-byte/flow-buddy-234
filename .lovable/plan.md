# Równoległe odblokowanie rekwizytów i terminu nagrania

## Problem

Po akceptacji obsady przez klienta pipeline odblokowuje **tylko** zadanie influencera „Określ rekwizyty". Zadanie admina „Ustaw termin planu zdjęciowego" zostaje `locked` aż influencer skończy rekwizyty.

Skutki widoczne w UI:
- Influencer widzi banner „Brak przypisanego terminu — skontaktuj się z Adminem", ale nie może go ustawić, a admin nawet nie wie, że jego kolej.
- Admin nie ma czerwonej cyferki przy swoim awatarze, nic nie pojawia się w zakładce **Moje Zadania**, a w karcie pomysłu w zakładce **Kampanie** etap pokazuje tylko „Określ rekwizyty".
- Powstaje fałszywa zależność: rekwizyty wymagają terminu, a termin nie zostanie ustawiony, dopóki influencer nie wpisze rekwizytów.

Logicznie te dwa zadania są niezależne — admin może planować datę zdjęciową bez listy rekwizytów, a influencer dostarczy rekwizyty, gdy będzie miał termin (lub równolegle).

## Rozwiązanie

Po akceptacji obsady przez klienta pipeline ma odblokować **oba** kolejne zadania równolegle:

```text
[12] Zaakceptuj obsadę  (klient) ─── done ──┬─► [13] Określ rekwizyty           (influencer) ─ todo
                                            └─► [14] Ustaw termin planu zdj.    (admin)      ─ todo
```

Następne zadanie po grupie („Potwierdź nagranie" — kierownik planu) odblokowuje się dopiero, gdy **oba** są `done`.

## Co użytkownik zobaczy

### Admin (Marcin)
- **Czerwona cyferka** przy awatarze „Marcin" w panelu wyboru użytkownika.
- W **Panel Admina → Moje Zadania** pojawia się projekt „Pierwszy pomysł" z aktywnym zadaniem „Ustaw termin planu zdjęciowego" — z popoverem do wyboru daty.
- W **Panel Admina → Kampanie** etap pomysłu pokazuje oba aktywne zadania (rekwizyty + termin) z osobnymi statusami.

### Influencer (Tomek)
- Banner „Brak przypisanego terminu" zostaje, ale jego treść zmieniamy na neutralną: **„Termin nagrania zostanie ustalony przez Admina równolegle"** (bez sugestii, że ma się z kimś kontaktować).
- Pole „Określ rekwizyty" pozostaje aktywne — wpisanie rekwizytów nie wymaga znajomości terminu.

### Klient (Anna)
Bez zmian — etap projektu w jego widoku pokazuje, że materiał jest w fazie przygotowań.

## Zakres zmian (technicznie)

### `src/context/AppContext.tsx` — funkcja `completeTask`, gałąź „Non-approval task"

Obecnie (linie 398–409) pętla unlock łapie tylko jedno zadanie nie-approval. Trzeba ją rozszerzyć, by przy domknięciu **approval task** (`actor_approval`) odblokować całą grupę kolejnych zadań do następnego punktu synchronizacji.

Zamiast specjalnej obsługi tylko fazy „Przygotowanie do nagrania", wprowadzić ogólną zasadę: **konsekutywne zadania nie-approval przypisane do różnych ról odblokowujemy razem** (jako równoległą grupę). Synchronizacja na kolejnym zadaniu przypisanym do roli, której zadanie już jest w grupie, lub na kolejnym approval.

Dla bezpieczeństwa początkowego ograniczamy się do konkretnej pary: po zakończeniu zadania o tytule **„Zaakceptuj przypisanie osoby"** odblokuj zarówno „Określ rekwizyty" jak i „Ustaw termin planu zdjęciowego" jednocześnie. (Reszta pipeline'u zachowuje się bez zmian.)

Druga zmiana: gdy zamykane jest jedno z tych równoległych zadań, **nie odblokowuj** kolejnego (`Potwierdź nagranie`), dopóki **oba** nie są `done`. Dodać helper `areParallelGroupTasksDone(projectId, ['Określ rekwizyty', 'Ustaw termin planu zdjęciowego'])` i sprawdzać go przed odblokowaniem zadania `Potwierdź nagranie`.

### `src/components/TaskCard.tsx` — banner deadline (linia 714–718)

Zmienić tekst z `Brak przypisanego terminu — skontaktuj się z Adminem` na `Termin nagrania zostanie ustalony przez Admina równolegle` (delikatniejszy, neutralny ton — Admin już wie).

### `src/components/AdminDashboard.tsx`

- Logika `isAdminTaskActionable` (linia 119) już zadziała poprawnie, gdy zadanie „Ustaw termin..." będzie miało `status === 'todo'` zamiast `'locked'`. Bez zmian.
- Sekcja „Moje Zadania" (linia 1618+) automatycznie wyświetli zadanie po zmianie statusu w kontekście. Bez zmian kodu.
- Na karcie pomysłu w widoku „Kampanie" (linia 1152) `activeTask` pokazuje tylko jedno zadanie. Zmienić tę logikę tak, by gdy istnieje więcej niż jedno aktywne zadanie z tej samej fazy, pokazać je rozdzielone przecinkiem (np. „Etap: Określ rekwizyty, Ustaw termin planu zdjęciowego").

### Pamięć projektu

Zaktualizować `mem://logic/task-sequencing` — dopisać wyjątek od sekwencyjności: para *rekwizyty + termin nagrania* odblokowuje się równolegle, oba muszą być `done` zanim odblokuje się `Potwierdź nagranie`.

## Efekt dla użytkownika

Po akceptacji obsady przez klienta admin **natychmiast** zobaczy czerwoną cyferkę i zadanie „Ustaw termin planu zdjęciowego" w sekcji „Moje Zadania". Influencer może w tym samym czasie wpisywać rekwizyty bez czekania na termin. Pipeline ruszy do „Potwierdź nagranie" dopiero, gdy oba zadania będą wykonane.
