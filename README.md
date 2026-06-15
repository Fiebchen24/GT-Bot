# GT Role Bot V7.3

Nach dem Deploy muss im Render Log stehen:

```txt
GT ROLE BOT V7.3 LOADED
```

## Fortnite Calendar / ICS

Der Bot liest Fortnite Events aus einem ICS Kalender. Cito ist nicht mehr nötig.

### ICS Link in Render Environment

```env
FORTNITE_CALENDAR_ICS_URL=DEIN_ICS_LINK
FORTNITE_TIMEZONE=Europe/Berlin
```

Oder in `config.json`:

```json
"fortniteCalendarIcsUrl": "DEIN_ICS_LINK",
"fortniteTimezone": "Europe/Berlin"
```

Falls der Link HTTP 403 gibt, ist er privat/blockiert. Dann eine öffentliche `.ics` Export-URL nutzen oder die Datei als `fortnite-events.ics` ins GitHub Repo legen und setzen:

```json
"fortniteCalendarIcsFile": "fortnite-events.ics"
```

## Fortnite Commands

```txt
/fortniteevents
/fortniteeventstoday
/fortniteeventspost
/fortniteeventsgrouped
```

`/fortniteeventsgrouped` postet gruppiert nach:

- FNCS
- Cash Cups
- Victory Cups
- Ranked Cups
- Console
- Zero Build
- Reload
- Other Events

Optionen:

```txt
channel = Zielchannel
days = 1-14
region = EU / NAC / OCE / ASIA / ALL
keyword = optional, z. B. FNCS, Ranked, ZB
```

## Automatischer Morgenpost

Du kannst den automatischen täglichen Post über `config.json` aktivieren:

```json
"autoFortniteEvents": {
  "enabled": true,
  "channelId": "DEIN_CHANNEL_ID",
  "time": "09:00",
  "timezone": "Europe/Berlin",
  "region": "EU",
  "days": 1,
  "keyword": ""
}
```

Oder über Render Environment:

```env
AUTO_FORTNITE_EVENTS_ENABLED=true
AUTO_FORTNITE_EVENTS_CHANNEL_ID=DEIN_CHANNEL_ID
AUTO_FORTNITE_EVENTS_TIME=09:00
AUTO_FORTNITE_EVENTS_TIMEZONE=Europe/Berlin
AUTO_FORTNITE_EVENTS_REGION=EU
AUTO_FORTNITE_EVENTS_DAYS=1
AUTO_FORTNITE_EVENTS_KEYWORD=
```

Der Bot prüft jede Minute, ob die eingestellte Uhrzeit erreicht ist, und postet pro Tag nur einmal.

## Deploy

1. GitHub Dateien ersetzen
2. Commit
3. Render: Manual Deploy -> Clear build cache & deploy
