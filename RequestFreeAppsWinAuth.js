//CONFIGURATION
var steamcred = {
    "accountName": "YOUR_STEAM_USERNAME", // Your steam login name
    "password": "YOUR_STEAM_PASSWORD" // Your steam login password
},
winauth = { 
    deviceid: "YOUR_WINAUTH_DEVICEID",
    shared_secret: "YOUR_WINAUTH_SHARED_SECRET",
    identity_secret: "YOUR_WINAUTH_IDENTITY_SECRET"
},
steamdbcookie = "YOUR_STEAMDB_COOKIE", // Value of cookie named "steamdb" from steamdb.info
delay = 1800000, // Delay per cycle (default 30 minutes)
maxApps = 50; // Max number of apps to request per cycle (default 50 apps)

//CODE
var SteamAuth = require("steamauth"),
SteamUser = require("steam-user"),
jsdom = require("jsdom"),
$ = require("jquery")(jsdom.jsdom().defaultView),
request = require("request"),
CloudScraper = require("cloudscraper");
var client = new SteamUser({
        enablePicsCache: true
    });
var appOwnershipCached = false;
SteamAuth.Sync(function(error) {
    if (error)
        console.log(logDate(), error);
    var auth = new SteamAuth(winauth);
    auth.once("ready", function() {
        steamcred.authCode = steamcred.twoFactorCode = auth.calculateCode();
        steamcred.rememberPassword = true;
        client.logOn(steamcred);
        client.on("loggedOn", function(response) {
            console.log(logDate() + "Logged into Steam as " + client.steamID.getSteam3RenderedID());
            client.setPersona(SteamUser.EPersonaState.Online);
        });
        client.on("error", function(error) {
            console.log(logDate(), error);
        });
        client.on("accountLimitations", function(limited, communityBanned, locked, canInviteFriends) {
            var limitations = [];
            if (limited) {
                limitations.push("limited");
            }
            if (communityBanned) {
                limitations.push("community banned");
            }
            if (locked) {
                limitations.push("locked");
            }
            if (limitations.length === 0) {
                console.log(logDate() + "Our account has no limitations");
            } else {
                console.log(logDate() + "Our account is " + limitations.join(", "));
            }
            if (canInviteFriends) {
                console.log(logDate() + "Our account can invite friends");
            }
        });
        client.on("vacBans", function(numBans, appids) {
            console.log(logDate() + "We have " + numBans + " VAC ban" + numberEnding(numBans.length));
            if (appids.length > 0) {
                console.log(logDate() + "We are VAC banned from app" + numberEnding(appids.length) + ": " + appids.join(", "));
            }
        });
        client.on("licenses", function(licenses) {
            console.log(logDate() + "Our account owns " + licenses.length + " license" + numberEnding(licenses.length));
        });
        client.on("appOwnershipCached", function() {
            console.log(logDate() + "Cached app ownership");
            if (!appOwnershipCached) {
                appOwnershipCached = true;
                var ownedApps = client.getOwnedApps();
                console.log(logDate() + "Our account owns " + ownedApps.length + " app" + numberEnding(ownedApps.length));
                var jar = request.jar();
                var cookie = request.cookie("steamdb=" + steamdbcookie);
                jar.setCookie(cookie, "https://steamdb.info/");
                CloudScraper.request({
                    url: "https://steamdb.info/search/?a=app_keynames&type=-1&keyname=243&operator=3&keyvalue=1",
                    method: "GET",
                    jar: jar
                }, function(error, response, data) {
                    if (error) {
                        console.log(logDate(), error);
                    } else {
                        var freeApps = [];
                        $("#table-sortable a", data).each(function() {
                            freeApps.push(parseInt($(this).text().trim()));
                        });
                        var unownedFreeApps = $(freeApps).not(ownedApps);
                        console.log(logDate() + "Found " + freeApps.length + " free app" + numberEnding(freeApps.length) + " of which " + unownedFreeApps.length + " are not owned by us yet");
                        requestFreeApps(client, unownedFreeApps);
                    }
                });
            }
        });
    });
});

function requestFreeApps(client, unownedFreeApps) {
    if (unownedFreeApps.length > 0) {
        var appsToAdd = unownedFreeApps.splice(0, maxApps);
        console.log(logDate() + "Attempting to request " + appsToAdd.length + " apps (" + appsToAdd.join() + ")");
        client.requestFreeLicense(appsToAdd, function(error, grantedPackages, grantedAppIDs) {
            if (error) {
                console.log(logDate(), error)
            } else {
                if (grantedPackages.length === 0) {
                    console.log(logDate() + "No packages were granted to our account");
                } else {
                    console.log(logDate() + grantedPackages.length + " New package" + numberEnding(grantedPackages.length) + " (" + grantedPackages.join() + ") were successfully granted to our account");
                }
                if (grantedAppIDs.length === 0) {
                    console.log(logDate() + "No apps were granted to our account");
                } else {
                    console.log(logDate() + grantedAppIDs.length + " New app " + numberEnding(grantedAppIDs.length) + " (" + grantedAppIDs.join() + ") were successfully granted to our account");
                }
                console.log(logDate() + "Waiting " + millisecondsToStr(delay) + " for a new attempt");
                setTimeout(function() {
                    requestFreeApps(client, unownedFreeApps)
                }, delay);
            }
        });
    } else {
        appOwnershipCached = false;
        client.relog();
    }
}

function logDate() {
    return (new Date()).toUTCString() + " | ";
}

function millisecondsToStr(milliseconds) {
    var temp = Math.floor(milliseconds / 1000);
    var years = Math.floor(temp / 31536000);
    if (years) {
        return years + ' year' + numberEnding(years);
    }
    //TODO: Months! Maybe weeks?
    var days = Math.floor((temp %= 31536000) / 86400);
    if (days) {
        return days + ' day' + numberEnding(days);
    }
    var hours = Math.floor((temp %= 86400) / 3600);
    if (hours) {
        return hours + ' hour' + numberEnding(hours);
    }
    var minutes = Math.floor((temp %= 3600) / 60);
    if (minutes) {
        return minutes + ' minute' + numberEnding(minutes);
    }
    var seconds = temp % 60;
    if (seconds) {
        return seconds + ' second' + numberEnding(seconds);
    }
    return 'less than a second'; //'just now' //or other string you like;
}

function numberEnding(number) {
    return (number > 1) ? 's' : '';
}
