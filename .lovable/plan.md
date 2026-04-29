## Problem

Influencer Simon dodał wszystkie 4 z 4 wymaganych pomysłów. W jego dashboardzie poprawnie pojawia się "Wszystko gotowe! Brak oczekujących zadań" (UserDashboard filtruje kampanię gdy `total >= targetIdeaCount`). Mimo to na ekranie wyboru użytkownika (RoleSelector) przy jego kafelku wciąż świeci się czerwona "1".

## Przyczyna

`src/components/RoleSelector.tsx` (linie 52-54) liczy `campaignTaskCount` jako **każdą** kampanię o statusie `awaiting_ideas` przypisaną do influencera:

```ts
const campaignTaskCount = user.role === 'influencer'
  ? campaigns.filter(c => c.assignedInfluencerId === user.id && c.status === 'awaiting_ideas').length
  : 0;
```

Status kampanii pozostaje `awaiting_ideas` nawet po dodaniu kompletu pomysłów – zmienia się dopiero, gdy klient zakończy review. W rezultacie RoleSelector pokazuje zadanie, którego dashboard już nie pokazuje. Klasyczna desynchronizacja predykatów badge ↔ dashboard (analogicznie jak wcześniej z adminem).

Do liczenia powinien być wykorzystany ten sam warunek co w `UserDashboard.ideasCampaigns` (linia 177): kampania liczy się jako akcja tylko gdy `total < targetIdeaCount`.

## Rozwiązanie

Jedna chirurgiczna zmiana w `src/components/RoleSelector.tsx`:

- Dla roli `influencer`: zaliczać kampanię tylko jeśli liczba pomysłów `ideas.filter(i => i.campaignId === c.id).length < c.targetIdeaCount` (i kampania nie jest `completed`/`cancelled`).
- Pozostałe role: bez zmian.

Po zmianie kafelek Simona pokaże 0 zadań → brak czerwonej "1", spójnie z dashboardem.

## Weryfikacja

1. Simon (4/4 pomysłów) → brak badge w RoleSelector.
2. Influencer z 1/4 dodanych pomysłów → badge "1".
3. Influencer z 0 aktywnymi kampaniami i bez tasków → brak badge.
4. Inne role (klient, admin, kierownik) – bez regresji.

Brak migracji DB. Brak innych zmian w plikach.