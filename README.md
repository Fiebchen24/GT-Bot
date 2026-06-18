# GT Role Bot V7.4

GT utility bot for Discord.

## Features

- Give role from channel
- Take role from channel
- Earnings role updates
- Pre-cup signup check with Twitch links or DC proof
- Post-cup Twitch/VOD proof check
- Voice channel create/delete/delete all
- Event bans with automatic expiry and log channel
- Fortnite ICS calendar commands and automatic morning posts
- Twitch live notifications

## Required Render environment variables

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
GUILD_ID=your_discord_server_id
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
```

Optional:

```env
FORTNITE_CALENDAR_ICS_URL=your_ics_url
AUTO_FORTNITE_EVENTS_ENABLED=true
AUTO_FORTNITE_EVENTS_CHANNEL_ID=your_channel_id
AUTO_FORTNITE_EVENTS_TIME=09:00
AUTO_FORTNITE_EVENTS_TIMEZONE=Europe/Berlin
AUTO_FORTNITE_EVENTS_REGION=ALL
AUTO_FORTNITE_EVENTS_DAYS=1
TWITCH_NOTIFY_INTERVAL_SECONDS=60
```

## Twitch live notification commands

```txt
/twitchwatchadd username:fiebchen channel:#live-now
/twitchwatchremove username:fiebchen
/twitchwatchlist
```

The bot checks watched Twitch channels every 60 seconds by default. It posts only when a watched channel changes from offline to live or starts a new stream.

You can also configure permanent watchers in `config.json`:

```json
"twitchLiveNotifications": {
  "intervalSeconds": 60,
  "watchers": [
    { "username": "fiebchen", "channelId": "DISCORD_CHANNEL_ID" }
  ]
}
```

## Deploy

1. Replace the files in GitHub.
2. Commit changes.
3. Render → Manual Deploy → Clear build cache & deploy.
4. Log should show:

```txt
GT ROLE BOT V7.4 LOADED
```
