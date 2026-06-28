# GT Role Bot V7.7

Render/GitHub-ready Discord utility bot for GT.

## New in V7.7

Twitch live notification watches are now saved in local JSON files when `DATABASE_URL` is set.

This fixes the issue where the bot loses Twitch watch data after Render redeploys or restarts.

The bot now uses the database for:

- Birthdays
- Twitch live notification watchlist

## Required Render env

```env
TOKEN=
CLIENT_ID=
GUILD_ID=
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
FORTNITE_CALENDAR_ICS_URL=
BIRTHDAY_CHANNEL_ID=
DATABASE_URL=
```

Optional:

```env
TWITCH_NOTIFY_INTERVAL_SECONDS=60
AUTO_FORTNITE_EVENTS_ENABLED=true
AUTO_FORTNITE_EVENTS_CHANNEL_ID=
AUTO_FORTNITE_EVENTS_TIME=09:00
AUTO_FORTNITE_EVENTS_TIMEZONE=Europe/Berlin
AUTO_FORTNITE_EVENTS_REGION=ALL
AUTO_FORTNITE_EVENTS_DAYS=1
```

## Twitch live notifications

Commands:

```txt
/twitchwatchadd username:fiebchen channel:#live-now
/twitchwatchremove username:fiebchen
/twitchwatchlist
```

After V7.7, watches stay saved after redeploys as long as `DATABASE_URL` is configured.

If your old watches were stored only in Render's temporary `twitchWatch.json`, they may need to be added once again with `/twitchwatchadd`.
After that, they stay in the database.

## Birthday system

Players can save their own birthday:

```txt
/birthdayset day:24 month:6 year:1999 timezone:Europe/Berlin reminder_time:09:00
```

The year is optional.

## Existing features

- Role from channel
- Take role from channel
- Earnings role updates
- Pre-cup sign-in vs Twitch/DC proof check
- Post-cup Twitch/VOD proof check
- Voice channel create/delete/delete all
- Event bans with auto-remove and logs
- Fortnite ICS calendar + grouped auto posts
- Twitch live notifications
- Birthday reminders with timezone support

## Start

```bash
npm install
npm start
```
