# Naprawa renderu „Wgraj surówkę na serwer"

## Diagnoza

W `src/components/CompletedTaskCard.tsx`:

- Funkcja `tryParseRawFootage` (linia 64-70) wymaga jednocześnie `p.url` **i** `p.recordingNumber !== undefined`.
- Aktualny formularz w `src/components/TaskCard.tsx` (linia 166) zapisuje payload jako `JSON.stringify({ url, notes })` — **bez** `recordingNumber`.
- W rezultacie parser zwraca `null`, fallback dalej próbuje rozpoznać format aktorów i ostatecznie renderuje surowy JSON jako tekst.

Zapis do bazy nie jest ruszany — naprawa wyłącznie w warstwie odczytu.

## Zmiany (plik: `src/components/CompletedTaskCard.tsx`)

1. **`RawFootagePayload`** — `recordingNumber` staje się opcjonalny:
   ```ts
   interface RawFootagePayload { url: string; recordingNumber?: string; notes?: string; }
   ```

2. **`tryParseRawFootage`** — akceptuje każdy obiekt JSON, który ma string `url` zaczynający się od `http`:
   ```ts
   if (p && typeof p === 'object' && !Array.isArray(p) && typeof p.url === 'string' && /^https?:\/\//.test(p.url)) {
     return p as RawFootagePayload;
   }
   ```
   Blok `try/catch` zostaje — przy niepoprawnym JSON zwraca `null`, więc istniejący fallback na końcu (linia 583: `<p className="text-sm ... whitespace-pre-wrap break-all">{displayValue}</p>`) zadziała jako bezpieczne wyświetlenie surowego tekstu bez crasha.

3. **`RawFootageDisplay`** — link i uwagi zgodnie z wytycznymi:
   - Link: `<a href={payload.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{payload.url}</a>` (zamiast obecnego `truncate` + `text-primary`, zostaje ikona `Film`).
   - Sekcja `Nr nagrania` renderowana tylko gdy `payload.recordingNumber` jest niepustym stringiem (już tak jest, ale teraz w praktyce po prostu się nie pojawi dla nowych payloadów bez tego pola).
   - Notes: warunek `payload.notes && payload.notes.trim()` → `<p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{payload.notes}</p>` zamiast obecnego rzędu z ikoną (lub zachowujemy ikonę FileText — do decyzji; w planie minimalnie zmieniamy tylko styl tekstu).

## Co pozostaje bez zmian

- Logika zapisu (`TaskCard.tsx` `submitRawFootage`).
- Schema bazy, statusy, mechanizmy akceptacji, historia.
- Obsługa starszych payloadów z `recordingNumber` — nadal działa, pole będzie pokazane.
- Pozostałe gałęzie renderowania (social descriptions, actor entries, boolean) — bez zmian.
