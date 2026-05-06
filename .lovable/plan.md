# Smart Grouping w kroku 18 „Opisy i tytuły do publikacji"

## Cel
Influencer w kroku 18 domyślnie pisze JEDEN wspólny opis dla Facebooka, Instagrama i TikToka. Tekst jest mirrorowany do trzech osobnych kluczy w stanie. Każda z platform może być w dowolnym momencie „odpięta" od grupy i edytowana niezależnie (np. inne hashtagi na IG). YouTube zawsze pozostaje osobnym polem (input na tytuł).

## Zakres zmian
Zmiana wyłącznie w warstwie UI/stanu komponentu wejściowego. Format zapisu do bazy się NIE zmienia — dalej `JSON.stringify({ facebook, tiktok, instagram, youtube })` z osobnym kluczem dla każdej platformy. Komponenty odczytu (`SocialDescriptionsDisplay`, `CompletedTaskCard`), schemat tasków, statusy, konsensus, ping-pong, historia — bez zmian.

### Plik dotknięty
- `src/components/SocialDescriptionsInput.tsx` — przepisanie warstwy UI i lokalnego stanu.

### Pliki nietknięte
- `src/components/SocialDescriptionsDisplay.tsx`
- `src/components/TaskCard.tsx` (wywołanie `onSubmit(value)` z gotowym JSON-em zostaje)
- `src/components/CompletedTaskCard.tsx`
- mapper, sync, schemat DB

## Model stanu (po zmianie)
```text
linkedSet: Set<'facebook'|'instagram'|'tiktok'>   // platformy aktualnie w grupie
groupText: string                                  // wspólne pole grupy
platforms: {
  facebook:  { text, saved, expanded }
  instagram: { text, saved, expanded }
  tiktok:    { text, saved, expanded }
  youtube:   { text, saved, expanded }            // zawsze poza grupą
}
```

Hydratacja z `initialValue` (istniejący JSON):
- Jeśli `facebook === instagram === tiktok` (i niepuste) → `linkedSet = {fb, ig, tt}`, `groupText = facebook`.
- W przeciwnym razie → `linkedSet` zawiera tylko te platformy, których pola są puste lub równe sobie nawzajem; pozostałe są domyślnie odpięte. Bezpieczny fallback: jeśli istnieją różne treści, **żadna nie ląduje w grupie** (wszystkie pokazane jako odpięte z istniejącym tekstem).

## UI

### Karta „Grupa social"
Pojedyncza karta zastępująca trzy obecne (FB/IG/TT) gdy w `linkedSet` jest ≥1 platforma:
- Nagłówek: ikony FB / IG / TT z malutką ikonką kłódki obok każdej (`Link2` z lucide gdy w grupie, `Link2Off` gdy odpięta — w grupie pokazujemy `Link2` jako „kliknij, aby odpiąć").
- Tooltip na ikonie: „Odepnij Instagram z grupy" itp.
- Wspólna `Textarea` (`groupText`).
- Przycisk „Zapisz" zaznacza wszystkie platformy z `linkedSet` jako saved i kopiuje tekst do każdej z nich.

### Karty odpiętych platform
Dla każdej platformy spoza `linkedSet` — render dotychczasowej karty per-platforma (taki sam wygląd jak dziś), z dodatkowym małym przyciskiem „Połącz z grupą" w nagłówku (ikona `Link2`). Kliknięcie:
- dodaje platformę do `linkedSet`,
- jeśli grupa jest pusta → `groupText` przyjmuje tekst tej platformy,
- jeśli grupa ma już tekst → confirm „Tekst tej platformy zostanie zastąpiony tekstem grupy" (prosty `window.confirm`, bez nowych dialogów).

### YouTube
Bez zmian. Render jak dziś (single-line `input`, „Zapisz", osobny wskaźnik).

### Pasek postępu (4/4)
Pozostaje, liczy `saved` dla wszystkich 4 platform niezależnie od grupowania.

### Submit końcowy
Aktywny gdy wszystkie 4 są `saved`. Wysyła ten sam JSON co dziś:
```ts
JSON.stringify({ facebook, instagram, tiktok, youtube })
```

## Logika mirroringu
- `onChange` w grupowej `Textarea` → set `groupText` + dla każdej platformy w `linkedSet`: `platforms[p].text = groupText`, `saved = false`.
- „Zapisz" w grupie → wszystkie zlinkowane dostają `saved = true`, `expanded = false`. Wywołujemy `onSaveDraft(buildJSON(...))` z aktualnym stanem (jak dziś — draft po każdym zapisie cząstkowym).

## Logika odpinania
Kliknięcie ikony platformy w nagłówku grupy:
- usuń platformę z `linkedSet`,
- skopiuj aktualny `groupText` do `platforms[p].text`, `saved = false`, `expanded = true`,
- jeśli `linkedSet` stał się pusty → karta grupy znika, pojawiają się 3 osobne karty (FB/IG/TT mają już skopiowany tekst).

## Edge cases
- Grupa pusta (`linkedSet.size === 0`): nie renderujemy karty grupy.
- Grupa z 1 platformą: karta grupy pokazuje 1 ikonę (technicznie to „odpięta" sytuacja, ale pozostawiamy ujednolicony render — tak jest prościej i zgodnie z opisem mechanizmu).
- Hydratacja z payloadu, gdzie tylko np. FB i IG są równe a TT różne → `linkedSet = {fb, ig}`, TT jako osobna karta. (Konserwatywnie: wybieramy maksymalny zbiór równych niepustych pól.)
- `initialValue === null` → `linkedSet = {fb, ig, tt}`, wszystkie puste, YouTube też pusty.

## Po stronie zapisu do DB
Bez zmian. `buildJSON` produkuje obiekt z osobnymi kluczami `facebook`, `instagram`, `tiktok`, `youtube`. Render w `CompletedTaskCard`/`SocialDescriptionsDisplay` działa bez modyfikacji — i tak iteruje po 4 kluczach.

## Czego NIE robimy
- Nie zmieniamy formatu payloadu w bazie.
- Nie zmieniamy `SocialDescriptionsDisplay` ani `CompletedTaskCard`.
- Nie ruszamy logiki konsensusu, ping-pongu, SLA, historii.
- Nie wprowadzamy nowych zależności (używamy istniejących ikon `lucide-react`: `Link2`, `Link2Off`).
