const SteamUser = require("steam-user"),
    SteamAuth = require("steamauth"),
    util = require("util"),
    fs = require("fs"),
    SteamStore = require('steam-store');

var logStream = fs.createWriteStream("log.txt", { "flags": "a" });
var log = console.log;
console.log = function() {
    var first_parameter = arguments[0];
    var other_parameters = Array.prototype.slice.call(arguments, 1);

    function formatConsoleDate(date) {
        var day = date.getDate();
        var month = date.getMonth() + 1;
        var year = date.getFullYear();
        var hour = date.getHours();
        var minutes = date.getMinutes();
        var seconds = date.getSeconds();
        var milliseconds = date.getMilliseconds();
        return "[" + ((day < 10) ? "0" + day : day) +
            "-" + ((month < 10) ? "0" + month : month) +
            "-" + ((year < 10) ? "0" + year : year) +
            " " + ((hour < 10) ? "0" + hour : hour) +
            ":" + ((minutes < 10) ? "0" + minutes : minutes) +
            ":" + ((seconds < 10) ? "0" + seconds : seconds) +
            "." + ("00" + milliseconds).slice(-3) + "] ";
    }
    var tolog = [formatConsoleDate(new Date()), first_parameter].concat(other_parameters);
    var str = "";
    tolog.forEach(function(arg) {
        str += (typeof arg === "string" ? arg : util.inspect(arg, false, null)) + " ";
    });
    str.slice(0, -1);
    logStream.write(str + "\r\n");
    log.apply(console, [str]);
};

const config = JSON.parse(fs.readFileSync("config.json"));
const client = new SteamUser({
    enablePicsCache: true,
    changelistUpdateInterval: 200,
    picsCacheAll: true
});
const store = new SteamStore({
  country:  'DE',
  language: 'en'
});

var ownedPackages = [],
    fodQueue = [],
    fodRequested = 0,
    mycountry = "US",
    genres = ['Free to Play', 'genre_demos'];

setInterval(function() {
    fodRequested = 0;
    if (fodQueue.length > 0) {
        for (var i = 0; i < fodQueue.length && i <= 50; i++) {
            requestFreeSub(fodQueue.pop());
        }
    }
}, 3600000);

if (config.winauth_usage) {
    const SteamAuth = require("steamauth");
    SteamAuth.Sync(function(error) {
        if (error) console.log(error);
        var auth = new SteamAuth(config.winauth_data);
        auth.once("ready", function() {
            config.steam_credentials.twoFactorCode = auth.calculateCode();
            steamLogin();
        });
    });
} else {
    steamLogin();
}

function steamLogin() {
    config.steam_credentials.rememberPassword = true;
    config.steam_credentials.logonID = Date.now();
    client.logOn(config.steam_credentials);
    //client.on("loggedOn", function(response) {});
    client.on("error", function(error) {
        console.log(error);
    });
    client.on("accountInfo", function(name, country) {
        console.log("Logged into Steam as \"" + name + "\" " + client.steamID.getSteam3RenderedID() + " from " + country);
        mycountry = country;
        /* store.steam('getGenreList').then(function (results) {
          var len = results.genres.length;
          for (var i = 0; i < len; i++) {
            genres.push(results.genres[i].id);
          }
          console.log("Status: " + (results.status ? "Success" : "Error") + " | Genres (" + genres.length + "): " + genres.join(", "));
        }); */
        var glen = genres.length;
        for (var g = 0; g < glen; g++) {
          store.steam('getAppsInGenre', genres[g]).then(function (results) {
            var len = 0;
            var ilen = Object.keys(results.tabs).length;
            for (var i in results.tabs) {
              if (!results.tabs.hasOwnProperty(i)) { continue; }
              var elen = results.tabs[i].items.length;
              len = len + elen;
              for (var e = 0; e < elen; e++) {
                var id = results.tabs[i].items[e].id;
                requestSub(id, true);
              }
            }
            console.log("Status: " + (results.status ? "Success" : "Error") + " | Found " + len + " apps in genre " + results.name);
          });
        }
    });
    client.on("packageUpdate", function(packageid, data) {
        console.log("Received PICS Update " + data.changenumber + " for Package " + packageid + " with appids: " + data.packageinfo.appids.join());
        if (!ownedPackages.includes(packageid) &&
            data.packageinfo.licensetype === 1 && // Single Purchase
            data.packageinfo.status === 0 && // Available
            (data.packageinfo.billingtype === 12 || data.packageinfo.billingtype === 0) && // NoCost or FreeOnDemand
            (data.packageinfo.extended.purchaserestrictedcountries ? !data.packageinfo.extended.purchaserestrictedcountries.includes(mycountry) : true) &&
            (data.packageinfo.ExpiryTime ? data.packageinfo.ExpiryTime > Math.round(Date.now() / 1000) : true) &&
            (data.packageinfo.StartTime ? data.packageinfo.StartTime < Math.round(Date.now() / 1000) : true) &&
            (data.packageinfo.DontGrantIfAppIDOwned ? !client.ownsApp(data.packageinfo.DontGrantIfAppIDOwned) : true) &&
            (data.packageinfo.RequiredAppID ? client.ownsApp(data.packageinfo.RequiredAppID) : true)) {
                requestSub(packageid);
        }
    });
    client.on("licenses", function(licenses) {
        console.log("Our account owns " + licenses.length + " license" + numberEnding(licenses.length) + " in " + ownedPackages.length + " cached package" + numberEnding(ownedPackages.length));
        licenses.forEach(function(license) {
            if (!ownedPackages.includes(license.package_id)) {
                ownedPackages.push(license.package_id);
            }
        });
    });
}

function requestSub(packageid, silent=false){
    if (client.ownsApp(packageid)) { return; }
    if (fodRequested <= 50) {
        requestFreeSub(packageid, silent);
    } else {
        fodQueue.push(packageid);
    }
}

function requestFreeSub(packageid, silent=false) {
    if(!silent) { console.log("Attempting to request package id " + packageid); }
    fodRequested++;
    client.requestFreeLicense(packageid, function(error, grantedPackages, grantedAppIDs) {
        if (error) {
            console.log(error)
        } else {
            if (grantedPackages.length === 0) {
                if(!silent) { console.log("No new packages were granted to our account"); }
            } else {
                console.log(grantedPackages.length + " New package" + numberEnding(grantedPackages.length) + " (" + grantedPackages.join() + ") were successfully granted to our account");
                if (!ownedPackages.includes(packageid) && grantedPackages.includes(packageid)) {
                    ownedPackages.push(packageid);
                }
            }
            if (grantedAppIDs.length === 0) {
                if(!silent) { console.log("No new apps were granted to our account"); }
            } else {
                console.log(grantedAppIDs.length + " New app" + numberEnding(grantedAppIDs.length) + " (" + grantedAppIDs.join() + ") were successfully granted to our account");
            }
        }
    });
}

function millisecondsToStr(milliseconds) {
    var temp = Math.floor(milliseconds / 1000);
    var years = Math.floor(temp / 31536000);
    if (years) {
        return years + " year" + numberEnding(years);
    }
    var days = Math.floor((temp %= 31536000) / 86400);
    if (days) {
        return days + " day" + numberEnding(days);
    }
    var hours = Math.floor((temp %= 86400) / 3600);
    if (hours) {
        return hours + " hour" + numberEnding(hours);
    }
    var minutes = Math.floor((temp %= 3600) / 60);
    if (minutes) {
        return minutes + " minute" + numberEnding(minutes);
    }
    var seconds = temp % 60;
    if (seconds) {
        return seconds + " second" + numberEnding(seconds);
    }
    return "less than a second";
}

function numberEnding(number) {
    return (number > 1 || number == 0) ? "s" : "";
}
