$(document).ready( function() {
  app.initialized().then(function(_client) {
    window.client = _client;
    client.events.on('app.activated', function() {
      console.clear();
      console.log("!!! App Activated !!!");
      client.events.on("ticket.propertiesUpdated", eventCallback, {intercept: true});
    });
  });
});

var eventCallback = function (event) {
  var event_data = event.helper.getData();
  event.helper.done();
  if(event_data.changedAttributes.isCustomFieldsChanged[1] === true) {
    getTicketDetails();
  } else {
    console.log(false);
  }
};

function getTicketDetails () {
  Promise.all([client.data.get("ticket"), client.data.get("contact")]).then(function([data, contact]) {
    console.log(contact);
    if(data.ticket.type == "Service Task") {
      const entity = client.db.entity({ version: 'v1' });
      const fsmRecords = entity.get('fsm_records');
      fsmRecords.getAll({
        query : { 'ticket_id': data.ticket.id }
      }).then(function(dbData) {
        console.log("Records from DB :", dbData.records);
        dbData.records.length > 0 ? checkFieldsUpdate(dbData.records[0], data.ticket, contact) : '';
      }).catch(err => console.log(err));
    }
  }, function(error) {
    console.log(error);
  });
}

function checkFieldsUpdate(record, ticketDetails, contactDetails) {
  console.log("Before : ", record.data);
  var fieldNames = Object.keys(record.data).filter(function(e) { 
    return this.indexOf(e) < 0
  }, ['responder_id', 'ticket_id']);
  let flag = false;
  fieldNames.forEach(element => {
    if(ticketDetails.custom_fields[element] !== record.data[element]) {  
      flag = true
      if(element == 'cf_fsm_phone_number') {
        record.data[element] = Number(ticketDetails.custom_fields[element]);
      } else if((element === 'cf_fsm_appointment_start_time' && 'cf_fsm_appointment_end_time')) {
        record.data[element] = new Date(ticketDetails.custom_fields[element]).toISOString()
      } else {
        record.data[element] = ticketDetails.custom_fields[element]
      }
    } 
  });
  console.log("After : ", record.data, flag);
  updateCalendarEvent(flag, record.data);
}

function updateCalendarEvent(flag, record) {
  if(flag) {
    console.log("!!!!!! Test !!!!!!");
    var options = { "url" : "test" };
    client.request.invoke("serverMethod", options).then(function(data) {
      console.log(data);
    }, function(err) {
      console.log(err);
    });
  }
}
