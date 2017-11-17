const NodeHelper = require("node_helper");
const https = require("https");
const auth = require("./auth.json");
module.exports = NodeHelper.create({
    start: function(){
        console.log("Starting module: " + this.name)
    },
    socketNotificationReceived: function (notification, payload) {
        var self = this;
        if (notification == "getstop") {
            const options = {
                hostname: 'api.skyss.no',
                path: payload,
                headers: auth
            };
            var req = https.get(options, (res)=>{
                res.setEncoding('utf8');
                var data = "";
                res.on('data', (chunk) => {
                    data = data.concat(chunk);
                });

                res.on('end', ()=>{
                    self.sendSocketNotification("getstop", {response:data});
                });
            });
            req.on('error', (e) => {
                self.sendSocketNotification("getstop", {err:e});
            });
            req.end();
        }
    }
});
