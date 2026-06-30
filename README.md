# GT Role Bot V8.7

GT Utility Bot with GT Cards v2 and player self-service requests.

## New in V8.7

- Players can create/update their own card request with `/playerrequest`
- Self-created cards are saved as `pending`
- Staff can review with `/playercard` and `/playerpending`
- Staff posts and approves with `/playerpost`
- Existing staff commands remain: `/playercreate`, `/playeredit`, `/playerdelete`, `/playerlist`
- Roster text on the card was moved slightly up so it no longer sits too low
- PostgreSQL storage for player cards, birthdays and Twitch watchers

## Player Card Workflow

1. Player uses `/playerrequest` and enters their card data.
2. Staff checks pending requests with `/playerpending`.
3. Staff previews the card with `/playercard user:@Player`.
4. Staff can correct fields using `/playeredit`.
5. Staff posts it with `/playerpost`, which also marks the card active.

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
BIRTHDAY_ROLE_ID=role_id
BIRTHDAY_CARD_ENABLED=true
```

Needed for Player Cards:

```env
PLAYER_DIRECTORY_CHANNEL_ID=channel_id
```

## Asset Path

The player card background must be here:

```txt
assets/cards/backgrounds/player-card-bg.png
```
