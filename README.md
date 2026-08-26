**Converso — Real-Time Multilingual Voice Translation**
https://converso-2.onrender.com/

Converso is a real-time multilingual voice communication and translation web application designed to enable seamless communication between people who speak different languages. It combines WebRTC-based voice communication, speech recognition, and AI-powered translation to translate conversations in real time.

For the current implementation and simplification, the application focuses on English ↔ Hindi translation, while the underlying architecture is designed to be scalable to support additional languages and translation models in the future.
(Find the Snaps of the project in the Screenshots Section)
**Key Features:**

Real-time voice communication using WebRTC
Live speech recognition
AI-powered language translation
Room-based communication
Mute/unmute functionality
Real-time communication using Socket.IO
Extensible architecture for multilingual support

**Tech Stack:**
JavaScript Node.js Express.js Socket.IO WebRTC Hugging Face Web Speech API HTML CSS 

**How to Use**
Open the Converso web application.
Enter a Room ID to create or join a conversation room.
Select your preferred language.
Allow microphone access when prompted.
Start speaking — Converso captures your speech, translates it, and communicates it to the other participant in real time.
Share the same Room ID with another participant so they can join the conversation.
Use the Mute/Unmute option to control your microphone during the conversation.

**How to run the code**
git clone https://github.com/ANKUR1512-DEBUG/Converso.git
cd Converso
npm install
set HF_TOKEN=your_hugging_face_token
node server.js
http://localhost:3000
