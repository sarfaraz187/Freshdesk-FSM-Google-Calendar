const moment = require("moment");
const helpers = require("./helper");

exports = {
  events: [
    { event: "onTicketCreate", callback: "onTicketCreateCallback" },
    { event: "onTicketUpdate", callback: "onTicketUpdateCallback" },
    { event: "onAppInstall", callback: "onAppInstallCallback" },
    { event: "onScheduledEvent", callback: "onScheduledEventHandler" }
  ],
  onTicketCreateCallback: async function(payload) {
    console.log(`----------------- On Ticket Create : ${payload.data.ticket.id} ---------------------`);
    payload.data.ticket["custom_fields"] = await getCustomFieldObj(payload);
    console.log(payload.data.ticket.custom_fields);
    checkTicketType(payload.data.ticket, '', payload.iparams);
  },
  onTicketUpdateCallback: async function(payload) {
    console.log(`----------------- On Ticket Update : ${payload.data.ticket.id} ---------------------`);
    payload.data.ticket["custom_fields"] = await getCustomFieldObj(payload);
    const $entity = $db.entity({ version: 'v1' });
    const responseFromDb = await $entity.get('fsm_records');
    responseFromDb.getAll({
      query : { 'ticket_id': payload.data.ticket.id }
    }).then(function(dbData) {
      console.log("Records from entity : ", dbData.records);
      if(dbData.records.length === 0) {
        console.log("Inside create calendar event !!!!!");
        checkTicketType(payload.data.ticket, '', payload.iparams); 
      } else {
        console.log("Inside update calendar event !!!!!");
        (payload.data.ticket.status === 5) ? deleteCalendarEvent(dbData.records[0], payload.iparams) : checkTicketType(payload.data.ticket, dbData.records[0], payload.iparams); 
      }
    }, err => console.log(err));
  },
  serverMethod : async function (payload) {
    console.log("----------------- SMI Update Event ---------------------");
    console.log(payload.record);
    checkTicketType(payload.ticket, payload.record, payload.iparams);
    renderData(null, {});
  },
  onAppInstallCallback: function() {
    // $schedule.delete({ name: "update_calendar" }).then(data => console.log(data) ,err => console.log(err));
    console.log(`-------- On App Install : ${moment().startOf('second').toISOString()} ---------`);
    reccuringSchduler(moment().startOf('second').toISOString());
    renderData();
  },
  onScheduledEventHandler: async function(payload) {
    console.log("----------------- Scheduled Event ---------------------");
    let time = moment().subtract(5, "minutes").startOf('second').toISOString();
    console.log(`Time to search : ${time}`);
    let response = await helpers.requestApi({ url: `api/v2/tickets?updated_since=${time}&per_page=100`, method: 'get', iparams : payload.iparams });
    console.log("Response :", response.data);
    filterTickets(response.data, payload.iparams);
  }
}

async function checkTicketType(ticketDetails, record, iparams) {
  console.log(JSON.stringify(ticketDetails.custom_fields), ticketDetails.responder_id);
  //cf_fsm_appointment_start_time_1033292
  let start_time = ticketDetails.custom_fields["cf_fsm_appointment_start_time"];
  let end_time = ticketDetails.custom_fields["cf_fsm_appointment_end_time"];
  if((ticketDetails.type === "Service Task") && (ticketDetails.responder_id !== null) && start_time && end_time) {
    let response = await helpers.requestApi({ url: `api/v2/agents/${ticketDetails.responder_id}`, method: 'get', iparams : iparams });
    console.log(response.data)
    record ? updateCalendarEvent(ticketDetails, response.data, iparams, record) : createCalendarEvent(ticketDetails, response.data, iparams);
  } else {
    // delete calendad Event and delet record in database
    deleteCalendarEvent(record, iparams);
  }
}

async function deleteCalendarEvent(record, iparams) {
  console.log("------------ Inside Calendar Delete Event ------------");
  if(record) {    
    const $entity = $db.entity({ version: 'v1' });
    const responseFromDb = await $entity.get('fsm_records');
    let response = await helpers.calendarApi({ method : 'delete', type : `calendars/${iparams.calendarId}/events/${record.data.event_id}`, iparams : iparams });
    console.log("Calendar Response on Delete : ", response.status, record.display_id);
    responseFromDb.delete(record.display_id).then(dbData => {
      console.log("Response from delete : ", dbData);
    }, err => console.log(err));
  } else {
    console.log("Inside else");
  }
}

async function createCalendarEvent(ticketDetails, agentDetails, iparams) {
  console.log("------------ Inside Create Calendar Event ------------");
  if(agentDetails.contact.email) {
    let eventPayload = await getEventObj(ticketDetails, agentDetails, iparams);
    console.log("Event payload on Create : ", eventPayload, iparams);
    let response = await helpers.calendarApi({ method : 'post', type : `calendars/${iparams.calendarId}/events`, body : JSON.stringify(eventPayload), iparams : iparams });
    console.log(response);
    let eventID = JSON.parse(response.response).id;
    console.log(eventID);    
    (response.status == 200 || 202) ? storeInDB(ticketDetails, agentDetails, eventID) : '';
    storeInDB(ticketDetails, agentDetails, iparams);
  }
}

async function updateCalendarEvent(ticketDetails, agentDetails, iparams, record) {
  console.log("------------- Inside Update Event -------------");
  // console.log(agentDetails, agentDetails.contact.email);  
  if(agentDetails.contact.email) {
    let eventPayload = await getEventObj(ticketDetails, agentDetails, iparams);
    let response = await helpers.calendarApi({ method : 'put', type : `calendars/${iparams.calendarId}/events/${record.data.event_id}`, body : JSON.stringify(eventPayload), iparams : iparams });
    let eventID = JSON.parse(response.response).id;
    console.log("Event ID on update :", eventID);
    (response.status == 200 || 202) ? updateInDB(ticketDetails, agentDetails, record.display_id, eventID) : '';
  }
}

async function storeInDB(ticketDetails, agentDetails, eventID) {
  const $entity = $db.entity({ version: 'v1' });
  let dbObj = await getDbeObj(ticketDetails, agentDetails, eventID);
  const responseFromDb = await $entity.get('fsm_records').create(dbObj);
  // .then(data => console.log(data)).catch(err => console.log(err));
  console.log(responseFromDb);
}

async function updateInDB(ticketDetails, agentDetails, display_id, eventID) {
  const $entity = $db.entity({ version: 'v1' });
  console.log(eventID)
  let dbObj = await getDbeObj(ticketDetails, agentDetails, eventID); 
  const responseFromDb = await $entity.get('fsm_records')
  responseFromDb.update(display_id, dbObj).then(dbData => {
    console.log("Response from Update : ", dbData);
  }, err => {
    console.log(err);
  });
}

async function filterTickets(response, iparams) {
  const $entity = $db.entity({ version: 'v1' });
  const responseFromDb = await $entity.get('fsm_records');
  const ticketsList = response.filter( x => x.type == 'Service Task' && x.status !== 5);
  if(ticketsList.length > 0) {
    asyncForEach(ticketsList, async (tkt_obj) => {
      isServiceTaskUpdated(tkt_obj, responseFromDb, iparams);
    });
  } else console.log("No Service Tickets to process !!!");
}

async function isServiceTaskUpdated(tkt_obj, responseFromDb, iparams) {
  responseFromDb.getAll({
    query : { 'ticket_id': tkt_obj.id }
  }).then(function(dbData) {
    let recordData = dbData.records[0].data;
    console.log(`Tkt ${tkt_obj.id} :`, moment(tkt_obj.updated_at).startOf('second').toISOString());
    console.log(`Record ${recordData.ticket_id} :`, recordData.updated_at);
    let fieldsToCheck = ['responder_id', 'cf_fsm_appointment_start_time', 'cf_fsm_appointment_end_time'];
    if(moment(tkt_obj.updated_at).startOf('second').toISOString() !== recordData.updated_at) {
      let flag = false;
      for (const field of fieldsToCheck) {
        // console.log("------------------------");
        // console.log(field)
        // console.log(moment(tkt_obj.custom_fields[field]).toISOString())
        // console.log(recordData[field]);
        // console.log("------------------------");
        if(field === 'responder_id') {
          if(tkt_obj[field] !== recordData[field]) {
            console.log("Inside 2");
            flag = true;
            break;
          }
        } else if(moment(tkt_obj.custom_fields[field]).toISOString() !== recordData[field]) {
          console.log("Inside 1");
          flag = true;
          break;
        } else {
          console.log("!!!! All conditions Match !!!");
        }
      }
      flag ? checkTicketType(tkt_obj, dbData.records[0], iparams) : '';
    } else {
      console.log(false);
    }
  }, err => console.log(err));
}

async function getEventObj(ticketDetails, agentDetails, iparams) {
  console.log("Inside get body : ", ticketDetails.custom_fields);
  let descriptionBody = `    
    <b>Contact Name : </b>${ticketDetails.custom_fields["cf_fsm_contact_name"]}
    <b>Phone Number : </b>${ticketDetails.custom_fields["cf_fsm_phone_number"]}
    <b>Description : </b>${ticketDetails.description_text}`;
  return obj = {
    'summary': ticketDetails.subject,
    'location': ticketDetails.custom_fields["cf_fsm_service_location"],
    'description': descriptionBody ,
    'start': {
      'dateTime': ticketDetails.custom_fields["cf_fsm_appointment_start_time"],
      'timeZone': iparams.timeZone,
    },
    'end': {
      'dateTime': ticketDetails.custom_fields["cf_fsm_appointment_end_time"],
      'timeZone': iparams.timeZone,
    },
    'attendees': [
      {'email': agentDetails.contact.email }
    ]
  }
}

async function getDbeObj(ticketDetails, agentDetails, eventID) {
  return {
    'ticket_id': ticketDetails.id,
    'event_id' : eventID,
    'responder_id' : agentDetails.id,
    'cf_fsm_contact_name': ticketDetails.custom_fields["cf_fsm_contact_name"],
    'cf_fsm_service_location' : ticketDetails.custom_fields["cf_fsm_service_location"],
    'cf_fsm_phone_number' : ticketDetails.custom_fields["cf_fsm_phone_number"],
    'cf_fsm_appointment_start_time' : new Date(ticketDetails.custom_fields["cf_fsm_appointment_start_time"]).toISOString(),
    'cf_fsm_appointment_end_time' : new Date(ticketDetails.custom_fields["cf_fsm_appointment_end_time"]).toISOString(),
    'updated_at' : new Date(ticketDetails.updated_at).toISOString()
  }
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

function reccuringSchduler(timeAt) {
  $schedule.create({
    name: "update_calendar",
    data: {},
    schedule_at: timeAt,
    repeat: { time_unit: "minutes", frequency: 5 }
  }).then(function(data) {
    console.log(data)
  }, err => console.log(err));
}

async function getCustomFieldObj(payload) {
  let custom_fields = payload.data.ticket.custom_fields;
  let fsm_fields = Object.keys(custom_fields).filter(filterFsmFields);
  // console.log(fsm_fields)
  // let tempArr = [];
  let tempObj = new Object();
  fsm_fields.forEach(field_name => {
    // console.log(field_name)
    let formatCustomField = field_name.split('_');
    // console.log(formatCustomField)
    if(Number(formatCustomField[formatCustomField.length - 1]) > 0) {
      formatCustomField.pop();
      let key = formatCustomField.join("_");
      let value = custom_fields[field_name];
      tempObj[key] = value;
      // console.log(key, value);
    } else {        
      tempObj[field_name] = custom_fields[field_name]
    }
  });
  return tempObj
}

function filterFsmFields(item) {
  return item.toLowerCase().indexOf('cf_fsm') === 0;
}