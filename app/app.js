$(document).ready( function() {
  app.initialized().then(function(_client) {
    var client = _client;
    client.events.on('app.activated', function() {
      console.clear();
      console.log("!!! App Activated !!!");
      client.events.on("ticket.propertiesUpdated", eventCallback, {intercept: true});
    });
  });
});

var eventCallback = function (event) {
  console.log(event.type + " event occurred");
  var event_data = event.helper.getData();
  console.log({event_data});
  
  event.helper.done()
  // event.helper.fail('error')
};
