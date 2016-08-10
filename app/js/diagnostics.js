var os = require("os");
var nodeDns = require("dns");
var dns = require("native-dns");
var http = require("http");
var https = require("https");
var Ping = require("ping-lite");
var ping = require("ping");
var tcpPing = require("tcpie");				//	https://www.npmjs.com/package/tcpie
var speedconcat = require("speedconcat");

var diagnostics = {};
var testURL = "google.com";

diagnostics.getTestURL = function(){ 
	return testURL; 
};

diagnostics.setTestURL = function(replacement) {
	testURL = replacement;
	return;
};

diagnostics.checkInterfaces = function() {
	console.log( 'I was here' );
	var checkInterfacesResult = {};
	var errors = [];
	var outside = false;
	var v4 = false;
	var v6 = false;
	var interfaces = os.networkInterfaces();
	for (var interfaceSet in interfaces) {
		for (var interface in interfaces[interfaceSet]) {
			if (interfaces[interfaceSet][interface].internal == false) {
				outside = true;
				if (interfaces[interfaceSet][interface].family == "IPv4") {
					v4 = true;
					console.log(interfaces[interfaceSet][interface])
				}
				if (interfaces[interfaceSet][interface].family == "IPv6") {
					v6 = true;
					console.log(interfaces[interfaceSet][interface])
				}
			}
		}
	}
	if (outside != true) {
		errors[errors.length] = 1;
	}
	if (v4 != true) {
		errors[errors.length] = 4;
	}
	if (v6 != true) {
		errors[errors.length] = 6;
	}

	checkInterfacesResult.interfaces=interfaces;
	checkInterfacesResult.errors=errors;
	return checkInterfacesResult
};

diagnostics.haveIPv4 = function(){
	var checkInterfacesResult = diagnostics.checkInterfaces();
	var errors = checkInterfacesResult.errors;
	var interfaces = checkInterfacesResult.interfaces;

	if(errors.indexOf(4) > -1) {
		return false;
	}
	return true;
};
diagnostics.haveIPv6 = function(){
	var checkInterfacesResult = diagnostics.checkInterfaces();
	var errors = checkInterfacesResult.errors;
	var interfaces = checkInterfacesResult.interfaces;

	if(errors.indexOf(6) > -1) {
		return false;
	}
	return true;
};
diagnostics.haveConnection = function(){
	var checkInterfacesResult = diagnostics.checkInterfaces();
	var errors = checkInterfacesResult.errors;
	var interfaces = checkInterfacesResult.interfaces;

	if(errors.indexOf(1) > -1) {
		return false;
	}
	return true;
};
diagnostics.haveConnectionAsync = function(callback) {
	callback((diagnostics.haveIPv4() == true) || (diagnostics.haveIPv6() == true));
	return;
};
diagnostics.haveIPv4Async = function(callback) {
	callback((diagnostics.haveIPv4() == true));
	return;
};
diagnostics.haveIPv6Async = function(callback) {
	callback((diagnostics.haveIPv6() == true));
	return;
};
diagnostics.haveDNS = function(callback) {
	console.log("configured DNS servers are: ", nodeDns.getServers());

	var checkIPv4DNS = function(){
		var workingConcatenator = new speedconcat.newConcatenator("");
		var startDns4 = new Date().getTime();

		var dns4Connection = dns.Request({
			question: dns.Question({
				name: testURL
			}),
			server: {
				address: '8.8.8.8'
			}
		});
		var deactivate4 = false;
		dns4Connection.on("timeout", function(){
			if (!deactivate4) {
				deactivate4 = true;
				callback(false);
				return;
			}
		});
		dns4Connection.on("message", function(DNSerr, section){
			if (DNSerr) {
				if (!deactivate4) {
					deactivate4 = true;
					callback(false);
				}
				return;
			}
			workingConcatenator.append(section);
		});
		dns4Connection.on("end", function(){
			var delta = (new Date().getTime()) - startDns4;
			console.log('Finished processing DNSv4 request: ' + delta.toString() + 'ms');
			if (!deactivate4) {
				deactivate4 = true;
				callback(true);
			}
		});
		dns4Connection.send();
	};

	var DNSsegments = "";
	var deactivate6 = false;
	var startDns6 = new Date().getTime();

	var dnsConnection = dns.Request({
		question: dns.Question({
			name: testURL
		}),
		server: {
			address: '2001:4860:4860::8888'
		}
	});
	dnsConnection.on("timeout", function(){
		if (!deactivate6) {
			deactivate6 = true;
			checkIPv4DNS();
		}
	});
	dnsConnection.on("message", function(DNSerr, section){
		if (DNSerr) {
			if (!deactivate6) {
				deactivate6 = true;
				checkIPv4DNS();
			}
			return;
		}
		DNSsegments += section;
	});
	dnsConnection.on("end", function(){
		var delta = (new Date().getTime()) - startDns6;
		console.log('Finished processing DNSv6 request: ' + delta.toString() + 'ms');

		if (!deactivate6) {
			deactivate6 = true;
			callback(true);
		}
		return;
	});
	dnsConnection.send();
	return;
};
diagnostics.haveHTTP = function(callback) {
	var isFired = false;
	var startHttp = new Date().getTime();

	var requestOptions = {
		hostname: testURL,
		port: 80,
		method: "GET"		
	};
	var httpRequest = http.request(requestOptions, function(response){
		var responseTotal = "";
		response.on("data", function(section){
			responseTotal += section;
		});
		response.on("end", function(){
			var delta = (new Date().getTime()) - startHttp;
			console.log('Finished processing HTTP request: ' + delta.toString() + 'ms');

			if (isFired == false) {
				isFired = true;
				callback(true);
			}
		});
		response.on("error", function(){
			if (isFired == false) {
				isFired = true;
				callback(false);
			}
		});
	});
	httpRequest.on("socket", function (socket){
		socket.setTimeout(10000);
		socket.on("timeout", function(){
			var delta = (new Date().getTime()) - startHttp;
			console.log('Finished processing HTTP request/Socket: ' + delta.toString() + 'ms');
			if (isFired == false) {
				isFired = true;
				callback(false);
			}
		});
	});
	httpRequest.on("error", function(failure) {
		if (isFired == false) {
			isFired = true;
			callback(false);
		}
	});
	httpRequest.end();
	return;
};
diagnostics.haveHTTPS = function(callback) {
	var isFired = false;
	var startHttps = new Date().getTime();

	var requestOptions = {
		hostname: testURL,
		port: 443,
		method: "GET"		
	};
	var httpRequest = https.request(requestOptions, function(response){
		var responseTotal = "";
		response.on("data", function(section){
			responseTotal += section;
		});
		response.on("end", function(){
			var delta = (new Date().getTime()) - startHttps;
			console.log('Finished processing HTTPS request: ' + delta.toString() + 'ms');

			if (isFired == false) {
				isFired = true;
				callback(true);
			}
		});
		response.on("error", function(){
			if (isFired == false) {
				isFired = true;
				callback(false);
			}
		});
	});
	httpRequest.on("socket", function (socket){
		socket.setTimeout(10000);
		socket.on("timeout", function(){
			if (isFired == false) {
				isFired = true;
				callback(false);
			}
		});
	});
	httpRequest.on("error", function(failure) {
		if (isFired == false) {
			isFired = true;
			callback(false);
		}
	});
	httpRequest.end();
	return;
	
};
diagnostics.havePing = function(callback) {
	var pingLite = new Ping( testURL );
	var tcpP = tcpPing(testURL, 80, {count: 10, interval: 500, timeout: 2000});
	
	pingLite.send(function(err, ms) {
		console.log('Ping responded in '+ms+'ms.');
	});

	tcpP.on('connect', function(stats) {
		console.info('connect', stats);
	}).on('error', function(err, stats) {
		console.error(err, stats);
	}).on('timeout', function(stats) {
		console.info('timeout', stats);
	}).on('end', function(stats) {
		console.info(stats);
	}).start();

	ping.sys.probe(testURL, function(reached) {
		console.log( "ping test - reached output is: ", reached);
		callback(reached);
	});
};
diagnostics.getError = function(id) {
	switch(id) {
		case 0: return "NormalNetworkActivity";
		case 1: return "NoConnection";
		case 4: return "NoIPv4Connection";
		case 6: return "NoIPv6Connection";
		case 7: return "DiagnosticsScriptFailure";
		case 8: return "PingNotUsable";
		case 53: return "NoDNS";
		case 80: return "NoHTTPconnection";
		case 110: return "NoInsecurePOP3";
		case 123: return "NoNTP";
		case 143: return "NoInsecureIMAP";
		case 443: return "NoHTTPSconnection";
		case 993: return "NoSecureIMAP";
		case 995: return "NoSecurePOP3";
		default: return "Unknown";
		/*
		case 20: return "FTPFailure";
		case 22: return "SSHfailure";
		case 23: return "TelnetFailure";
		case 25: return "SMTPfailure";
		case 37: return "TimeProtocolFailure";
		case 70: return "NoGopher" ;
		case 81: return "NoTor";
		case 88: return "NoKerberos" ;
		case 161: return "NoSNMP";
		case 194: return "NoIRC" ;
		case 5222: return "NoXMPP" ;
		*/
	}
}; 

/*You could use a tree for this, but that would be work.*/

diagnostics.diagnose = function(callback) {
	var checkInterfacesResult = diagnostics.checkInterfaces();
	var errors = checkInterfacesResult.errors;
	var interfaces = checkInterfacesResult.interfaces;

	var finalSteps = function(errorSet) {
		console.log("here in Final Steps Check");
		if (errorSet.length < 1) {
			errorSet[0] = 0;
		}
		checkInterfacesResult.errors= errorSet;
		callback(checkInterfacesResult);
	};

	var checkHTTPS = function(errorSet){
		diagnostics.haveHTTPS(function(httpWorking){
			console.log("here in HTTPS Check");
			if (httpWorking == false) {
				errorSet[errorSet.length] = 443;
			}
			finalSteps(errorSet);
			return;
		});
		return;
	};
	var checkHTTP = function(errorSet){
		diagnostics.haveHTTP(function(httpWorking){
			console.log("here in HTTP Check");
			if (httpWorking == false) {
				errorSet[errorSet.length] = 80;
			}
			checkHTTPS(errorSet);
			return;
		});
		return;
	};
	var checkPing = function(errorSet) {
		diagnostics.havePing(function(pingWorking){
			console.log("here in ping Check");
			if (pingWorking == false) {
				errorSet[errorSet.length] = 8;
			}
			checkHTTP(errorSet);
		});
	};
	diagnostics.haveDNS(function(haveDNS){
		console.log("here in DNS Check");
		if (haveDNS == false) {
			errors[errors.length] = 53;
		}
		checkPing(errors);
	});
};
var email = require("./emailTester.js");
diagnostics.haveInsecureImap = email.insecureImapWorks;
diagnostics.haveSecureImap = email.secureImapWorks;
diagnostics.haveInsecurePop = email.insecurePopTest;
diagnostics.haveSecurePop = email.securePopTest;
var times = require("./times.js");
diagnostics.haveNTP = times.ntpTester;

module.exports = exports = diagnostics;
