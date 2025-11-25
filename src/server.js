const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const socketHandler = require('./socket');
const roomManager = require('./roomManager');
const { getAudioLink } = require('./youtubeService');
const { Readable } = require('stream');

// Global error handlers to prevent crashes from third-party libraries
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
    console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Initialize Socket Logic
socketHandler(io);

// REST API
app.get('/', (req, res) => {
    res.send('Music Jam Server is Online! 🚀');
});

app.post('/api/rooms', (req, res) => {
    const { roomCode } = req.body;
    if (!roomCode) return res.status(400).json({ error: 'Room code required' });

    const room = roomManager.createRoom(roomCode);
    res.json({ success: true, roomCode: room.code });
});

app.get('/api/rooms/:code', (req, res) => {
    const room = roomManager.getRoom(req.params.code);
    if (room) {
        res.json({ exists: true, users: room.users.length, isPlaying: room.isPlaying });
    } else {
        res.status(404).json({ exists: false });
    }
});

app.get('/stream/:videoId', async (req, res) => {
    const { videoId } = req.params;
    try {
        console.log(`🎵 Streaming request for: ${videoId}`);
        const audioUrl = await getAudioLink(videoId);

        if (!audioUrl) {
            return res.status(404).send('Audio source not found');
        }

        const response = await fetch(audioUrl);
        if (!response.ok) {
            throw new Error(`Upstream fetch failed: ${response.status} ${response.statusText}`);
        }

        // Forward content type
        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);

        // Pipe the stream
        Readable.fromWeb(response.body).pipe(res);

    } catch (err) {
        console.error('❌ Stream Error:', err.message);
        if (!res.headersSent) res.status(500).send('Streaming failed');
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║   🎵 Music Jam Server Started! 🎵     ║
║   Port: ${PORT}                          ║
║   Status: Ready for connections        ║
╚════════════════════════════════════════╝
  `);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
});
