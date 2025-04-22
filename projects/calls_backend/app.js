const express = require('express');
const axios = require('axios');
const app = express();

const INFOBIP_API_KEY = ""; // Fill your Infobip API key here
const MEDIA_STREAM_CONFIG = ""; // Your media stream config

const ibClient = axios.create({
    headers: { "Authorization": `App ${INFOBIP_API_KEY}` }
});

async function handleCallReceived(event) {
    const callId = event.callId;
    console.log(`Received call ${callId}, creating a dialog...`);

    const response = await ibClient.post(`https://api.infobip.com/calls/1/dialogs`, {
        parentCallId: callId,
        childCallRequest: {
            endpoint: {
                type: "WEBSOCKET",
                websocketEndpointConfigId: `${MEDIA_STREAM_CONFIG}`
            }
        }
    });
    const responseData = response.data;
    console.log(`Created dialog with ID ${responseData.id}`);
}

app.use(express.json());

app.post('/webhook', async (req, res) => {
    // A new Infobip calls event is received. For more information about possible events and their model, see here:
    // https://www.infobip.com/docs/api/channels/voice/calls/calls-applications/calls-event-webhook
    const event = await req.body;
    console.log("Received event from Infobip: ", event);

    const type = event.type;
    switch (type) {
        case "CALL_RECEIVED":
            handleCallReceived(event);
            break;
        // Handle others, once you add more events to your subscriptions
    }

    res.status(200).send();
});

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000')
});
