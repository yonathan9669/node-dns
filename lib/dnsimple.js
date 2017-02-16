// The dnsimple class is a thin wrapper around
// the DNSimple.com REST API.  Only the call to
// update a domain's IP address has been implemented.
// There are several libraries that exist where
// more of the API has been implemented.

var https = require('https');
var bl = require('bl');
var events = require('events');

var DNSimple = function(settings){
  this.settings = settings;
};

DNSimple.prototype = new events.EventEmitter();

/*
 * List all the A records from the specified domain
 */
DNSimple.prototype.list = function(domain){
  var dnsimple = this;
  var path = 'domains/' + domain.name + '/records';

  dnsimple._request(path, function(response){
	dnsimple.emit('record-list', domain, response.filter(function(record){
	  return record.record.record_type === 'A';
	}).map(function(r){
	  return r.record;
	}));
  }).end();
};

/*
 * Get a record from the specified domain
 */
DNSimple.prototype.get = function(domain, record){
  var dnsimple = this;
  var path = 'domains/' + domain.name + '/records/' + record.id;

  dnsimple._request(path, function(response){
	dnsimple.emit('record-get', response);
  }).end();
};

/*
 * Update the IP of an A record
 * on the specified domain
 */
DNSimple.prototype.update = function(domain, record, new_ip){
  var dnsimple = this;
  var path = 'domains/' + domain.name + '/records/' + record.id;

  var payload = {
	record: {
	  content: new_ip
	}
  };

  var req = dnsimple._request(path, function(response){
	response = response.record;
	record.content = response.content;
	record.ttl = response.ttl;
	record.name = response.name;

	dnsimple.emit('record-updated', record, domain);
  }, 'PUT');

  req.write(JSON.stringify(payload));
  req.end();
};

/*
 * Builds the apiToken used for authenticating to the DNSimple API
 */
DNSimple.prototype._apiToken = function(){
  return this.settings.username + ':' + this.settings.token
};

/*
 * Builds the request for the DNSimple API
 */
DNSimple.prototype._request = function(path, cb, method){
  var dnsimple = this;

  var options = {
	hostname: 'api.dnsimple.com',
	path: '/v1/' + path,
	method: method || 'GET',
	headers: {
	  'X-DNSimple-Token': dnsimple._apiToken(),
	  'Accept': 'application/json',
	  'Content-Type': 'application/json'
	}
  };

  return https.request(options, function(res){
	var status = res.statusCode;

	res.pipe(bl(function(err, response){
	  if (err || status !== 200)
		dnsimple.emit('error', err);
	  else
		cb(JSON.parse(response));
	}));
  }).on('error', function(e){
	dnsimple.emit('error', e);
  });
};

module.exports = DNSimple;