# GT Role Bot v7.1

Render-ready Discord bot for GT with role tools, signup checks, Twitch/DC proof checks, voice channel tools, event bans and an automatic Fortnite calendar.

## Deploy

1. Upload all files except `.env` to GitHub.
2. In Render, set the environment variables from `.env.example`.
3. Build command: `npm install`
4. Start command: `npm start`
5. Use **Clear build cache & deploy** after updating from an older version.

The Render log should show:

```txt
GT ROLE BOT V7.1 LOADED
Slash commands registered.
Logged in as ...
```

## Required environment variables

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
GUILD_ID=your_discord_server_id
```

## Optional Twitch proof variables

Required only for `/postcupcheck` Twitch live/VOD checks:

```env
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
```

## Calendar variables

```env
CALENDAR_CHANNEL_ID=your_fortnite_calendar_channel_id
TOURNAMENT_ALERT_ROLE_ID=your_tournament_alert_role_id
```

## Automatic Fortnite events

v7.1 can fetch Fortnite events automatically from an external Fortnite/Cito events endpoint.

```env
CITO_API_URL=your_events_api_url
CITO_API_KEY=your_api_key_if_required
```

Alternative names also work:

```env
FORTNITE_EVENTS_API_URL=your_events_api_url
FORTNITE_EVENTS_API_KEY=your_api_key_if_required
```

If no API URL is set, the bot still works, but only manual GT events from `data/gtCalendar.json` are shown.

The automatic fetcher is intentionally flexible: it accepts most JSON event-list formats and tries to normalize common fields like `name`, `title`, `startTime`, `endTime`, `windows`, `region`, and `platform`.

## Calendar commands

- `/calendar` — shows the current calendar embed.
- `/calendarpost` — posts or updates the calendar embed in `CALENDAR_CHANNEL_ID`.
- `/calendarrefresh` — fetches Fortnite events immediately and updates the calendar.
- `/calendaradd` — adds a manual GT event.
- `/calendarremove` — removes a manual GT event by ID.
- `/calendarlist` — lists manual GT events with IDs.

The calendar message updates automatically when the bot starts and every 6 hours.

## Calendar files

- `data/gtCalendar.json` — manual GT events.
- `data/fortniteEventsCache.json` — automatic Fortnite event cache.
- `data/gtCalendarMessage.json` — saved Discord calendar message ID.

## Main commands

- `/giverolefromchannel`
- `/takerolefromchannel`
- `/earningsroles`
- `/checksignup`
- `/postcupcheck`
- `/voicechannelcreate`
- `/voicechanneldelete`
- `/voicechanneldeleteall`
- `/eventbanadd`
- `/eventbanfromchannel`
- `/eventbanremove`
- `/eventbanlist`

## DC proof examples

These count as manual proof:

```txt
@Player DC
@Player DC ss
PlayerName DC
PlayerName DC ss
```

## Event bans

Event bans are checked every minute. When a ban expires, the bot removes the role automatically and can post into the configured log channel.
