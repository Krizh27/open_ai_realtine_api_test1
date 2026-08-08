const CONFIG = {
    // Stage 4 limits (will be implemented in next stages)
    MAX_INPUT_SECONDS: 15,
    MAX_OUTPUT_SECONDS: 10
};

// UI Elements
const mainStatus = document.getElementById('main-status');
const micStatus = document.getElementById('mic-status');
const aiStatus = document.getElementById('ai-status');
const sessionStatus = document.getElementById('session-status');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const debugLog = document.getElementById('debug-log');

let peerConnection = null;
let audioEl = null;
let mediaStream = null;

function log(msg) {
    console.log(msg);
    const time = new Date().toLocaleTimeString();
    debugLog.innerHTML += `<div>[${time}] ${msg}</div>`;
    debugLog.scrollTop = debugLog.scrollHeight;
}

startBtn.addEventListener('click', async () => {
    try {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        mainStatus.innerText = "Connecting...";
        log("Starting conversation...");

        // 1. Fetch temporary token from /token.
        log("Requesting temporary token...");
        const tokenResponse = await fetch("/token");
        if (!tokenResponse.ok) throw new Error("Failed to get token");
        const tokenData = await tokenResponse.json();
        const EPHEMERAL_KEY = tokenData.client_secret;
        log("Token received.");

        // 2. Create RTCPeerConnection.
        log("Creating RTCPeerConnection...");
        peerConnection = new RTCPeerConnection();

        // 10. Play incoming AI audio using an HTML audio element.
        // We set up the event listener for when OpenAI sends its audio track
        audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        peerConnection.ontrack = e => {
            log("Received audio track from AI.");
            audioEl.srcObject = e.streams[0];
            aiStatus.innerText = "Speaking";
        };

        // 3. Get microphone using navigator.mediaDevices.getUserMedia().
        log("Requesting microphone permission...");
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        log("Microphone permission granted.");
        micStatus.innerText = "Active";

        // 4. Add microphone tracks to the peer connection.
        log("Adding microphone track to connection...");
        peerConnection.addTrack(mediaStream.getTracks()[0]);

        // 5. Create SDP offer.
        log("Creating SDP offer...");
        const offer = await peerConnection.createOffer();

        // 6. Set local description.
        log("Setting local description...");
        await peerConnection.setLocalDescription(offer);

        // 7. Send SDP offer to OpenAI Realtime endpoint.
        const baseUrl = "https://api.openai.com/v1/realtime/calls";
        log("Sending SDP offer to OpenAI...");
        
        const sdpResponse = await fetch(baseUrl, {
            method: "POST",
            body: offer.sdp,
            headers: {
                Authorization: `Bearer ${EPHEMERAL_KEY}`,
                "Content-Type": "application/sdp"
            }
        });

        if (!sdpResponse.ok) {
            const errText = await sdpResponse.text();
            throw new Error(`OpenAI SDP Request failed: ${sdpResponse.status} - ${errText}`);
        }

        const answerSdp = await sdpResponse.text();

        // 8. Receive SDP answer.
        log("Received SDP answer from OpenAI.");

        // 9. Set remote description.
        log("Setting remote description...");
        const answer = { type: "answer", sdp: answerSdp };
        await peerConnection.setRemoteDescription(answer);

        log("Connected to Realtime API.");
        mainStatus.innerText = "Connected";
        sessionStatus.innerText = "Active";

    } catch (err) {
        log(`Error: ${err.message}`);
        mainStatus.innerText = "Error";
        stopConversation();
    }
});

stopBtn.addEventListener('click', stopConversation);

function stopConversation() {
    log("Stopping conversation...");
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    
    if (audioEl) {
        audioEl.srcObject = null;
        audioEl = null;
    }

    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    mainStatus.innerText = "Disconnected";
    micStatus.innerText = "Ready";
    aiStatus.innerText = "Ready";
    sessionStatus.innerText = "Stopped";
    log("Session stopped.");
}
