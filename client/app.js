const socket = io();

let localStream;
let peerConnection;
let pendingCandidates = [];

const servers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

async function joinRoom() {
    const roomId = document.getElementById("roomInput").value;

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    document.getElementById("localAudio").srcObject = localStream;

    socket.emit("join-room", roomId);

    socket.on("user-connected", () => createPeer(true));

    socket.on("receive-text", (data) => {
        const chatBox = document.getElementById("chatBox");

        const msg = document.createElement("div");
        msg.className = "msg other";
        msg.innerText = "🌐 " + data.translated;

        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    socket.on("signal", async (data) => {
        if (!peerConnection) createPeer(false);

        if (data.sdp) {
            await peerConnection.setRemoteDescription(data.sdp);

            for (let c of pendingCandidates) {
                await peerConnection.addIceCandidate(c);
            }
            pendingCandidates = [];

            if (data.sdp.type === "offer") {
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);

                socket.emit("signal", { sdp: peerConnection.localDescription });
            }
        }

        if (data.candidate) {
            const candidate = new RTCIceCandidate(data.candidate);

            if (peerConnection.remoteDescription) {
                await peerConnection.addIceCandidate(candidate);
            } else {
                pendingCandidates.push(candidate);
            }
        }
    });
}

function createPeer(isInitiator) {
    peerConnection = new RTCPeerConnection(servers);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        document.getElementById("remoteAudio").srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("signal", { candidate: event.candidate });
        }
    };

    if (isInitiator) {
        peerConnection.createOffer()
            .then(o => peerConnection.setLocalDescription(o))
            .then(() => {
                socket.emit("signal", { sdp: peerConnection.localDescription });
            });
    }
}

// STT
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.continuous = true;

let isListening = false;

function startListening() {
    if (!isListening) {
        recognition.start();
        isListening = true;
    }
}

function stopListening() {
    isListening = false;
    recognition.stop();
}

recognition.onresult = (event) => {
    let finalText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
        }
    }

    if (finalText.trim() !== "") {
        const chatBox = document.getElementById("chatBox");

        const myMsg = document.createElement("div");
        myMsg.className = "msg me";
        myMsg.innerText = finalText;

        chatBox.appendChild(myMsg);

        socket.emit("send-text", finalText);
    }
};

recognition.onend = () => {
    if (isListening) recognition.start();
};
