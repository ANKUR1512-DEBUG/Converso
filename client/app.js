const socket = io();


// ======================================================
// VARIABLES
// ======================================================

let localStream = null;
let peerConnection = null;

let pendingCandidates = [];

let isListening = false;
let isMuted = false;

let myLanguage = null;


// ======================================================
// WEBRTC
// ======================================================

const servers = {

    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]

};


// ======================================================
// JOIN ROOM
// ======================================================

async function joinRoom() {

    const roomId =
        document.getElementById("roomInput").value.trim();

    myLanguage =
        document.getElementById("languageSelect").value;


    if (!roomId) {

        alert("Please enter a room code.");

        return;
    }


    if (!myLanguage) {

        alert("Please select your language.");

        return;
    }


    try {

        // Get microphone
        localStream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });


        // Local audio
        document.getElementById(
            "localAudio"
        ).srcObject = localStream;


        // Update status
        document.getElementById(
            "roomStatus"
        ).innerText =
            `Connected • ${getLanguageName(myLanguage)}`;


        // Tell server
        socket.emit("join-room", {

            roomId: roomId,

            language: myLanguage

        });


        console.log(
            "Joined room:",
            roomId,
            "Language:",
            myLanguage
        );


    } catch (error) {

        console.error(error);

        alert(
            "Microphone permission is required."
        );

        return;
    }

}


// ======================================================
// LANGUAGE NAME
// ======================================================

function getLanguageName(language) {

    if (language.startsWith("en")) {

        return "English";

    }

    if (language.startsWith("hi")) {

        return "Hindi";

    }

    return language;
}


// ======================================================
// USER CONNECTED
// ======================================================

socket.on("user-connected", () => {

    console.log("Other user connected.");

    createPeer(true);

});


// ======================================================
// RECEIVE TRANSLATION
// ======================================================

socket.on("receive-text", (data) => {

    const chatBox =
        document.getElementById("chatBox");


    const msg =
        document.createElement("div");


    msg.className = "msg other";


    msg.innerText =
        "🌐 " + data.translated;


    chatBox.appendChild(msg);


    chatBox.scrollTop =
        chatBox.scrollHeight;

});


// ======================================================
// WEBRTC SIGNAL
// ======================================================

socket.on("signal", async (data) => {

    try {

        if (!peerConnection) {

            createPeer(false);

        }


        // ------------------------------
        // SDP
        // ------------------------------

        if (data.sdp) {

            await peerConnection.setRemoteDescription(
                data.sdp
            );


            // Add queued ICE candidates

            for (
                const candidate
                of pendingCandidates
            ) {

                await peerConnection.addIceCandidate(
                    candidate
                );

            }


            pendingCandidates = [];


            // If offer, create answer

            if (
                data.sdp.type === "offer"
            ) {

                const answer =
                    await peerConnection.createAnswer();


                await peerConnection.setLocalDescription(
                    answer
                );


                socket.emit("signal", {

                    sdp:
                        peerConnection.localDescription

                });

            }

        }


        // ------------------------------
        // ICE candidate
        // ------------------------------

        if (data.candidate) {

            const candidate =
                new RTCIceCandidate(
                    data.candidate
                );


            if (
                peerConnection.remoteDescription
            ) {

                await peerConnection.addIceCandidate(
                    candidate
                );

            }

            else {

                pendingCandidates.push(
                    candidate
                );

            }

        }

    }

    catch (error) {

        console.error(
            "WebRTC signaling error:",
            error
        );

    }

});


// ======================================================
// CREATE PEER
// ======================================================

function createPeer(isInitiator) {

    peerConnection =
        new RTCPeerConnection(
            servers
        );


    // Add microphone tracks

    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => {

                peerConnection.addTrack(
                    track,
                    localStream
                );

            });

    }


    // Receive remote audio

    peerConnection.ontrack =
        (event) => {

            document.getElementById(
                "remoteAudio"
            ).srcObject =
                event.streams[0];

        };


    // ICE candidates

    peerConnection.onicecandidate =
        (event) => {

            if (event.candidate) {

                socket.emit("signal", {

                    candidate:
                        event.candidate

                });

            }

        };


    // Connection status

    peerConnection.onconnectionstatechange =
        () => {

            console.log(
                "WebRTC state:",
                peerConnection.connectionState
            );

        };


    // Initiator creates offer

    if (isInitiator) {

        peerConnection
            .createOffer()
            .then(offer => {

                return peerConnection.setLocalDescription(
                    offer
                );

            })
            .then(() => {

                socket.emit("signal", {

                    sdp:
                        peerConnection.localDescription

                });

            })
            .catch(error => {

                console.error(
                    "Offer error:",
                    error
                );

            });

    }

}


// ======================================================
// MUTE / UNMUTE
// ======================================================

function toggleMute() {

    if (!localStream) {

        alert(
            "Please join a room first."
        );

        return;
    }


    const audioTracks =
        localStream.getAudioTracks();


    if (audioTracks.length === 0) {

        alert(
            "No microphone found."
        );

        return;
    }


    isMuted = !isMuted;


    audioTracks.forEach(track => {

        track.enabled = !isMuted;

    });


    const muteBtn =
        document.getElementById(
            "muteBtn"
        );


    if (isMuted) {

        muteBtn.innerText =
            "🔊 Unmute";

        muteBtn.classList.add(
            "unmuted"
        );

    }

    else {

        muteBtn.innerText =
            "🎤 Mute";

        muteBtn.classList.remove(
            "unmuted"
        );

    }


    console.log(
        isMuted
            ? "Microphone muted"
            : "Microphone unmuted"
    );

}


// ======================================================
// SPEECH RECOGNITION
// ======================================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


let recognition = null;


if (SpeechRecognition) {

    recognition =
        new SpeechRecognition();


    recognition.continuous = true;

    recognition.interimResults = false;


    recognition.onresult =
        (event) => {

            let finalText = "";


            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                if (
                    event.results[i].isFinal
                ) {

                    finalText +=
                        event.results[i][0]
                            .transcript;

                }

            }


            finalText =
                finalText.trim();


            if (!finalText) {

                return;

            }


            // Show our message

            addMyMessage(
                finalText
            );


            // Send to server

            socket.emit(
                "send-text",
                finalText
            );

        };


    recognition.onerror =
        (event) => {

            console.error(
                "Speech recognition error:",
                event.error
            );

        };


    recognition.onend =
        () => {

            if (isListening) {

                try {

                    recognition.start();

                }

                catch (error) {

                    console.log(
                        "Recognition restart:",
                        error.message
                    );

                }

            }

        };

}


// ======================================================
// START LISTENING
// ======================================================

function startListening() {

    if (!recognition) {

        alert(
            "Speech Recognition is not supported. Please use Google Chrome."
        );

        return;

    }


    if (!myLanguage) {

        alert(
            "Please join a room first."
        );

        return;

    }


    if (isListening) {

        return;

    }


    // Set recognition language

    recognition.lang =
        myLanguage;


    try {

        recognition.start();

        isListening = true;

        console.log(
            "Listening in:",
            myLanguage
        );

    }

    catch (error) {

        console.error(
            "Could not start recognition:",
            error
        );

    }

}


// ======================================================
// STOP LISTENING
// ======================================================

function stopListening() {

    if (!recognition) {

        return;

    }


    isListening = false;


    try {

        recognition.stop();

    }

    catch (error) {

        console.log(
            error
        );

    }

}


// ======================================================
// ADD MY MESSAGE
// ======================================================

function addMyMessage(text) {

    const chatBox =
        document.getElementById(
            "chatBox"
        );


    const msg =
        document.createElement("div");


    msg.className =
        "msg me";


    msg.innerText =
        text;


    chatBox.appendChild(
        msg
    );


    chatBox.scrollTop =
        chatBox.scrollHeight;

}