// ==UserScript==
// @name            GcCzRating
// @namespace       http://artax.karlin.mff.cuni.cz/~morap5am/gcczrating
// @description     Přidává do stránek geocaching.com rozhraní pro hodnocení keší na geocaching.cz
// @version         0.3
// @copyright       2009, Petr Morávek (http://artax.karlin.mff.cuni.cz/~morap5am/gcczrating/)
// @license         (CC) Attribution; http://creativecommons.org/licenses/by/3.0/
// @include         http://www.geocaching.com/seek/cache_details.aspx?*
// @include         https://www.geocaching.com/seek/cache_details.aspx?*
// @include         http://www.geocaching.com/seek/cdpf.aspx?*
// @include         https://www.geocaching.com/seek/cdpf.aspx?*
// @include         http://www.geocaching.com/seek/log.aspx?*
// @include         https://www.geocaching.com/seek/log.aspx?*
// @include         http://www.geocaching.com/seek/nearest.aspx*
// @include         https://www.geocaching.com/seek/nearest.aspx*
// @include         http://www.geocaching.com/bookmarks/view.aspx?*
// @include         https://www.geocaching.com/bookmarks/view.aspx?*
// @require         http://ajax.googleapis.com/ajax/libs/jquery/1.3.2/jquery.min.js
// @require         http://courses.ischool.berkeley.edu/i290-4/f09/resources/gm_jq_xhr.js
// ==/UserScript==

GM_registerMenuCommand("GcCzRating: smazat uložená data", clearCache);

/***** Config ****/
var LOGGING = false;
var GCAPI = "http://www.geocaching.cz/api.php?";
var user = null;
var password = null;
var myratings = {};
var ratings = {};
var pageType = "";
var colors = ["#0D0", "#FE0", "#F10"];

$.ajaxSetup({
    "method": "POST",
    "url": GCAPI,
    "dataType": "text",
    "xhr": function(){return new GM_XHR;}
});

var css = []
if ($.browser.mozilla) {
    major = parseFloat($.browser.version.substr(0,3));
    minor = parseFloat($.browser.version.substr(4));
    if (major >= 1.9 && minor >= 3) {
        css["background-size"] = "background-size";
    } else if (major >= 1.9 && minor >= 2) {
        css["background-size"] = "-moz-background-size";
    } else {
        alert("Nekompatibilní prohlížeč.");
        exit;
    }
} else {
    alert("Nekompatibilní prohlížeč.");
    exit;
}



/***** Init ****/
if ($("#ctl00_SiteContent_lblSubmitErrorInfosss").length == 0) {
    log("start");
    var gcUser = null;
    gcUser = $("#ctl00_LoginUrl").prev("a").text();

    run();
}

function run() {
    log("run");
    var urlPath = window.location.pathname;
    if (urlPath.search("cache_details\.aspx") >= 0) {
        pageType = "details";
        initMyratings(initDetailsPage);
    } else if (urlPath.search("cdpf\.aspx") >= 0) {
        pageType = "print";
        initDetailsPage();
    } else if (urlPath.search("log\.aspx") >= 0) {
        pageType = "log";
        initMyratings(initDetailsPage);
    } else if (urlPath.search("nearest\.aspx") >= 0) {
        pageType = "nearest";
        initMyratings(initListPage);
    } else if (urlPath.search("/bookmarks/view\.aspx") >= 0) {
        pageType="bookmarks";
        initMyratings(initListPage);
    }
}

function initMyratings(callback) {
    log("initMyratings");
    // Old cache => refresh
    if ((GM_getValue("myratingsTO["+getUsername()+"]", 0)+24*3600) < Math.round(new Date().getTime()/1000)) {
        refreshMyratings(function() {loadMyratings(); callback();});
    } else {
        loadMyratings();
        callback();
    }
}


/***** Pages ****/
function initDetailsPage() {
    log("initDetails " + pageType);
    if (pageType == "print") {
        waypoint = document.title.substring(1, document.title.indexOf(")"));
        colors = ["#000", "#999", "#EEE"];
    } else if (pageType == "details") {
        waypoint = document.title.substring(0, document.title.indexOf(" "));
    } else {
        waypoint = $("#ctl00_Breadcrumbs").children("span:last").text();
    }
    loadRating(waypoint, renderDetailsPage);
}

function renderDetailsPage() {
    log("renderDetails " + pageType);
    var box = largeBox().hide();
    var rating = ratings[waypoint];
    setRating(box, rating);
    if (pageType == "print") {
        $(".TermsWidget").before(box);
    } else {
        var myrating = myratings[waypoint];
        setMyrating(box, myrating);
        box.find(".gcczrating-graph").mouseenter(startVote);
        box.find(".gcczrating-graph").mouseleave(endVote);
        box.find(".gcczrating-graph").click(sendVote);
        if (pageType == "details") {
            $("#ctl00_ContentBody_GeoNav2_uxHeaderImage").parent().parent().after(box);
        } else {
            elem = $("#ctl00_ContentBody_LogBookPanel1_LogButton");
            if (elem.length > 0) {
                elem.parent().before(box);
            } else {
                elem = $("#ctl00_ContentBody_LogBookPanel1_LogImage");
                if (elem.length > 0) {
                    elem.parent().before(box);
                }
            }
        }
    }
    box.fadeIn();
}

function initListPage() {
    log("initList " + pageType);
    wpts = []
    if (pageType == "nearest") {
        wptsElems = $("a[href^=/seek/cache_details.aspx]").parent();
        wptsElems.each(function(idx) {
                var content = $(this).text().split("\n");
                var wpt = content[3].replace(/(\s|[()])*/g, "");
                wpts.push(wpt);
            });
    } else if (pageType == "bookmarks") {
        wptsElems = $("a[href^=http://www.geocaching.com/seek/cache_details.aspx]");
        wptsElems.each(function(idx) {
                if (idx%2 == 0) {
                    var wpt = $(this).text();
                    wpts.push(wpt);
                }
            });
    }
    loadRatings(wpts, renderListPage);
}

function renderListPage() {
    log("renderList " + pageType);
    var boxPrototype = smallBox().hide();
    for (var i = 0, wpt; wpt = wpts[i]; i++) {
        var box = boxPrototype.clone();
        var rating = ratings[wpt];
        var myrating = myratings[wpt];
        setRating(box, rating);
        setMyrating(box, myrating);
        if (pageType == "nearest") {
            var elem = wptsElems.eq(i).prev("td");
            elem.html($("<div>" + elem.text() + "</div>"));
            elem.children("div").after(box);
        } else if (pageType == "bookmarks") {
            wptsElems.eq(2*i).parent().parent().next("tr").children("td").eq(0).html(box);
        }
        box.fadeIn();
    }
}



/***** Voting ****/
function startVote(event) {
    log("startVote");
    $(this).mousemove(changeVote);
    vote = calcVote(event, $(this));
    setMyrating($(this).parent().parent(), vote);
}

function changeVote(event) {
    var newVote = calcVote(event, $(this));
    if (newVote != vote) {
        vote = newVote;
        setMyrating($(this).parent().parent(), vote);
    }
}

function sendVote(event) {
    log("sendVote " + waypoint);
    var vote = calcVote(event, $(this));
    var box = $(this).parent().parent();
    if (vote != myratings[waypoint]) {
        $.ajax({
            "data": {
                "a":"hodnoceni",
                "v":"1",
                "u":getUsername(),
                "p":getPassword(),
                "d":waypoint+";"+vote,
            },
            "success": function(data, textStatus, XMLHttpRequest) {
                myratings[waypoint] = vote;
                saveMyratings(myratings);
                setMyrating(box, vote);
                refreshRatings([waypoint], function(){setRating(box, ratings[waypoint]);});
            },
            "error": function(XMLHttpRequest, textStatus, errorThrown) {
                alert("Odeslání hodnocení selhalo (" + textStatus + ").");
            }
        });
    }
}

function endVote(event) {
    log("endVote");
    setMyrating($(this).parent().parent(), myratings[waypoint]);
    $(this).unbind("mousemove");
}

function calcVote(event, obj) {
    var vote = Math.round(8*(event.pageX - obj.offset().left - 1)/(obj.width() - 2));
    return Math.floor(vote*12.5);
}


/***** Geocaching.cz credentials ****/
function getUsername() {
    // Get geocaching.cz username
    if (user != null) {
        return user;
    }
    user = GM_getValue("user["+gcUser+"]", null);
    if (user == null) {
        log("setup username");
        while (user == null) {
            user = prompt("Zadejte své přihlašovací jméno na geocaching.cz.", "jméno");
        }
        GM_setValue("user["+gcUser+"]", user);
    }
    return user;
}

function getPassword() {
    // Get geocaching.cz password
    if (password != null) {
        return password;
    }
    password = GM_getValue("password["+gcUser+"]", null);
    if (password == null) {
        log("setup password");
        while (password == null) {
            password = prompt("Zadejte své heslo pro přihlášení na geocaching.cz.", "heslo");
        }
        GM_setValue("password["+gcUser+"]", password);
    }
    return password;
}


/***** Ratings storage ****/
function refreshMyratings(callback) {
    // download and store fresh data
    log("refreshMyratings");
    $.ajax({
        "data": {
            "a":"ctivlastnihodnoceni",
            "v":"1",
            "u":getUsername(),
            "p":getPassword(),
        },
        "success": function(data, textStatus, XMLHttpRequest) {
            data = data.split("\n");
            if (data[1].search("info:ok") < 0) {
                return;
            }
            data = data[2].substr(5);
            data = data.replace(/\|\s*$/, "");
            saveMyratings(data);
            GM_setValue("myratingsTO["+getUsername()+"]", Math.round(new Date().getTime()/1000));
        },
        "complete": function(XMLHttpRequest, textStatus) {callback();}
    });
}

function saveMyratings(data) {
    // save data as string
    log("saveMyratings");
    if (typeof data == "string") {
        var store = data;
    } else {
        var store = Array();
        for (wpt in data) {
            log(wpt);
            if (wpt.search("\\|") >= 0 || wpt.search(";") >= 0 || wpt.search("GC") != 0) {
                log("cont");
                continue;
            }
            store.push(wpt + ";" + data[wpt]);
        }
        store = store.join("|");
        log(store);
    }
    GM_setValue("myratings["+getUsername()+"]", store);
}

function loadMyratings() {
    log("loadMyratings");
    // parse stored data from string
    var data = GM_getValue("myratings["+getUsername()+"]", "");
    if (data.length > 0) {
        data = data.split("|");
        for (i = 0; i < data.length; i++) {
            cache = data[i].split(";");
            myratings[cache[0]] = parseInt(cache[1]);
        }
    }
}


function refreshRatings(wpts, callback) {
    // download and store fresh data
    log("refreshRatings");
    $.ajax({
        "data": {
            "a":"ctihodnoceni",
            "v":"3",
            "d":wpts.join(","),
        },
        "success": function(data, textStatus, XMLHttpRequest) {
            data = data.split("\n");
            if (data[1].search("info:ok") < 0) {
                return;
            }
            data = data[2].substr(5);
            data = data.replace(/\|\s*$/, "");
            if (data.length > 0) {
                date = Math.round(new Date().getTime()/1000);
                data = data.split("|");
                for (i = 0; i < data.length; i++) {
                    cache = data[i].split(";");
                    ratings[cache[0]] = [parseInt(cache[3]), parseInt(cache[5])];
                    GM_setValue("ratings[" + cache[0] + "]", [cache[3], cache[5], date].join(";"))
                }
            }
        },
        "complete": function(XMLHttpRequest, textStatus) {callback();}
    });
}

function loadRating(wpt, callback) {
    loadRatings([wpt], callback);
}

function loadRatings(wpts, callback) {
    log("loadRatings");
    var date = Math.round(new Date().getTime()/1000)-2*24*3600;
    var toLoad = []
    for (var i = 0, wpt; wpt = wpts[i]; i++) {
         // already loaded
        if (wpt in ratings) {
            continue;
        }
        var cache = GM_getValue("ratings[" + wpt + "]", "");
        if (cache.length > 0) {
            cache = cache.split(";")
            if (cache[2] > date) {
                ratings[wpt] = [parseInt(cache[0]), parseInt(cache[1])];
                continue;
            }
        }
        toLoad.push(wpt);
    }

    if (toLoad.length > 0) {
        refreshRatings(toLoad, callback);
    } else {
        callback();
    }
}


/***** Rendering ****/
function setRating(box, rating) {
    log("setRating");
    if (rating == undefined) {
        var msg = "Hodnocení není dostupné";
    } else {
        var msg = rating[0] + " ± " + rating[1] + "%";

        var leftVariance2 = Math.round((rating[0]-1.5*rating[1]+0.5)*ppp);
        var leftVariance = Math.round((rating[0]-rating[1]+0.5)*ppp);
        var rightVariance = Math.round((rating[0]+rating[1]+0.5)*ppp);
        var rightVariance2 = Math.round((rating[0]+1.5*rating[1]+0.5)*ppp);
        var leftAverage = Math.max(0, Math.min(graphWidth-pointerWidth, Math.round((rating[0]+0.5)*ppp-pointerWidth/2)));
        var rightAverage = leftAverage + pointerWidth;

        var graph = box.find(".gcczrating-graph .gcczrating-rating");
        graph.css("background", 'no-repeat 1px center -moz-linear-gradient(left, transparent ' + leftAverage + 'px, #444 ' + leftAverage + 'px, #444 ' + rightAverage + 'px, transparent ' + rightAverage + 'px), no-repeat 1px center -moz-linear-gradient(left, ' + colors[0] + ' ' + leftVariance2 + 'px, ' + colors[1] + ' ' + leftVariance + 'px, ' + colors[1] + ' ' + rightVariance + 'px, ' + colors[2] + ' ' + rightVariance2 + 'px)');
        graph.css(css["background-size"], graphWidth + 'px ' + height + 'px, ' + graphWidth + 'px ' + graphHeight + 'px');
    }
    box.find(".gcczrating-footer .gcczrating-ratingtxt").text(msg);
    var curMsg = box.attr("title").split(", ");
    if (curMsg.length > 1) {
        box.attr("title", msg + ", " + curMsg[1]);
    } else {
        box.attr("title", msg);
    }
}

function setMyrating(box, myrating) {
    log("setMyrating");
    var graph = box.find(".gcczrating-graph .gcczrating-myrating");
    if (myrating == undefined) {
        graph.css("visibility", 'hidden');

        box.find(".gcczrating-footer .gcczrating-myratingtxt").text("");
        var curMsg = box.attr("title").split(", ");
        if (curMsg.length > 1) {
            box.attr("title", curMsg[0]);
        }
    } else {
        var msg = "moje " + myrating + "%";
        var myratingMargin = Math.max(0, Math.min(graphWidth - pointerWidth, Math.round((myrating+0.5)*ppp - pointerWidth/2)));

        graph.css("margin-left", myratingMargin + 'px');
        graph.css("visibility", 'visible');

        box.find(".gcczrating-footer .gcczrating-myratingtxt").text(", " + msg);
        var curMsg = box.attr("title").split(", ");
        if (curMsg.length > 0) {
            box.attr("title", curMsg[0] + ", " + msg);
        }
    }
}

function prepareBox(width, height) {
    var overlap = Math.round(height*0.15);

    boxHeight = height - 2*overlap;
    graphHeight = height - 2*overlap - 2;
    myratingHeight = height - 2;

    graphWidth = width - 2;
    ppp = graphWidth / 101;
    pointerWidth = Math.max(Math.round(ppp), 1);
}

function largeBox() {
    log("largeBox");
    if (pageType == "details") {
        width = $("#ctl00_ContentBody_uxTravelBugList_uxInventoryIcon").parent().next().children("p.NoSpacing").width();
    } else {
        width = 500;
    }
    height = 20;
    prepareBox(width, height);

    if (pageType == "print") {
        var box = $('<div class="gcczrating-box"><div class="gcczrating-graph" style="height: ' + height + 'px; width: ' + width + 'px; background: no-repeat left -moz-linear-gradient(left, black, black); ' + css["background-size"] + ': ' + width + 'px ' + boxHeight + 'px;"><div class="gcczrating-rating" style="height: ' + height + 'px; background: no-repeat 1px center -moz-linear-gradient(left, #FFF, #FFF); ' + css["background-size"] + ': ' + graphWidth + 'px ' + graphHeight + 'px;"></div></div><p class="gcczrating-footer" style="margin-top: 0.4em;"><strong>Hodnocení geocaching.cz: </strong><span class="gcczrating-ratingtxt"></span></p></div>');
    } else if (pageType == "details") {
        var box = $('<div class="CacheDetailNavigationWidget Spacing gcczrating-box"><h3 class="WidgetHeader">Hodnocení geocaching.cz</h3><div class="WidgetBody"><div class="gcczrating-graph" style="cursor: pointer; height: ' + height + 'px; width: ' + width + 'px; background: no-repeat left -moz-linear-gradient(left, black, black); ' + css["background-size"] + ': ' + width + 'px ' + boxHeight + 'px;"><div class="gcczrating-rating" style="background: no-repeat 1px center -moz-linear-gradient(left, #FFF, #FFF); ' + css["background-size"] + ': ' + graphWidth + 'px ' + graphHeight + 'px;"><div class="gcczrating-myrating" style="height: ' + myratingHeight + 'px; width: ' + pointerWidth + 'px; border: 1px solid black; background: rgba(255, 255, 255, 0.5); visibility: hidden;"></div></div></div><p class="NoSpacing gcczrating-footer" style="font-size: 0.9em; margin-top: 0.4em;"><span class="gcczrating-ratingtxt"></span><span class="gcczrating-myratingtxt"></span></p></div></div>');
    } else {
        var box = $('<div class="gcczrating-box"><p class="gcczrating-footer" style="margin: 0.4em 0;"><strong>Hodnocení geocaching.cz: </strong><span class="gcczrating-ratingtxt"></span><span class="gcczrating-myratingtxt"></span></p><div class="gcczrating-graph" style="cursor: pointer; height: ' + height + 'px; width: ' + width + 'px; background: no-repeat left -moz-linear-gradient(left, black, black); ' + css["background-size"] + ': ' + width + 'px ' + boxHeight + 'px;"><div class="gcczrating-rating" style="background: no-repeat 1px center -moz-linear-gradient(left, #FFF, #FFF); ' + css["background-size"] + ': ' + graphWidth + 'px ' + graphHeight + 'px;"><div class="gcczrating-myrating" style="height: ' + myratingHeight + 'px; width: ' + pointerWidth + 'px; border: 1px solid black; background: rgba(255, 255, 255, 0.5); visibility: hidden;"></div></div></div>');
    }

    return box;
}

function smallBox() {
    log("smallBox");
    width = 60;
    height = 10;
    prepareBox(width, height);

    if (pageType == "bookmarks") {
        var marginTop = 0;
    } else {
        var marginTop = 3;
    }

    var box = $('<div class="gcczrating-box" style="margin-top: ' + marginTop + 'px;"><div class="gcczrating-graph" style="height: ' + height + 'px; width: ' + width + 'px; background: no-repeat left -moz-linear-gradient(left, black, black); ' + css["background-size"] + ': ' + width + 'px ' + boxHeight + 'px;"><div class="gcczrating-rating" style="background: no-repeat 1px center -moz-linear-gradient(left, #FFF, #FFF); ' + css["background-size"] + ': ' + graphWidth + 'px ' + graphHeight + 'px;"><div class="gcczrating-myrating" style="height: ' + myratingHeight + 'px; width: ' + pointerWidth + 'px; border: 1px solid black; background: rgba(255, 255, 255, 0.5); visibility: hidden;"></div></div></div></div>');

    return box;
}


/***** Misc ****/
function log(str) {
    if (LOGGING) {
        GM_log(str);
    }
}

function clearCache() {
    if (confirm("Skutečně chcete vymazat všechna uložená data (uživ. jméno, heslo, kešovaná hodnocení)?")) {
        GM_listValues().map(GM_deleteValue);
    }
}