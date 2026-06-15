# GT Role Bot V7.1

## Wichtig
Nach dem Deploy muss im Render Log stehen:

```txt
GT ROLE BOT V7.1 LOADED
```

## Fortnite Calendar / ICS
Cito ist nicht mehr nötig. Der Bot liest Fortnite Events aus einem ICS Kalender.

### Option A: ICS Link in config.json
```json
"fortniteCalendarIcsUrl": "DEIN_ICS_LINK"
```

### Option B: ICS Link in Render Environment
```env
FORTNITE_CALENDAR_ICS_URL=DEIN_ICS_LINK
```

### Option C: ICS Datei im GitHub Repo
Lege z. B. `fortnite-events.ics` in das Repo und trage ein:

```json
"fortniteCalendarIcsFile": "fortnite-events.ics"
```

## Commands

```txt
/fortniteevents
/fortniteeventstoday
/fortniteeventspost
```

Wenn ein ICS Link `HTTP 403` gibt, ist der Link blockiert oder privat. Dann muss der Kalender öffentlich/exportierbar gemacht werden oder du nutzt die ICS Datei im Repo.

## Deploy
1. GitHub Dateien ersetzen
2. Commit
3. Render: Manual Deploy -> Clear build cache & deploy
