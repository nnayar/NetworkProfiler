'use strict';

var url = `https://gist.githubusercontent.com/ChrisChinchilla/29486e8ce367f426dfe6b15dbcc3fa54/raw/3ea92af51ce3749bb5983c1cb0359883592daef6/Marvel%2520Electron%2520Data`;
var diagnostics = require("./js/diagnostics");

var createItem = function ( item ) {
	console.log ("i'm inside createItem and here is the item to be added ", item);
	var source =  $( '#item-template' ).html();
	var template = Handlebars.compile( source );

	$( '#network-interfaces' ).append( template( item ) );
};

var diagnoseProcedure = diagnostics.diagnose(function(result){
	console.log("Result from Diagnostics call is: ", result);
	var resultErrors = result.errors;
	for (var index = 0; index< resultErrors.length; index++) {
		console.log(diagnostics.getError(resultErrors[index]));
	}
	var usefulInterfaces = {};
	usefulInterfaces.interfaceData = result.interfaces.en0.concat(result.interfaces.ppp0);

	for (var i = 0; i < usefulInterfaces.interfaceData.length; i++) {
		console.log ("this is a ", usefulInterfaces.interfaceData[i].family, " address. The IP address is ", 
			usefulInterfaces.interfaceData[i].address, " with a netmask of ", usefulInterfaces.interfaceData[i].netmask,
			" and a MAC Address of ", usefulInterfaces.interfaceData[i].mac);
		console.log("usefulInterfaces looks like this: ", usefulInterfaces.interfaceData[i]);
		createItem( usefulInterfaces.interfaceData[i] );
	}

});