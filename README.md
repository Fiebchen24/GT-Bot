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


## V6.6
- Added `/voicechanneldeleteall` to delete all voice channels in a selected category.
- Optional `name_prefix` lets you delete only channels starting with a specific base name.
