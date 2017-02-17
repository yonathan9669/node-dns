var fs = require('fs'),
	Lookup = require('./lib/lookup'),
	DNSimple = require('./lib/dnsimple'),
	moment = require('moment');

var settings = JSON.parse(fs.readFileSync('./settings.json'));
var lookup = new Lookup();
var dns = new DNSimple(settings);

lookup.on('update', function(public_ip){
  // the update event is fired when there is a mismatch of
  // IP addresses
  writeln('IP address mismatch:');
  writeln('\tCurrent IP: ' + settings.currentIP);
  writeln('\t Public IP: ' + public_ip);

  updateRecords(public_ip);
}).on('match', function(){
  // the match event is called when the current and the public
  // IP addresses match
  writeln('IP addresses match.  No need to update.');
});

dns.on('record-list', function(domain, records){
  // the update event is fired when there is a mismatch of
  // IP addresses
  domain.records = domain.records.map(function(record){
	var r = records.find(function(apiRecord){
		  return apiRecord.name === record.name;
		}) || {};

	return {
	  name: record.name,
	  content: r.content,
	  id: r.id,
	  ttl: r.ttl
	}
  });

  if (!--updated) {
	updateConfigFile(false, function(){
	  checkIpStatus();
	});
  }
}).on('record-updated', function(record, domain){
  // the updated event is raised after the public IP
  // was successfully updated
  writeln('On ' + domain.name + ' the ' + record.name + ' record IP was updated successfully.');

  if (!--updated) {
	updateConfigFile(true);
  }
}).on('error', function(e){
  console.error(e);
});

function updateConfigFile(updated, cb){
  // we have to save the new public IP to a local file
  // so that we can do a comparison on the next run
  writeln('All records were successfully ' + (updated ? 'updated' : 'retrieved') + '...');
  writeln('Updating local settings...');
  fs.writeFile('./settings.json', JSON.stringify(settings, undefined, 2), function(err){
	if (err) throw err;
	writeln('Local settings updated successfully.');
	cb && cb();
  });
}

function checkIpStatus(){
  printDate();
  lookup.compare(settings.currentIP);
}

function updateRecords(newIp){
  writeln('Updating records...');
  updated = 0;
  settings.currentIP = newIp;
  settings.domains.forEach(function(domain){
	updated += domain.records.length;

	domain.records.forEach(function(record){
	  if (record.id && record.content !== newIp) {
		dns.update(domain, record, newIp);
	  }
	  else {
		updated--;
	  }
	});
  });

  if (!updated) {
	updateConfigFile(true);
  }
}

function writeln(str){
  process.stdout.write(str + '\n');
}

function printDate(){
  writeln('//----------------' + moment().format('MMMM Do YYYY, h:mm:ss a') + '-----------------//');
}

var domains = settings.domains.filter(function(domain){
  return domain.records.some(function(record){
	return !record.id;
  });
});

var updated = domains.length;

if (!updated) {
  checkIpStatus();
} else {
  settings.currentIP = "0.0.0.0";
  domains.forEach(function(domain){
	dns.list(domain);
  });
}

setInterval(checkIpStatus, settings.checkInterval || 3600000);