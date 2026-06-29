# GT Role Bot V8.3

GT Utility Bot with GT Cards v2.

## New in V8.3

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

This V8.3 zip already contains the background you uploaded in this chat.

## Deploy

1. Replace all GitHub files with this version.
2. Commit.
3. Render → Manual Deploy → Clear build cache & deploy.
4. Logs should show:

```txt
GT ROLE BOT V8.3 LOADED
Player card storage: PostgreSQL database connected.
```


## V8.3 Player Card fixes
- Country is rendered as a clean country-code badge instead of broken emoji flags.
- Long roster labels are automatically fitted/wrapped.
- Earnings/PR panels are hidden when the value is 0 or empty.
- Social panel moves up when no stats are shown.
- Social link buttons remain under the card for all saved socials.


## V8.3 Player Card polish
- Social rows are kept above the integrated footer/logo area.
- Roster label is now the main text in the avatar panel.
- GT-ID is smaller and shown below the roster label.

## V8.3 Player Card update

- GT-ID can now be set manually on `/playercreate` with `gt_id`.
- GT-ID can now be changed later on `/playeredit` with `gt_id`.
- Accepted formats: `GT-001`, `GT 001`, or `1`.
- Duplicate GT-IDs are blocked per server.
- GT Owner accent color is now white instead of black.


## V8.5 Birthday Upgrade

New birthday features:

- automatic birthday message with ping
- optional temporary birthday role for 24 hours
- automatic removal of the birthday role after expiry
- optional GT birthday card based on the player's GT Player Card design

Required/optional environment variables:

```env
BIRTHDAY_CHANNEL_ID=your_birthday_channel_id
BIRTHDAY_ROLE_ID=your_birthday_role_id
BIRTHDAY_CARD_ENABLED=true
```

`BIRTHDAY_ROLE_ID` is optional. If it is set, the bot gives that role on the birthday and removes it automatically after 24 hours.

The birthday card is sent automatically when the birthday user has an active GT Player Card. If no card exists, the bot sends the normal birthday text message.


## V8.5 Player Card changes

- `/playeredit` keeps all existing values when you only edit selected fields.
- Roster option renamed to `GT Co-owner`. Existing `GT Coowner` cards still render as `GT CO-OWNER`.
- GT-ID is smaller; card headings are larger.
- Added optional `fortnitetracker` field for `/playercreate` and `/playeredit`.
- Fortnite Tracker appears as a button below the card, not inside the card footer.
