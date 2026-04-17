const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fetch = require("node-fetch");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("client"));

//  GOOGLE TRANSLATION FUNCTION
async function translateText(text) {
    try {
        const res = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(text)}`
        );

        const data = await res.json();

        return data[0].map(item => item[0]).join("");

    } catch (err) {
        console.error("Translation error:", err);
        return "👉 " + text;
    }
}

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId) => {
        socket.join(roomId);
        socket.roomId = roomId;

        socket.to(roomId).emit("user-connected");
    });

    socket.on("signal", (data) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit("signal", data);
        }
    });

    // TRANSLATION HAPPENS HERE
    socket.on("send-text", async (text) => {
        const translated = await translateText(text);

        socket.to(socket.roomId).emit("receive-text", {
            original: text,
            translated: translated
        });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

server.listen(3000, () => {
    console.log("Server running on port 3000");
});
