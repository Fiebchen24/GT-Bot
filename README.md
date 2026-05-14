# GT Role Bot

Small Discord bot for role management.

## Features

- `/giverolefromchannel` gives a selected role to everyone mentioned in a selected channel.
- `/takerolefromchannel` removes a selected role from everyone mentioned in a selected channel.
- `/earningsroles` reads mentions + earnings numbers and updates the matching earnings role.
- Old earnings roles are removed before the new earnings role is added.

## Example earnings messages

```txt
@Player1 250
@Player2 $1,500
@Player3 5k
```

## Setup

1. Upload all files to GitHub.
2. Rename `.env.example` to `.env` locally if testing on your PC.
3. Add your real values:

```env
TOKEN=YOUR_DISCORD_BOT_TOKEN
CLIENT_ID=YOUR_APPLICATION_CLIENT_ID
GUILD_ID=YOUR_DISCORD_SERVER_ID
```

4. Edit `config.json` and replace the earnings role IDs with your real Discord role IDs.

## Render setup

Use these settings:

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`

Add these environment variables in Render:

- `TOKEN`
- `CLIENT_ID`
- `GUILD_ID`

## Important Discord settings

In the Discord Developer Portal, enable:

- Server Members Intent
- Message Content Intent

The bot role must be above all roles it should give or remove.


## V2 Update

- `/giverolefromchannel` checks first if a member already has the selected role.
- `/takerolefromchannel` checks first if a member does not have the selected role.
- `/earningsroles` updates earnings roles intelligently:
  - removes old earnings roles only when needed
  - adds the correct new earnings role
  - skips users who already have the correct earnings role

Example result:

```txt
Done.
Role: @Role
Users found: 10
Newly added: 6
Already had role: 4
Failed: 0
```
