const ws = require('ws');
const http = require('http');

const OPENAI_API_KEY = ""; // Your OpenAI API KEY

const server = http.createServer();
const wss = new ws.WebSocketServer({server})

async function handleWebsocket(infobipWs) {
    let openAiWs = null;

    infobipWs.on("error", console.error);

    const setupOpenAI = async () => {
        try {
            openAiWs = new ws.WebSocket(
                "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
                null,
                {
                    headers: {
                        Authorization: `Bearer ${OPENAI_API_KEY}`,
                        "OpenAI-Beta": "realtime=v1",
                    },
                }
            );

            openAiWs.on("open", () => {
                console.log("[OpenAI] Connected to Realtime AI");
                const sessionUpdateMessage = {
                    type: "session.update",
                    session: {
                        modalities: ["audio", "text"],
                        turnDetection: {
                            type: "server_vad",
                            createResponse: true,
                        },
                        voice: "alloy",
                        inputAudioFormat: "pcm16",
                        outputAudioFormat: "pcm16",
                    }
                };
                openAiWs.send(JSON.stringify(sessionUpdateMessage));
            });

            openAiWs.on("message", data => {
                try {
                    const message = JSON.parse(data);
                    switch (message.type) {
                        case "input_audio_buffer.speech_started":
                            console.log("Speech started!");
                            console.log(`Requesting to clear buffer on Infobip socket ${infobipWs.socket.remoteAddress}`);
                            infobipWs.send(JSON.stringify({
                                action: "clear"
                            }));
                            break;
                        case "response.audio.delta":
                            const buff = Buffer.from(message.delta, "base64");
                            infobipWs.send(buff);
                            break;
                        case "session.created":
                            console.log("Session created!");
                            break;
                        default:
                            console.log(`[OpenAI] Unhandled message type: ${message.type}`);
                    }
                } catch (error) {
                    console.error("[OpenAI] Error processing message:", error);
                }
            });

            openAiWs.on("error", error => console.error("[OpenAI] WebSocket error:", error));
            openAiWs.on("close", () => console.log("[OpenAI] Disconnected"));
        } catch (error) {
            console.error("[OpenAI] Setup error:", error);
        }
    };

    // Set up OpenAI connection
    setupOpenAI();

    // Handle messages from Infobip
    infobipWs.on("message", message => {
        try {
            if (typeof message === "string") {
                // JSON event, we ignore those for now
                return
            }

            if (openAiWs?.readyState === WebSocket.OPEN) {
                const audioMessage = {
                    type: "input_audio_buffer.append",
                    audio: Buffer.from(message).toString("base64")
                };
                openAiWs.send(JSON.stringify(audioMessage));
            }
        } catch (error) {
            console.error("[Infobip] Error processing message:", error);
        }
    });

    // Handle WebSocket closure
    infobipWs.on("close", () => {
        console.log("[Infobip] Client disconnected");
        if (openAiWs?.readyState === WebSocket.OPEN) {
            openAiWs.close();
        }
    });
}

wss.on('connection', ws => handleWebsocket(ws));

server.listen(3500, () => {
    console.log(`WS Server is running on port ${server.address().port}`);
});
