# GT Role Bot V8.0

GT Utility Bot with GT Cards v2.

## New in V8.0

- GT Player Cards v2 as generated PNG images
- One shared background asset: `assets/cards/backgrounds/player-card-bg.png`
- GT Logo can be integrated directly in the background
- Automatic roster colors/glow/badges
- Discord avatar is pulled automatically and rendered round
- Fixed GT-ID system such as `GT-001`, `GT-002`, `GT-003`
- PostgreSQL storage for player cards, birthdays and Twitch watchers
- Social buttons for Twitch, TikTok, X and YouTube
- Player Directory channel via `PLAYER_DIRECTORY_CHANNEL_ID`

## Player Card Commands

- `/playercreate` staff creates a card
- `/playeredit` staff edits a card
- `/playerdelete` staff deactivates a card, GT-ID stays reserved
- `/playercard` preview a card
- `/playerpost` posts a card to the directory channel or selected channel
- `/playerlist` lists saved cards

## Render Environment Variables

Required:

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
GUILD_ID=your_discord_server_id
DATABASE_URL=your_postgres_internal_url
DATABASE_SSL=true
```

Needed for Twitch notifications / stream checks:

```env
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_NOTIFY_INTERVAL_SECONDS=60
```

Needed for Fortnite Calendar:

```env
FORTNITE_CALENDAR_ICS_URL=your_ics_url
AUTO_FORTNITE_EVENTS_ENABLED=true
AUTO_FORTNITE_EVENTS_CHANNEL_ID=channel_id
AUTO_FORTNITE_EVENTS_TIME=09:00
AUTO_FORTNITE_EVENTS_TIMEZONE=Europe/Berlin
AUTO_FORTNITE_EVENTS_REGION=ALL
AUTO_FORTNITE_EVENTS_DAYS=1
```

Needed for birthdays:

```env
BIRTHDAY_CHANNEL_ID=channel_id
```

Needed for Player Cards:

```env
PLAYER_DIRECTORY_CHANNEL_ID=channel_id
```

## Config

Earnings roles and event-ban role stay in `config.json`.

## Asset Path

The player card background must be here:

```txt
assets/cards/backgrounds/player-card-bg.png
```

This V8.0 zip already contains the background you uploaded in this chat.

## Deploy

1. Replace all GitHub files with this version.
2. Commit.
3. Render → Manual Deploy → Clear build cache & deploy.
4. Logs should show:

```txt
GT ROLE BOT V8.0 LOADED
Player card storage: PostgreSQL database connected.
```
