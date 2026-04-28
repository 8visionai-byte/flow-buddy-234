# Aktor: po decyzji klienta brak ponownej akceptacji

## Problem

W flow obsady aktorów pipeline ma tylko jeden krok akceptacji klienta („Zaakceptuj przypisanie osoby"). Dziś jednak gdy klient kliknie „Zmień", influencer poprawia obsadę i `resubmitTask` cofa ją z powrotem do klienta na **drugą rundę akceptacji** — a pipeline tego etapu nie przewiduje. Powinien być tylko jeden punkt decyzyjny klienta; po nim poprawki influencera idą dalej bez ponownego pingowania klienta.

## Zmiana

`src/components/TaskCard.tsx` (widok `needs_influencer_revision` dla `actor_assignment`, linie ~659–661):

- `ActorAssignmentInput.onSubmit` wywołuje `resubmitTaskAndAutoApprove(task.id, ...)` zamiast `resubmitTask(...)`. To istniejąca akcja z poprzedniego tasku — auto-domyka kolejny task akceptacji klienta z `value: 'auto_approved'` i odblokowuje następny etap.
- W widoku akceptacji klienta (`pending_client_approval` + `actor_approval`, tooltip linie ~462–464) zmieniamy tekst „Zmień" z _„Influencer zaproponuje nowy skład i wróci do Ciebie po akceptację"_ na _„Influencer naniesie poprawki i przejdzie dalej bez ponownej akceptacji z Twojej strony"_.

Dla URL/text/scenariusza ścieżka pozostaje bez zmian — tam Influencer dalej ma wybór dwóch przycisków (z weryfikacją lub bez). Tylko aktor jest „one-shot" z definicji pipeline'u.

## Pamięć

Dopisać do `mem://features/actor-assignment`: po decyzji klienta brak drugiej rundy — poprawki influencera są auto-zatwierdzane (`resubmitTaskAndAutoApprove`).

## Pliki

- `src/components/TaskCard.tsx`
- `mem://features/actor-assignment`
