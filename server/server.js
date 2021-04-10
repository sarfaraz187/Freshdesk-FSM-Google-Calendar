exports = {
  events: [
    { event: "onTicketCreate", callback: "onTicketCreateCallback" },
    { event: "onTicketUpdate", callback: "onTicketUpdateCallback" }
  ],
  onTicketCreateCallback: function() {
    // fadsfa
  },
  onTicketUpdateCallback: function() {
    // console.log("Logging arguments from onTicketUpdate event: " + JSON.stringify(payload));
  }
}