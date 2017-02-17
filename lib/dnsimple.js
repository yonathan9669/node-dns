// The dnsimple class is a thin wrapper around
// the DNSimple.com REST API.  Only the call to
// update a domain's IP address has been implemented.
// There are several libraries that exist where
// more of the API has been implemented.

var https = require('https');
var bl = require('bl');
var events = require('events');

var DNSimple = function(settings){
  var dnsimple = this;
  dnsimple.settings = settings;
  url = function(array){
	return array.join('/');
  };

  var api = {
	hostname: 'api.dnsimple.com',
	version: 'v1',
	_options: function(path, method){
	  return {
		hostname: this.hostname,
		path: '/' + path,
		method: method,
		headers: this.headers
	  };
	},
	get _apiToken(){
	  return settings.username + ':' + settings.token;
	}
  };
  api.headers = {
	'X-DNSimple-Token': api._apiToken,
	'Accept': 'application/json',
	'Content-Type': 'application/json'
  };
  api.domains = {
	base: 'domains',
	get path(){
	  return url([api.version, this.base]);
	},
	get: function(domain){
	  return url([this.path, domain.name]);
	}
  };
  api.records = {
	base: 'records',
	path: function(domain){
	  return url([api.domains.get(domain), this.base]);
	},
	list: function(domain){
	  return api._options(this.path(domain));
	},
	get: function(domain, record){
	  return api._options(url([this.path(domain), record.id]));
	},
	update: function(domain, record){
	  var options = this.get(domain, record);
	  options.method = 'PUT';
	  return options;
	},
	create: function(domain){
	  var options = this.list(domain);
	  options.method = 'POST';
	  return options;
	},
	delete: function(domain, record){
	  var options = this.get(domain, record);
	  options.method = 'DELETE';
	  return options;
	}
  };

  dnsimple.api = api;
};

/*
 * Initialize the Class as an EventEmitter
 */
DNSimple.prototype = new events.EventEmitter();
/*
 * Public functions
 */
/*
 * List all the A records from the specified domain
 */
DNSimple.prototype.list = function(domain){
  var dnsimple = this;
  dnsimple._request(dnsimple.api.records.list(domain), function(response){
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
  dnsimple._request(dnsimple.api.records.get(domain, record), function(response){
	dnsimple.emit('record-get', response);
  }).end();
};
/*
 * Update the IP of an A record
 * on the specified domain
 */
DNSimple.prototype.update = function(domain, record, new_ip){
  var dnsimple = this;
  var payload = {
	record: {
	  content: new_ip
	}
  };

  var req = dnsimple._request(dnsimple.api.records.update(domain, record), function(response){
	response = response.record;
	record.content = response.content;
	record.ttl = response.ttl;
	record.name = response.name;

	dnsimple.emit('record-updated', record, domain);
  });

  req.write(JSON.stringify(payload));
  req.end();
};
/*
 * Private functions
 */
/*
 * Builds the request for the DNSimple API
 */
DNSimple.prototype._request = function(options, cb){
  var dnsimple = this;
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