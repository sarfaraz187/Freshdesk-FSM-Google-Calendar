const helpers = require("./helper");

exports = {
  events: [
    { event: "onTicketCreate", callback: "onTicketCreateCallback" },
    { event: "onTicketUpdate", callback: "onTicketUpdateCallback" }
  ],
  onTicketCreateCallback: async function(payload) {
    console.log("----------------- On Ticket Create ---------------------");
    checkTicketType(payload);
  },
  onTicketUpdateCallback: async function(payload) {
    console.log("----------------- On Ticket Update ---------------------");
    let ticketDetails = payload.data.ticket;
    const $entity = $db.entity({ version: 'v1' });
    const responseFromDb = await $entity.get('fsm_records');
    console.log(ticketDetails.id)
    responseFromDb.getAll({
      query : { 'ticket_id': ticketDetails.id }
    }).then(function(data) {
      console.log("Data : ", data);
    }).catch(function(err) {
      console.log(err);
    });
  }
}

async function checkTicketType(payload) {
  let ticketDetails = payload.data.ticket;
  // console.log(ticketDetails);
  let start_time = ticketDetails.custom_fields["cf_fsm_appointment_start_time"];
  let end_time = ticketDetails.custom_fields["cf_fsm_appointment_end_time"]
  if((ticketDetails.type === "Service Task") && (ticketDetails.responder_id !== null) && start_time && end_time) {
    let response = await helpers.requestApi({ url: `api/v2/agents/${ticketDetails.responder_id}`, method: 'get', iparams : payload.iparams });
    // console.log(JSON.parse(response));
    let agentDetails = JSON.parse(response);
    createCalendarEvent(ticketDetails, agentDetails, start_time, end_time, payload.iparams);
  }
}

async function createCalendarEvent(ticketDetails, agentDetails, start_time, end_time, iparams) {
  let descriptionBody = `    
    <b>Contact Name : </b>${ticketDetails.custom_fields["cf_fsm_contact_name"]}
    <b>Phone Number : </b>${ticketDetails.custom_fields["cf_fsm_phone_number"]}
    <b>Description : </b>${ticketDetails.description_text}`
  if(agentDetails.contact.email) {
    let eventPayload = {
      'summary': ticketDetails.subject,
      'location': ticketDetails.custom_fields["cf_fsm_service_location"],
      'description': descriptionBody ,
      'start': {
        'dateTime': start_time,
        'timeZone': 'UTC',
      },
      'end': {
        'dateTime': end_time,
        'timeZone': 'UTC',
      },
      'attendees': [
        {'email': agentDetails.contact.email }
      ],
    }
    console.log("Event payload on Create : ", eventPayload);
    let response = await helpers.calendarApi({ method : 'post', type : `calendars/${iparams.calendarId}/events`, body : JSON.stringify(eventPayload), iparams : iparams });
    console.log(response);
    (response.status == 200 || 202) ? storeInDb(ticketDetails, agent_email, start_time, end_time) : '';
    // storeInDb(ticketDetails, agentDetails, start_time, end_time, iparams);
  }
}

async function storeInDb (ticketDetails, agentDetails, start_time, end_time) {
  const $entity = $db.entity({ version: 'v1' });
  const responseFromDb = await $entity.get('fsm_records').create({
    'ticket_id': ticketDetails.id,
    'responder_id' : agentDetails.id,
    'cf_fsm_contact_name': ticketDetails.custom_fields["cf_fsm_contact_name"],
    'cf_fsm_service_location' : ticketDetails.custom_fields["cf_fsm_service_location"],
    'cf_fsm_phone_number' : Number(ticketDetails.custom_fields["cf_fsm_phone_number"]),
    'cf_fsm_appointment_start_time' : new Date(start_time).toISOString(),
    'cf_fsm_appointment_end_time' : new Date(end_time).toISOString()
  });
  // .then(data => console.log(data)).catch(err => console.log(err));
  console.log({ responseFromDb })
}