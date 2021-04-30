**FSM - Google Calendar (BuildToWin)**

**UseCase**

The application lets agents get a calendar event notification whenever a new Service Task is created or updated in Freshdesk. The App creates a calendar event to the agents who gets assigned to the service task.

**App Location**

1. Ticket Background App
2. Serverless Application

**Features**

1. When a service task is assigned to an agent. A calnedar event gets created to the respective agent's calendar.
2. When a service task is reassigned to another agnet the calendar event gets deleted and new event get's created to the assigned agent.
3. Appointment start and end date are in sync with the calendar events.
4. Once the ticket is closed the calendar event is deleted.

**Complexities**

Since there is a scheduling dashboard present for updating services task in Freshdesk. Any update done for the dashboard is not captured by the application. Hence in order to overcome this issue a recurring schedular has been initiated which will run every 5 minutes to check if there were any updated done the ticket.

The fetched ticket will be verified with custom objects records to check if there has been change of agent or assigned start and end time. If there are changes found the respective calendar events will be updated accordingly. 

Since the app is making API calls every 5 mins the number of ticket to be processed is reduced significantly and the schedular time out is not reached.




