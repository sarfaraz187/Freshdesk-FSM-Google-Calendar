const helpers = require("./helper");

exports = {
  events: [
    { event: "onTicketCreate", callback: "onTicketCreateCallback" },
    { event: "onTicketUpdate", callback: "onTicketUpdateCallback" }
  ],
  onTicketCreateCallback: async function(payload) {
    console.log(`----------------- On Ticket Create : ${payload.data.ticket.id} ---------------------`);
    checkTicketType(payload.data.ticket, '', payload.iparams);
  },
  onTicketUpdateCallback: async function(payload) {
    console.log(`----------------- On Ticket Update : ${payload.data.ticket.id} ---------------------`);
    const $entity = $db.entity({ version: 'v1' });
    const responseFromDb = await $entity.get('fsm_records');
    responseFromDb.getAll({
      query : { 'ticket_id': payload.data.ticket.id }
    }).then(function(dbData) {
      console.log(dbData.records);
      (dbData.records.length === 0) ? checkTicketType(payload.data.ticket, '', payload.iparams) : checkTicketType(payload.data.ticket, dbData.records[0], iparams) ;
    }, err => {
      console.log(err);
    });
  },
  serverMethod : async function (payload) {
    console.log("----------------- SMI Update Event ---------------------");
    checkTicketType(payload.ticket, payload.record, payload.iparams);
    renderData(null, {});
  }
}

async function checkTicketType(ticketDetails, record, iparams) {
  let start_time = ticketDetails.custom_fields["cf_fsm_appointment_start_time"];
  let end_time = ticketDetails.custom_fields["cf_fsm_appointment_end_time"];
  if((ticketDetails.type === "Service Task") && (ticketDetails.responder_id !== null) && start_time && end_time) {
    let response = await helpers.requestApi({ url: `api/v2/agents/${ticketDetails.responder_id}`, method: 'get', iparams : iparams });
    let agentDetails = JSON.parse(response);
    record ? updateCalendarEvent(ticketDetails, agentDetails, iparams, record) : createCalendarEvent(ticketDetails, agentDetails, iparams);
  }
}

async function createCalendarEvent(ticketDetails, agentDetails, iparams) {
  if(agentDetails.contact.email) {
    let eventPayload = await getEventObj(ticketDetails, agentDetails);
    console.log("Event payload on Create : ", eventPayload);
    let response = await helpers.calendarApi({ method : 'post', type : `calendars/${iparams.calendarId}/events`, body : JSON.stringify(eventPayload), iparams : iparams });
    console.log(response);
    let eventID = JSON.parse(response.response).id;
    console.log(eventID);    
    (response.status == 200 || 202) ? storeInDB(ticketDetails, agentDetails, eventID) : '';
    // storeInDB(ticketDetails, agentDetails, iparams);
  }
}

async function updateCalendarEvent(ticketDetails, agentDetails, iparams, record) {
  console.log("------------- Inside Update Event -------------");
  if(agentDetails.contact.email) {
    let eventPayload = await getEventObj(ticketDetails, agentDetails);
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

async function getEventObj(ticketDetails, agentDetails) {
  let descriptionBody = `    
    <b>Contact Name : </b>${ticketDetails.custom_fields["cf_fsm_contact_name"]}
    <b>Phone Number : </b>${ticketDetails.custom_fields["cf_fsm_phone_number"]}
    <b>Description : </b>${ticketDetails.description_text}`;
  let obj = {
    'summary': ticketDetails.subject,
    'location': ticketDetails.custom_fields["cf_fsm_service_location"],
    'description': descriptionBody ,
    'start': {
      'dateTime': ticketDetails.custom_fields["cf_fsm_appointment_start_time"],
      'timeZone': 'UTC',
    },
    'end': {
      'dateTime': ticketDetails.custom_fields["cf_fsm_appointment_end_time"],
      'timeZone': 'UTC',
    },
    'attendees': [
      {'email': agentDetails.contact.email }
    ]
  }
  return obj
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
    'cf_fsm_appointment_end_time' : new Date(ticketDetails.custom_fields["cf_fsm_appointment_end_time"]).toISOString()
  }
}