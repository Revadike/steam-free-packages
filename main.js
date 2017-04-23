var SteamAuth = require("steamauth"),
SteamUser = require("steam-user"),
SteamCommunity = require("steamcommunity"),
jsdom = require("jsdom"),
$ = require("jquery")(jsdom.jsdom().defaultView),
fs = require("fs"),
request = require("request"),
CloudScraper = require("cloudscraper");

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
        return "[" +
        ((day < 10) ? "0" + day : day) +
        "-" +
        ((month < 10) ? "0" + month : month) +
        "-" +
        ((year < 10) ? "0" + year : year) +
        " " +
        ((hour < 10) ? "0" + hour : hour) +
        ":" +
        ((minutes < 10) ? "0" + minutes : minutes) +
        ":" +
        ((seconds < 10) ? "0" + seconds : seconds) +
        "." +
        ("00" + milliseconds).slice(-3) +
        "] ";
    }
    log.apply(console, [formatConsoleDate(new Date()) + first_parameter].concat(other_parameters));
}

var config = JSON.parse(fs.readFileSync("config.json"));
var client = new SteamUser({
        enablePicsCache: true
    });
if (config.winauth_usage) {
    SteamAuth.Sync(function(error) {
        if (error)
            console.log(error);
        var auth = new SteamAuth(config.winauth_data);
        auth.once("ready", function() {
            config.steam_credentials.authCode = config.steam_credentials.twoFactorCode = auth.calculateCode();
            steamLogin();
        });
    });
} else {
    steamLogin();
}

function steamLogin() {
    var ownedSubs = [];
    config.steam_credentials.rememberPassword = true;
    client.logOn(config.steam_credentials);
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
            limitations.push("limited");
        }
        if (communityBanned) {
            limitations.push("community banned");
        }
        if (locked) {
            limitations.push("locked");
        }
        if (limitations.length === 0) {
            console.log("Our account has no limitations");
        } else {
            console.log("Our account is " + limitations.join(", "));
        }
        if (canInviteFriends) {
            console.log("Our account can invite friends");
        }
    });
    client.on("vacBans", function(numBans, appids) {
        console.log("We have " + numBans + " VAC ban" + numberEnding(numBans.length));
        if (appids.length > 0) {
            console.log("We are VAC banned from app" + numberEnding(appids.length) + ": " + appids.join(", "));
        }
    });
    client.on("webSession", function(sessionID, cookies) {
        console.log("Got web session");
        var community = new SteamCommunity();
        community.setCookies(cookies);
        community.httpRequestGet("https://steamdb.info/login/", {
            followAllRedirects: true
        }, function(error, response, data) {
            if (error) {
                console.log(error);
            }
            var url = $("#openidForm", data).attr("action");
            var formdata = $("#openidForm", data).serializeObject();
            community.httpRequestPost(url, {
                followAllRedirects: true,
                formData: formdata
            }, function(error, response, data) {
                if (error) {
                    console.log(error);
                }
                var jar = request.jar();
                response.headers["set-cookie"].forEach(function(cookiestr) {
                    var cookie = request.cookie(cookiestr);
                    jar.setCookie(cookie, "https://steamdb.info/");
                });
                CloudScraper.request({
                    //url: "https://steamdb.info/search/?a=app_keynames&type=-1&keyname=243&operator=3&keyvalue=1",
                    url: "https://steamdb.info/search/?a=sub_keynames&keyname=1&operator=3&keyvalue=12",
                    method: "GET",
                    jar: jar
                }, function(error, response, data) {
                    if (error) {
                        console.log(error);
                    } else {
                        var freeSubs = [];
                        $("#table-sortable tr a", data).each(function() {
                            freeSubs.push(parseInt($(this).text().trim()));
                        });
                        var ownedSubsPromise = setInterval(function() {
                                if (ownedSubs.length > 0) {
                                    clearInterval(ownedSubsPromise);
                                    var unownedFreeSubs = $(freeSubs).not(ownedSubs).get().reverse();
                                    console.log("Found " + freeSubs.length + " free app" + numberEnding(freeSubs.length) + " of which " + unownedFreeSubs.length + " are not owned by us yet");
                                    requestFreeSubs(unownedFreeSubs);
                                }
                            }, 10);
                    }
                });
            });
        });
    });
    client.on("licenses", function(licenses) {
        console.log("Our account owns " + licenses.length + " license" + numberEnding(licenses.length));
        var subs = [];
        licenses.forEach(function(license) {
            subs.push(license.package_id);
        });
        ownedSubs = subs;
    });
    client.on("appOwnershipCached", function() {
        console.log("Cached app ownership");
    });
}

function requestFreeSubs(unownedFreeSubs) {
    if (unownedFreeSubs.length > 0) {
        var subsToAdd = unownedFreeSubs.splice(0, config.max_subs);
        console.log("Attempting to request " + subsToAdd.length + " subs (" + subsToAdd.join() + ")");
        client.requestFreeLicense(subsToAdd, function(error, grantedPackages, grantedAppIDs) {
            if (error) {
                console.log(error)
            } else {
                if (grantedPackages.length === 0) {
                    console.log("No new packages were granted to our account");
                } else {
                    console.log(grantedPackages.length + " New package" + numberEnding(grantedPackages.length) + " (" + grantedPackages.join() + ") were successfully granted to our account");
                }
                if (grantedAppIDs.length === 0) {
                    console.log("No new apps were granted to our account");
                } else {
                    console.log(grantedAppIDs.length + " New app" + numberEnding(grantedAppIDs.length) + " (" + grantedAppIDs.join() + ") were successfully granted to our account");
                }
                console.log("Waiting " + millisecondsToStr(config.delay) + " for a new attempt");
                setTimeout(function() {
                    requestFreeApps(client, unownedFreeSubs)
                }, config.delay);
            }
        });
    } else {
        client.relog();
    }
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

$.fn.serializeObject = function() {
    var o = {};
    var a = this.serializeArray();
    $.each(a, function() {
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || "");
        } else {
            o[this.name] = this.value || "";
        }
    });
    return o;
};