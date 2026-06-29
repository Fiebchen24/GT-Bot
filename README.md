# GT Role Bot V8.0

GitHub + Render ready.

## Enthalten

- Role commands
  - `/giverolefromchannel`
  - `/takerolefromchannel`
  - `/earningsroles`
- Cup checks
  - `/checksignup`
  - `/postcupcheck`
- Voice channel commands
  - `/voicechannelcreate`
  - `/voicechanneldelete`
  - `/voicechanneldeleteall`
- Event bans
  - `/eventbanadd`
  - `/eventbanfromchannel`
  - `/eventbanremove`
  - `/eventbanlist`
- Fortnite ICS calendar
  - `/fortniteevents`
  - `/fortniteeventstoday`
  - `/fortniteeventspost`
  - `/fortniteeventsgrouped`
  - Auto morning post via config/env
- Twitch live notifications
  - `/twitchwatchadd`
  - `/twitchwatchremove`
  - `/twitchwatchlist`
- Birthdays
  - `/birthdayset`
  - `/birthdayremove`
  - `/birthdaynext`
  - `/birthdaylist`
- GT Player Cards
  - `/playercreate`
  - `/playeredit`
  - `/playerdelete`
  - `/playerpost`
  - `/playerlist`
  - fixed GT IDs like `GT-001`
  - social buttons for Twitch, TikTok, X and YouTube
  - directory channel via `PLAYER_DIRECTORY_CHANNEL_ID`

## Render Environment Variables

Required:

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
GUILD_ID=your_discord_server_id
```

Recommended:

```env
DATABASE_URL=your_postgres_url
DATABASE_SSL=true
BIRTHDAY_CHANNEL_ID=your_birthday_channel_id
PLAYER_DIRECTORY_CHANNEL_ID=your_player_directory_channel_id
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
FORTNITE_CALENDAR_ICS_URL=your_ics_url
AUTO_FORTNITE_EVENTS_ENABLED=true
AUTO_FORTNITE_EVENTS_CHANNEL_ID=your_calendar_channel_id
AUTO_FORTNITE_EVENTS_TIME=09:00
AUTO_FORTNITE_EVENTS_TIMEZONE=Europe/Berlin
AUTO_FORTNITE_EVENTS_REGION=ALL
AUTO_FORTNITE_EVENTS_DAYS=1
```

## PostgreSQL Tables

The bot creates these tables automatically:

- `gt_birthdays`
- `gt_twitch_watchers`
- `gt_players`

If `DATABASE_URL` is missing, the bot falls back to local JSON files where possible. On Render this is not permanent after rebuilds, so PostgreSQL is recommended.

## Deploy

1. Replace files in GitHub.
2. Do not upload `.env`.
3. Commit.
4. Render -> Manual Deploy -> Clear build cache & deploy.
5. Log should show:

```txt
GT ROLE BOT V8.0 LOADED
```
