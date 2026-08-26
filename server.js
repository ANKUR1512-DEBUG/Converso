const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve frontend
app.use(express.static("client"));


// =====================================================
// HUGGING FACE TRANSLATION
// =====================================================

async function translateText(text, sourceLang, targetLang) {
    try {
        // Convert Chrome speech-recognition language codes
        // into the language codes expected by our models.

        const source = sourceLang.startsWith("en") ? "en" : "hi";
        const target = targetLang.startsWith("en") ? "en" : "hi";

        // Same language → no translation needed
        if (source === target) {
            return text;
        }

        let model;

        // English → Hindi
        if (source === "en" && target === "hi") {
            model = "Helsinki-NLP/opus-mt-en-hi";
        }

        // Hindi → English
        else if (source === "hi" && target === "en") {
            model = "Helsinki-NLP/opus-mt-hi-en";
        }

        else {
            console.log(
                `Unsupported translation: ${source} → ${target}`
            );

            return text;
        }

        console.log(`Translation: ${source} → ${target}`);
        console.log(`Model: ${model}`);
        console.log(`Text: ${text}`);

        // Hugging Face API
        const url =
            `https://router.huggingface.co/hf-inference/models/${model}`;

        const response = await fetch(url, {
            method: "POST",

            headers: {
                "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                inputs: text
            })
        });

        const responseText = await response.text();

        // Handle API errors
        if (!response.ok) {

            console.error(
                `Hugging Face error ${response.status}:`,
                responseText
            );

            return text;
        }

        let data;

        try {
            data = JSON.parse(responseText);
        }

        catch (error) {

            console.error(
                "Could not parse Hugging Face response:",
                responseText
            );

            return text;
        }


        // Extract translation
        if (
            Array.isArray(data) &&
            data.length > 0 &&
            data[0].translation_text
        ) {

            const translated = data[0].translation_text;

            console.log(`Translated: ${translated}`);

            return translated;
        }


        console.error(
            "Unexpected Hugging Face response:",
            data
        );

        return text;

    }

    catch (error) {

        console.error(
            "Translation error:",
            error.message
        );

        // Never crash Converso if translation fails
        return text;
    }
}


// =====================================================
// SOCKET.IO
// =====================================================

io.on("connection", (socket) => {

    console.log("User connected:", socket.id);


    // =================================================
    // JOIN ROOM
    // =================================================

    socket.on("join-room", ({ roomId, language }) => {

        if (!roomId || !language) {

            console.log(
                "Invalid room information received."
            );

            return;
        }

        socket.join(roomId);

        socket.roomId = roomId;
        socket.language = language;

        console.log(
            `User ${socket.id} joined room ${roomId} using ${language}`
        );

        // Tell existing users someone joined
        socket.to(roomId).emit("user-connected");
    });


    // =================================================
    // WEBRTC SIGNALING
    // =================================================

    socket.on("signal", (data) => {

        if (!socket.roomId) {

            console.log(
                "User has not joined a room properly."
            );

            return;
        }

        socket.to(socket.roomId).emit("signal", data);
    });


    // =================================================
    // TRANSLATION
    // =================================================

    socket.on("send-text", async (text) => {

        if (!socket.roomId || !socket.language) {

            console.log(
                "User has not joined a room properly."
            );

            return;
        }

        // Ignore empty messages
        if (
            typeof text !== "string" ||
            text.trim().length === 0
        ) {

            return;
        }

        console.log(
            `Received from ${socket.language}: ${text}`
        );


        // Get everyone in the room
        const room =
            io.sockets.adapter.rooms.get(socket.roomId);

        if (!room) {

            console.log("Room not found.");

            return;
        }


        // Send translated text to every OTHER user
        for (const socketId of room) {

            // Don't send back to sender
            if (socketId === socket.id) {
                continue;
            }


            const otherSocket =
                io.sockets.sockets.get(socketId);

            if (
                !otherSocket ||
                !otherSocket.language
            ) {

                continue;
            }


            const sourceLanguage =
                socket.language;

            const targetLanguage =
                otherSocket.language;


            // Translate
            const translatedText =
                await translateText(
                    text,
                    sourceLanguage,
                    targetLanguage
                );


            // Send ONLY to the other user
            io.to(socketId).emit(
                "receive-text",
                {
                    original: text,
                    translated: translatedText
                }
            );
        }
    });


    // =================================================
    // DISCONNECT
    // =================================================

    socket.on("disconnect", () => {

        console.log(
            "User disconnected:",
            socket.id
        );
    });

});


// =====================================================
// START SERVER
// =====================================================

const PORT =
    process.env.PORT || 3000;

server.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );

});