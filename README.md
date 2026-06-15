# GT Role Bot V7.0

Render-ready Discord bot for GT.

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
GT ROLE BOT V7.0 LOADED
```

## Commands

### Roles
- `/giverolefromchannel`
- `/takerolefromchannel`
- `/earningsroles`

### Cup checks
- `/checksignup` pre-cup sign-in team check. One sign-in message = one team. One proof per team is enough.
- `/postcupcheck` post-cup Twitch live/VOD check.

### Voice channels
- `/voicechannelcreate` create multiple voice channels in a category.
- `/voicechanneldelete` delete a selected voice channel.
- `/voicechanneldeleteall` delete all voice channels in a selected category.

### Event bans
- `/eventbanadd`
- `/eventbanfromchannel`
- `/eventbanremove`
- `/eventbanlist`

Event bans are automatically checked every minute. When a ban expires, the bot removes the role automatically and can log it.

### Fortnite Calendar
- `/fortniteevents` shows upcoming Fortnite events from the ICS calendar.
- `/fortniteeventstoday` shows today's Fortnite events.
- `/fortniteeventspost` posts upcoming events to the configured calendar channel or to a selected channel.

In `config.json`:

```json
"fortniteCalendarIcsUrl": "https://fortnitetracker.com/events.ics?",
"fortniteCalendarChannelId": "YOUR_CALENDAR_CHANNEL_ID",
"fortniteCalendarTimeZone": "Europe/Berlin"
```

If `fortniteCalendarChannelId` is empty, use `/fortniteeventspost channel:#your-calendar-channel`.

## DC proof

These count as proof:

```txt
@Player DC
@Player DC ss
PlayerName DC
PlayerName DC ss
```


## Fortnite Calendar Auto Post

The bot posts today's Fortnite events automatically every day into the configured calendar channel.

Configured in `config.json`:

```json
"fortniteCalendarChannelId": "1512404881028284578",
"fortniteCalendarAutoPost": true,
"fortniteCalendarAutoPostHour": 9,
"fortniteCalendarAutoPostMinute": 0,
"fortniteCalendarTimeZone": "Europe/Berlin"
```

Default: daily at 09:00 Europe/Berlin.
