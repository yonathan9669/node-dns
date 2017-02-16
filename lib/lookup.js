// The Lookup class is used to query your public IP
// address.  It makes a request to www.jsonip.com to
// get back the public IP of your router.  The 
// jsonip.com service returns a json string
// containing your public IP address.

var https = require('https');
var events = require('events');

var Lookup = function(){
};

Lookup.prototype = new events.EventEmitter();

Lookup.prototype.compare = function(currentIp){
  var options = {hostname: 'jsonip.com'};
  var lookup = this;

  var req = https.request(options, function(res){
	res.on('data', function(response){
	  var result = JSON.parse(response);
	  lookup._compareIP(currentIp, result.ip);
	});
  }).on('error', function(e){
	console.error(e);
  });

  req.end();
};

Lookup.prototype._compareIP = function(currentIp, publicIp){
  var lookup = this;
  if (currentIp !== publicIp) {
	lookup.emit('update', publicIp);
  } else {
	lookup.emit('match', currentIp, publicIp);
  }
};

module.exports = Lookup;