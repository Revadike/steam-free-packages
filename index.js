'use strict';

global._mckay_statistics_opt_out = true;

const SteamAuth = require('steamauth');
const SteamUser = require('steam-user');
const util = require('util');
const fs = require('fsxt');
const request = require('request-promise-any');

var logStream = fs.createWriteStream('log.txt', {
  'flags': 'a'
});
logStream.write('\r\n--- Beginning of stream ' + new Date() + '---\r\n');

function unzip(arr) {
  const elements = arr.length;
  const len = arr[0].length;
  const final = [];

  for (let i = 0; i < len; i++) {
    const temp = [];
    for (let j = 0; j < elements; j++) {
      temp.push(arr[j][i]);
    }
    final.push(temp);
  }

  return final;
}

function secsNow() {
  return Math.round(Date.now() / 1000);
}

function formatConsoleDate(date = new Date()) {
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  return '[' + ((hour < 10) ? '0' + hour : hour) +
    ':' + ((minutes < 10) ? '0' + minutes : minutes) +
    ':' + ((seconds < 10) ? '0' + seconds : seconds) + ']';
}

function log(first, ...others) {
  var tolog = [formatConsoleDate(), first, ...others];
  var strs = [];
  tolog.forEach(arg => {
    strs.push((typeof arg === 'string' ? arg : util.inspect(arg, false, null)));
  });
  const out = strs.join(' ');
  logStream.write(out + '\r\n');
  console.log(out);
}

const {steamCredentials, useWinauth, winauthCredentials} = fs.readJsonSync('config.json');
const client = new SteamUser({
  enablePicsCache: true,
  changelistUpdateInterval: 200,
  picsCacheAll: true
});

const owned = new Set();
const fodQueue = []; // can't be Set since you can't pop a Set
let mycountry = 'US';

async function runFreeSubs() {
  const startTime = new Date().getTime();
  const len = fodQueue.length;
  if (len > 0) {
    for (let i = 0; i < len && i <= 50; i++) {
      await requestFreeSub(fodQueue.pop());
    }
  }
  const endTime = new Date().getTime();
  setTimeout(runFreeSubs, 3600000 - Math.max(0, endTime - startTime));
}
// no need - is ran on logon
//setTimeout(runFreeSubs, 3600000);

if (useWinauth) {
  SteamAuth.Sync(error => {
    if (error) {
      log('Winauth Authentication failed!');
      log(error);
      process.exit(1);
    }
    const auth = new SteamAuth(winauthCredentials);
    auth.once('ready', () => {
      steamCredentials.twoFactorCode = auth.calculateCode();
      steamLogin();
    });
  });
} else {
  steamLogin();
}

function steamLogin() {
  steamCredentials.rememberPassword = true;
  steamCredentials.logonID = Date.now();
  client.logOn(steamCredentials);
  client.on('loggedOn', () => {
    log('Logged into Steam as ' + client.steamID.getSteam3RenderedID());
    runFreeSubs();
  });
  client.on('error', error => {
    log(error);
  });
  client.on('accountInfo', (_, country) => {
    mycountry = country;
  });

  // Emitted when a package that was already in our cache updates.
  // The picsCache property is updated after this is emitted, so you can get the previous package data via picsCache.packages[packageid].
  //
  // according to https://github.com/DoctorMcKay/node-steam-user/blob/dbaaac411f704358ef33ef796d7e9df2d4da5282/components/apps.js#L179
  // this *is* emitted when a new package is found so yeah
  client.on('packageUpdate', (packageId, data) => {
    log('Received PICS Update for Package ' + packageId);
    log(data);

    if (owned.has(packageId)) return;
    if (fodQueue.includes(packageId)) return;

    const pkg = data.packageinfo;

    if (pkg.licensetype !== 1) return; // Single Purchase
    if (pkg.status !== 0) return; // Available
    if (pkg.billingtype !== 12 && pkg.billingtype !== 0) return; // NoCost or FreeOnDemand
    if (pkg.extended.purchaserestrictedcountries && pkg.extended.purchaserestrictedcountries.includes(mycountry)) return;
    if (pkg.ExpiryTime && pkg.ExpiryTime <= secsNow()) return;
    if (pkg.StartTime && pkg.StartTime >= secsNow()) return;
    if (pkg.DontGrantIfAppIDOwned && client.ownsApp(pkg.DontGrantIfAppIDOwned)) return;
    if (pkg.RequiredAppID && !client.ownsApp(pkg.RequiredAppID)) return;

    fodQueue.push(packageId);
  });

  // Contains the license data for the packages which your Steam account owns. To see license object structure, see CMsgClientLicenseList.License.
  // Emitted on logon and when licenses change. The licenses property will be updated after this event is emitted.
  client.on('licenses', licenses => {
    log('Our account owns ' + licenses.length + ' license(s)');
    for (let license of licenses) {
      owned.add(license.package_id);
    }
  });

  // do stuff with picsCache???
  /*setTimeout(async function _f() {
    log('Begin request freepackages info');
    const body = await request('https://steamdb.info/freepackages/');

    const re       = /data-subid="([0-9]+)" data-appid="([0-9]+)"/g;
    const reSingle = /data-subid="([0-9]+)" data-appid="([0-9]+)"/;
    const packagesApps = unzip(body.match(re).map(e => e.match(reSingle).slice(1)));
    client.getProductInfo(packagesApps[1], packagesApps[0], false, () => {
      log('PICS update should go out now!');

      setTimeout(_f, 10000);
    });
  }, 10000);*/
}

function requestFreeSub(pkg) {
  return new Promise(resolve => {
    log('Attempting to request package id ' + pkg);
    client.requestFreeLicense(pkg, (error, granted, grantedAppIDs) => {
      if (error) {
        log(error);
      }
      if (granted.length === 0) {
        log('No new packages were granted to our account');
      } else {
        log(granted.length + ' New package(s) (' + granted.join(',') + ') were successfully granted to our account');
        for (let g of granted) {
          owned.add(g);
        }
      }
      if (grantedAppIDs.length === 0) {
        log('No new apps were granted to our account');
      } else {
        log(grantedAppIDs.length + ' New app(s) (' + grantedAppIDs.join(',') + ') were successfully granted to our account');
      }
      resolve();
    });
  });
}