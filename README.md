# steam-free-apps
steam-free-apps (working title) is a NodeJS application used to periodically request free apps on steam to be added to your account (50 per 30 mins).

Made as replacement for the deprecated free licenses script provided by SteamDB.

That script no longer works due to Valve's recent changes that added rate restrictions.

To use steam-free-apps:

1. Download and Install [NodeJS](https://nodejs.org/en/)
2. Use NPM (npm install PACKAGE_NAME) to get these packages: steamauth, steam-user, jsdom, jquery, request, cloudscraper
3. Edit the main script (RequestFreeApps.js) in a text editor and change the values in the CONFIGURATION section.
4. Start the bot, like this: node RequestFreeApps.js

Good luck!
