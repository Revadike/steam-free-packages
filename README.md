# steam-free-apps
steam-free-apps (working title) is a NodeJS application used to periodically request free apps on steam to be added to your account (50 per 30 mins).

Made as replacement for the deprecated free licenses script provided by SteamDB.

That script no longer works due to Valve's recent changes that added rate restrictions.

For now steam-free-apps only works with accounts that use [WinAuth](https://winauth.com/). I'll probably add proper support for more steam authentication methods in the future. To use the nodejs script:

1. Download and Install [NodeJS](https://nodejs.org/en/)
2. Use NPM (npm install x) to get these packages: steamauth, steam-user, jsdom, jquery, request, cloudscraper
3. Edit the main script (requestFreeApps.js) in a text editor and change the values in the CONFIGURATION section.
4. Start the bot, like this: node requestFreeApps.js

Good luck!
