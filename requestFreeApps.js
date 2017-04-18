//CONFIGURATION
var steamcred = {
    "accountName": "YOUR_STEAM_USERNAME",
    "password": "YOUR_STEAM_PASSWORD"
},
winauth = { //For now only support winauth, sorry. Feel free to modify to suit your own authenication method.
    deviceid: "YOUR_WINAUTH_DEVICEID",
    shared_secret: "YOUR_WINAUTH_SHARED_SECRET",
    identity_secret: "YOUR_WINAUTH_IDENTITY_SECRET"
},
steamdbcookie = "YOUR_STEAMDB_COOKIE";

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
SteamAuth.Sync(function(error) {
    var auth = new SteamAuth(winauth);
    auth.once("ready", function() {
        var appOwnershipCached = false;
        steamcred.rememberPassword = true;
        steamcred.authCode = steamcred.twoFactorCode = auth.calculateCode();
        client.logOn(steamcred);
        client.on("loggedOn", function(response) {
            console.log("Logged into Steam as " + client.steamID.getSteam3RenderedID());
            client.setPersona(SteamUser.EPersonaState.Online);
        });
        client.on("error", function(error) {
            console.log(error);
        });
        client.on("accountLimitations", function(limited, communityBanned, locked, canInviteFriends) {
            var limitations = [];
            if (limited) {
                limitations.push("LIMITED");
            }
            if (communityBanned) {
                limitations.push("COMMUNITY BANNED");
            }
            if (locked) {
                limitations.push("LOCKED");
            }
            if (limitations.length === 0) {
                console.log("Our account has no limitations.");
            } else {
                console.log("Our account is " + limitations.join(", ") + ".");
            }
            if (canInviteFriends) {
                console.log("Our account can invite friends.");
            }
        });
        client.on("vacBans", function(numBans, appids) {
            console.log("We have " + numBans + " VAC ban" + (numBans == 1 ? "" : "s") + ".");
            if (appids.length > 0) {
                console.log("We are VAC banned from apps: " + appids.join(", "));
            }
        });
        client.on("licenses", function(licenses) {
            console.log("Our account owns " + licenses.length + " license" + (licenses.length == 1 ? "" : "s") + ".");
        });
        client.on("appOwnershipCached", function() {
            if (!appOwnershipCached) {
                appOwnershipCached = true;
                var ownedApps = client.getOwnedApps();
                var jar = request.jar();
                var cookie = request.cookie("steamdb=" + steamdbcookie);
                jar.setCookie(cookie, "https://steamdb.info/");
                CloudScraper.request({ url: "https://steamdb.info/search/?a=app_keynames&type=-1&keyname=243&operator=3&keyvalue=1", method: "GET", jar: jar }, function(error, response, data) {
                    if (error) console.log(error);
                    var freeApps = [];
                    $("#table-sortable a", data).each(function() {
                        freeApps.push(parseInt($(this).text().trim()));
                    });
                    var unownedFreeApps = $(freeApps).not(ownedApps);
                    var appsToAdd = unownedFreeApps.splice(0, 50);
                    if (unownedFreeApps.length > 0) {
                        client.requestFreeLicense(appsToAdd, function(error, grantedPackages, grantedAppIDs) {
                            if (grantedAppIDs.length === 0) {
                                console.log("No apps were added to account.");
                            } else {
                                console.log(grantedAppIDs.join() + " successfully added to account.");
                            }
                        });
                    } else {
                        appOwnershipCached = false;
                        client.relog();
                    }
                    setInterval(function() {
                        if (unownedFreeApps.length > 0) {
                            var appsToAdd = unownedFreeApps.splice(0, 50);
                            client.requestFreeLicense(appsToAdd, function(error, grantedPackages, grantedAppIDs) {
                                if (grantedAppIDs.length === 0) {
                                    console.log("No apps were added to account.");
                                } else {
                                    console.log(grantedAppIDs.join() + " successfully added to account.");
                                }
                            });
                        } else {
                            appOwnershipCached = false;
                            client.relog();
                        }
                    }, 30 * 60 * 1000);
                });
            }
        });
    });
});
