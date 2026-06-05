# GT Role Bot V6.4

Render-ready Discord bot.

## Deploy

1. Upload all files except `.env` to GitHub.
2. In Render Background Worker, set environment variables:
   - TOKEN
   - CLIENT_ID
   - GUILD_ID
   - TWITCH_CLIENT_ID
   - TWITCH_CLIENT_SECRET
3. Build command: `npm install`
4. Start command: `npm start`
5. Use **Clear build cache & deploy**.

The Render log must show:

```txt
GT ROLE BOT V6.4 LOADED
```

## Commands

- `/checksignup` pre-cup sign-in team check. One sign-in message = one team. One proof per team is enough.
- `/postcupcheck` post-cup Twitch live/VOD check.
- `/voicechannelcreate` create multiple voice channels in a category.
- `/voicechanneldelete` delete a selected voice channel.
- `/giverolefromchannel`
- `/takerolefromchannel`
- `/earningsroles`

## DC proof

These count as proof:

```txt
@Player DC
@Player DC ss
PlayerName DC
PlayerName DC ss
```


## V6.8
- Added `/voicechanneldeleteall` to delete all voice channels in a selected category.
- Optional `name_prefix` lets you delete only channels starting with a specific base name.


## Event bans

Commands:

- `/eventbanadd user role until_date days reason` — gives one user an event-ban role. Use either `until_date` (`YYYY-MM-DD` or `DD.MM.YYYY`) or `days`. If both are empty, it defaults to 30 days.
- `/eventbanfromchannel channel role until_date days limit reason` — gives the event-ban role to everyone mentioned in a channel.
- `/eventbanremove user role` — removes the event-ban role and deletes the saved expiry.
- `/eventbanlist role` — shows saved active event bans.

The bot checks expired bans every minute and removes the role automatically.


## V6.8 Event Ban Expiry Logs

Event bans are automatically checked every minute. When a ban expires, the bot removes the role automatically. You can set a log channel per command with `log_channel`, or set `eventBanLogChannelId` in `config.json` as the default log channel.


## GT Role Bot v7.0 - Calendar System

New commands:

- `/calendar` - Shows the current GT competitive calendar.
- `/calendaradd` - Adds a Fortnite Cup, GT Event, Partner Event, Scrims or Other event.
- `/calendarremove` - Removes an event by ID.
- `/calendarlist` - Lists saved events with IDs.
- `/calendarpost` - Posts or updates the calendar embed in the configured calendar channel.

Required env values:

```env
CALENDAR_CHANNEL_ID=your_fortnite_calendar_channel_id
TOURNAMENT_ALERT_ROLE_ID=your_tournament_alert_role_id
```

The bot updates the calendar message automatically when it starts and every 6 hours.
Times are shown as CET/CEST for GT.
