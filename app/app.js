$(document).ready( function() {
  app.initialized().then(function(_client) {
    window.client = _client;
    client.events.on('app.activated', function() {
      console.clear();
      console.log("!!! App Activated !!!");
      client.events.on("ticket.propertiesUpdated", eventCallback, {intercept: true});
    }).catch(err => console.error(err));
  }).catch(err => console.error(err));
});

var eventCallback = function (event) {
  console.clear();
  console.log("Event triggered !!!");
  var event_data = event.helper.getData();
  event.helper.done();
  (event_data.changedAttributes["isCustomFieldsChanged"]) ? getTicketDetails() : '';
};

function getTicketDetails () {
  client.data.get("ticket").then(function(data) {
    if(data.ticket.type == "Service Task") {
      const entity = client.db.entity({ version: 'v1' });
      const fsmRecords = entity.get('fsm_records');
      console.log(data.ticket)
      fsmRecords.getAll({
        query : { 'ticket_id': data.ticket.id }
      }).then(function(dbData) {
        console.log("Records from DB :", dbData.records);
        dbData.records.length > 0 ? checkFieldsUpdate(dbData.records[0], data.ticket) : '';
      }, err => console.log(err));
    } else {
      console.log("Not a service request");
    }
  }, function(error) {
    console.log(error);
  });
}

function checkFieldsUpdate(record, ticketDetails) {
  console.log("Before : ", ticketDetails);
  var fieldNames = Object.keys(record.data).filter(function(e) { 
    return this.indexOf(e) < 0
  }, ['responder_id', 'ticket_id', 'event_id']);
  let flag = false;
  fieldNames.forEach(element => {
    if(ticketDetails.custom_fields[element] !== record.data[element]) { 
      console.log(element, record.data[element], ticketDetails.custom_fields[element]) 
      flag = true;
      if((element === 'cf_fsm_appointment_start_time' && 'cf_fsm_appointment_end_time')) {
        record.data[element] = new Date(ticketDetails.custom_fields[element]).toISOString()
      } else {
        record.data[element] = ticketDetails.custom_fields[element]
      }
    } 
  });
  console.log("After : ", record.data, flag);
  updateCalendarEvent(flag, ticketDetails, record);
}

function updateCalendarEvent(flag, ticketDetails, record) {
  if(flag) {
    console.log("!!!!!! SMI Triggered !!!!!!");
    var options = { ticket : ticketDetails, record };
    client.request.invoke("serverMethod", options).then(function(data) {
      console.log(data);
    }, function(err) {
      console.log(err);
    });
  }
}
