# GT Role Bot V8.7.6

GT Utility Bot with GT Cards v2 and player self-service requests.

## New in V8.7.6

- Players can create/update their own card request with `/playerrequest`
- Self-created cards are saved as `pending`
- Staff can review with `/playercard` and `/playerpending`
- Staff posts and approves with `/playerpost`
- Existing staff commands remain: `/playercreate`, `/playeredit`, `/playerdelete`, `/playerlist`
- Roster text on the card was moved slightly down for better balance in the left panel
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


## V8.7.6 Patch

- Roster label moved slightly down on the player card.
- GT-ID remains below the roster label.
- Birthday card round-rect helper alias added for stability.

Expected Render log:

```txt
GT ROLE BOT V8.7.6 LOADED
```


## V8.7.6
- Fixes Player Card post button URL errors more aggressively.
- Invalid button URLs are skipped.
- If Discord still rejects buttons, the card is posted without buttons instead of failing.


## V8.7.6
- Roster label moved lower in the left player card panel.
- GT-ID moved lower to keep spacing balanced.
