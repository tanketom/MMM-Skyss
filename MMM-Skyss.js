/* Magic Mirror
 * Module: Ruter
 *
 * By Cato Antonsen (https://github.com/CatoAntonsen)
 * MIT Licensed.
 */

Module.register("MMM-Skyss",{

    // Default module config.
    defaults: {
        timeFormat: null,              // This is set automatically based on global config
        showHeader: false,             // Set this to true to show header above the journeys (default is false)
        showPlatform: false,           // Set this to true to get the names of the platforms (default is false)
        showStopName: false,           // Show the name of the stop (you have to configure 'name' for each stop)
        maxItems: 5,                   // Number of journeys to display (default is 5)
        humanizeTimeTreshold: 15,      // If time to next journey is below this value, it will be displayed as "x minutes" instead of time (default is 15 minutes)
        serviceReloadInterval: 30000,  // Refresh rate in MS for how often we call Skyss' web service. NB! Don't set it too low! (default is 30 seconds)
        animationSpeed: 0,             // How fast the animation changes when updating mirror (default is 0 second)
        fade: true,                    // Set this to true to fade list from light to dark. (default is true)
        fadePoint: 0.25,               // Start on 1/4th of the list.
        useRealtime: true              // Whether to use realtime data from Skyss
    },

    getStyles: function () {
        return ["skyss.css"];
    },

    getScripts: function() {
        return [];
    },

    getTranslations: function() {
        return {
            en: "translations/en.json",
            nb: "translations/nb.json"
        }
    },

    start: function() {
        console.log(this.translate("STARTINGMODULE") + ": " + this.name);

        this.journeys = [];
        this.previousJourneys = [];
        var self = this;

         // Set locale and time format based on global config
        if (config.timeFormat === 24) {
            this.config.timeFormat = "HH:mm";
        } else {
            this.config.timeFormat = "h:mm A";
        }

        // Just do an initial poll. Otherwise we have to wait for the serviceReloadInterval
        self.startPolling();

        setInterval(function() {
            self.startPolling();
        }, this.config.serviceReloadInterval);
    },

    getDom: function() {
        if (this.journeys.length > 0) {

            var table = document.createElement("table");
            table.className = "ruter small";

            if (this.config.showHeader) {
                table.appendChild(this.getTableHeaderRow());
            }

            for(var i = 0; i < this.journeys.length; i++) {

                var journey = this.journeys[i];
                var tr = this.getTableRow(journey);

                // Create fade effect. <-- stolen from default "calendar" module
                if (this.config.fade && this.config.fadePoint < 1) {
                    if (this.config.fadePoint < 0) {
                        this.config.fadePoint = 0;
                    }
                    var startingPoint = this.journeys.length * this.config.fadePoint;
                    var steps = this.journeys.length - startingPoint;
                    if (i >= startingPoint) {
                        var currentStep = i - startingPoint;
                        tr.style.opacity = 1 - (1 / steps * currentStep);
                    }
                }

                table.appendChild(tr);
            }

            return table;
        } else {
            var wrapper = document.createElement("div");
            wrapper.innerHTML = this.translate("LOADING");
            wrapper.className = "small dimmed";
            return wrapper;
        }

    },

    startPolling: function() {
        var self = this;

        var promise = new Promise((resolv) => {
            this.getStopInfo(this.config.stops, function(err, result) {
                resolv(result);
            });
        });

        promise.then(function(promiseResults) {
            if (promiseResults.length > 0) {
                var allJourneys = [];
                for(var i=0; i < promiseResults.length; i++) {
                    allJourneys = allJourneys.concat(promiseResults[i])
                }

                allJourneys.sort(function(a,b) {
                    var dateA = new Date(a.time.Timestamp);
                    var dateB = new Date(b.time.Timestamp);
                    return dateA - dateB;
                });

                self.journeys = allJourneys.slice(0, self.config.maxItems);

                self.updateDom();
            }
        });
    },

    getStopInfo: function(stopItems, callback) {
        var self = this;

        var HttpClient = function() {
            this.get = function(requestUrl, requestCallback) {
                // var httpRequest = new XMLHttpRequest();
                // httpRequest.onreadystatechange = function() {
                //     if (httpRequest.readyState == 4 && httpRequest.status == 200){
                //         requestCallback(httpRequest.responseText);
                //     }
                // };

                // httpRequest.open("GET", requestUrl, true);
                // httpRequest.setRequestHeader("Authorization", "");
                // httpRequest.send(null);
                self.requests.push(requestCallback);
                self.sendSocketNotification("getstop", requestUrl);
            }
        }
    
        //DisplayTime contains realtime-information. Formatted as "x min"(remaining time), or "HH:mm"
        var processSkyssDisplaytime = function(displayTime) {
            var realTime;
            var regexInMinutes = new RegExp('([0-9]+) min');
            var regexLocalTimeStamp = new RegExp('[0-9]{2}\:[0-9]{2}');
        
            //Time format is "x min"
            if (regexInMinutes.test(displayTime)) {
                inMinutes = parseInt(displayTime.match(regexInMinutes)[1]);
            
                // Adding 1 gives same result as skyss app -.-
                realTime = moment().add(inMinutes+1, 'minutes');
            
            //Time format is "HH:mm". 
            } else if (regexLocalTimeStamp.test(displayTime)) {
                realTime = moment(displayTime, "HH:mm");
            
                //Time is next day
                if (realTime.isBefore(moment())) {
                	realTime.add(1, 'day');
                }
            }
            return realTime;
        };
        

        // var shouldAddPlatform = function(platform, platformFilter) {
        //     if (platformFilter == null || platformFilter.length == 0) { return true; } // If we don't add any interesting platformFilter, then we asume we'll show all
        //     for(var i=0; i < platformFilter.length; i++) {
        //         if (platformFilter[i] === platform) { return true; }
        //     }

        //     return false;
        // };

        // var departureUrl = function() {
        //     var dateParam = "";
        //     if (stopItem.timeToThere) {
        //         var min = stopItem.timeToThere;
        //         var timeAhead = moment(moment.now()).add(min, "minute").format().substring(0, 16);
        //         console.log("Looking for journeys " + min + " minutes ahead in time.");
        //         dateParam = "?datetime=" + timeAhead;
        //     } else {
        //         console.log("Looking for current journeys");
        //     }

        //     return "http://reisapi.ruter.no/StopVisit/GetDepartures/" + stopItem.stopId + dateParam;
        // };

        var stopUrl = function() {
            return "/public/departures?Hours=12&StopIdentifiers=" + stopItems.map(stopItem => stopItem.stopId).join();
        };

        var client = new HttpClient();

        client.get(stopUrl(), function(stopResponse) {
            var departure = JSON.parse(stopResponse);
            var times = departure.PassingTimes;

            var allStopItems = [];

            for(var j = 0; j < times.length; j++) {
                var journey = times[j];
                var stop = departure.Stops[journey.StopIdentifier];
                var timestamp;
                
                var realtimeStamp = processSkyssDisplaytime(journey.DisplayTime);
                if ( self.config.useRealtime && moment.isMoment(realtimeStamp) ) {
                    timestamp = realtimeStamp.toISOString();
                } else {
                    timestamp = journey.AimedTime;
                }
                
                allStopItems.push({
                    stopId: journey.StopIdentifier,
                    stopName: stop.PlaceDescription,
                    lineName: journey.RoutePublicIdentifier,
                    destinationName: journey.TripDestination,
                    service: stop.ServiceModes[0],
                    time: {
                        Timestamp: timestamp,
                        Status: journey.Status,
                    },
                    platform: journey.Platform
                });
            }
            callback(null, allStopItems);
        })
    },

    getTableHeaderRow: function() {
        var thLine = document.createElement("th");
        thLine.className = "";
        thLine.appendChild(document.createTextNode(this.translate("LINEHEADER")));

        var thDestination = document.createElement("th");
        thDestination.className = "";
        thDestination.appendChild(document.createTextNode(this.translate("DESTINATIONHEADER")));

        var thPlatform = document.createElement("th");
        thPlatform.className = "";
        thPlatform.appendChild(document.createTextNode(this.translate("PLATFORMHEADER")));

        var thStopName = document.createElement("th");
        thStopName.className = "";
        thStopName.appendChild(document.createTextNode(this.translate("STOPNAMEHEADER")));

        var thTime = document.createElement("th");
        thTime.className = "time";
        thTime.appendChild(document.createTextNode(this.translate("TIMEHEADER")));

        var thead = document.createElement("thead");
        thead.addClass = "xsmall dimmed";
        thead.appendChild(document.createElement("th"));
        thead.appendChild(thLine);
        thead.appendChild(thDestination);
        if (this.config.showStopName) { thead.appendChild(thStopName); }
        if (this.config.showPlatform) { thead.appendChild(thPlatform); }
        thead.appendChild(thTime);

        return thead;
    },

    getTableRow: function(journey) {
        var tdIcon = document.createElement("td");
        var imageFA;
        switch (journey.service) {
        case "Bus":
        case "Express":
        case "Airport bus":
            imageFA = "bus";
            break;
        case "Light rail":
            imageFA = "subway";
            break;
        case "Ferry":
        case "Boat":
            imageFA = "ship";
            break;
        case "Train":
            imageFA = "train";
            break;
        default:
            imageFA = "rocket";
            break;
        }
        tdIcon.className = "fa fa-"+imageFA;

        var tdLine = document.createElement("td");
        tdLine.className = "line";
        var txtLine = document.createTextNode(journey.lineName);
        tdLine.appendChild(txtLine);

        var tdDestination = document.createElement("td");
        tdDestination.className = "destination bright";
        tdDestination.appendChild(document.createTextNode(journey.destinationName));

        if (this.config.showPlatform) {
            var tdPlatform = document.createElement("td");
            tdPlatform.className = "platform";
            tdPlatform.appendChild(document.createTextNode(journey.platform));
        }

        if (this.config.showStopName) {
            var tdStopName = document.createElement("td");
            tdStopName.className = "light";
            tdStopName.appendChild(document.createTextNode(journey.stopName));
        }

        var tdTime = document.createElement("td");
        if (journey.time.Status != "Schedule") {
            tdTime.className = "time light sanntid";
        } else {
            tdTime.className = "time light";
        }
        tdTime.appendChild(document.createTextNode(this.formatTime(journey.time.Timestamp)));

        var tr = document.createElement("tr");
        tr.appendChild(tdIcon);
        tr.appendChild(tdLine);
        tr.appendChild(tdDestination);
        if (this.config.showStopName) { tr.appendChild(tdStopName); }
        if (this.config.showPlatform) { tr.appendChild(tdPlatform); }
        tr.appendChild(tdTime);

        return tr;
    },

    formatTime: function(t) {
        var now = new Date();
        var tti = new Date(t);
        var diff = tti - now;
        var min = Math.floor(diff/60000);

        if (min == 0) {
            return this.translate("NOW");
        } else if (min == 1) {
            return this.translate("1MIN");
        } else if (min < this.config.humanizeTimeTreshold) {
            return min + " " + this.translate("MINUTES");
        } else {
            return tti.getHours() + ":" + ("0" + tti.getMinutes()).slice(-2);
        }
    },

    socketNotificationReceived: function(notification, payload) {
        var self = this;
        Log.log(this.name + " recieved a socket notification: " + notification);
        if (notification == "getstop") {
            if (payload.err) {
                throw payload.err;
            } else {
                self.requests.shift()(payload.response);
            }
        }
    },

    requests: []
});
