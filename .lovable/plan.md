# Plan: Ujednolicenie osoby kontaktowej klienta i osoby z dostępem

## Problem (z podanych zrzutów)

1. **Brak telefonu przy osobie z dostępem.** W `Zarządzaj klientami` przy dodawaniu osoby z dostępem jest tylko pole "Imię i nazwisko". Telefon będzie potrzebny do powiadomień (Telegram/Make.com).
2. **Duplikacja osób.** Gdy zakładamy klienta `Dental Care Sp. z o.o.` z osobą kontaktową **Anna Kowalska**, a dodatkowo dodajemy osobę z dostępem **Anna** — w widoku „Przypisz osobę do filmu" pojawiają się obie pozycje: „Anna Kowalska — Kontakt" oraz „Anna — Konto klienta w systemie". Klient nie wie, którą wybrać. To jest ta sama osoba.

## Założenie (zgodne z `mem://logic/client-user-unification`)
Każdy kontakt klienta to **app_user**. „Osoba kontaktowa" wpisywana w formularzu firmy jest pierwszą osobą z dostępem (primary contact) — nie powinna istnieć obok osobnego usera o tym samym imieniu.

## Zmiany — TYLKO warstwa wizualna/UX (bez zmian schematu)

### A) `ClientManagementDialog.tsx`

1. **Sekcja „Nowy klient" — usuń osobne pole „Osoba kontaktowa"** (`form.contactName`) i osobne pole „Telefon firmy"/„Email firmy" w obecnej formie. Zamiast tego:
   - Pola firmy: **Nazwa firmy** (wymagane), **Email firmy** (opcjonalny — kontaktowy do firmy), **Notatki**.
   - Sekcja „Osoby z dostępem do systemu" pokazuje **listę osób**, gdzie **pierwsza pozycja jest oznaczona jako „Główny kontakt"** (badge `Główny`). Każda pozycja ma: imię i nazwisko + **PhoneField (telefon)** + przycisk usuń.
   - Walidacja: musi być co najmniej **1 osoba z dostępem** (główny kontakt).
   - Przy zapisie:
     - `addClient({ companyName, contactName: <imię pierwszej osoby>, email, phone: <telefon pierwszej osoby>, notes })` — `contactName`/`phone` na encji `Client` wypełniamy z głównego kontaktu (zachowanie kompatybilności wstecznej z istniejącym typem `Client`).
     - Dla **każdej** osoby z listy: `addUser({ name, role: 'klient', clientId, phone })`. Pierwsza = główny kontakt.

2. **Sekcja istniejącego klienta** (rozwinięta lista „Osoby z dostępem"):
   - Każdy `addUser` z formularza inline przyjmuje **imię + telefon** (PhoneField), nie tylko imię. Aktualnie jest tylko jeden `Input` na imię — dodajemy obok PhoneField.
   - Wiersz osoby pokazuje też telefon (`user.phone`) obok badge `klient`.
   - Pierwsza utworzona osoba (lub osoba o imieniu === `client.contactName`) dostaje badge **„Główny"**.

3. **Edycja istniejącego klienta** (`startEdit` / `renderFormFields(false)`):
   - Usuń pola „Osoba kontaktowa" i „Telefon" z formularza firmy. Te dane edytuje się w wierszach „Osoby z dostępem" (każda osoba ma swój telefon).
   - Zostają: Nazwa firmy, Email firmy, Notatki.

### B) `ActorAssignmentInput.tsx`

W widoku „Przypisz osobę do filmu" usuwamy duplikat:

```tsx
// linia 274 — KASUJEMY cały SuggestionCard dla client.contactName
{client && !clientUsers.some(u => u.name === client.contactName) && ( … )}
```

Zostawiamy **tylko** listę `clientUsers` (osoby z dostępem do systemu). Dzięki ujednoliceniu w (A) główny kontakt jest już w `clientUsers` jako pierwsza osoba z badge „Główny", więc nic nie znika.

Etykieta sugestii: zamiast „Konto klienta w systemie" pokazujemy bardziej naturalne **„Klient"** + telefon, jeśli jest (`u.phone`).

### C) Zgodność wsteczna

- `Client.contactName` i `Client.phone` zostają w typie (używane w wielu miejscach, np. `AdminDashboard`, `ProjectReadOnlyView`, `UserDashboard`). Wypełniamy je automatycznie z głównego kontaktu — nic w innych komponentach nie pęka.
- `mockData.ts` — bez zmian struktury, ale jeśli istniejący mock ma `contactName: 'Anna Kowalska'` bez odpowiadającego mu `klient`-usera, dodamy w nim brakującego usera o tym samym imieniu i telefonie, żeby nie było „duchów" w istniejących danych.

### D) Migracja istniejących danych w localStorage (jednorazowo, przy starcie)

W `AppContext.tsx`, po wczytaniu `clients` i `users`, dla każdego klienta:
- jeśli `client.contactName` jest niepuste i **nie ma** żadnego usera `klient` z `clientId === client.id` o nazwie === `contactName` (case-insensitive trim) → dodaj go automatycznie z telefonem `client.phone`.

Dzięki temu istniejący użytkownicy nie zobaczą nagle pustej listy osób.

## Co NIE jest zmieniane

- Schemat bazy / typów (`Client`, `User`) — zero zmian.
- Logika webhooków / Make.com — bez zmian (nadal czyta `user.phone`).
- `AddCampaignDialog` — sekcja „Nowy klient" tam już ma `pendingContacts` z telefonami, więc tylko wyrównujemy etykiety i również dodajemy logikę „pierwsza osoba = główny kontakt" (analogicznie do A).

## Pliki do edycji

- `src/components/ClientManagementDialog.tsx` — przebudowa formularza (A).
- `src/components/ActorAssignmentInput.tsx` — usunięcie duplikatu sugestii (B).
- `src/components/AddCampaignDialog.tsx` — drobne wyrównanie etykiet (analogicznie do A).
- `src/context/AppContext.tsx` — migracja jednorazowa istniejących danych (D).
- `src/data/mockData.ts` — uzupełnienie brakujących userów-klientów dla mocka (C).
