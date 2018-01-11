const NodeHelper = require("node_helper");
const https = require("https");
module.exports = NodeHelper.create({
    start: function(){
        console.log("Starting module: " + this.name)
    },
    socketNotificationReceived: function (notification, payload) {
        var self = this;
        if (notification == "getstop") {
            const options = {
                hostname: 'skyss.giantleap.no',
                path: payload
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
