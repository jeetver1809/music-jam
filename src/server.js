import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import socketHandler from './socket.js';
import roomManager from './roomManager.js';
import { getAudioLink } from './youtubeService.js';
import { Readable } from 'stream';

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

// Handle CORS preflight
app.options('/stream/:videoId', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
});

app.get('/stream/:videoId', async (req, res) => {
    const { videoId } = req.params;

    // Ensure CORS for all outcomes
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');

    try {
        console.log(`🎵 Streaming request for: ${videoId}`);
        const audioUrl = await getAudioLink(videoId);

        if (!audioUrl) {
            console.error(`❌ No audio URL found for ${videoId}`);
            // Return JSON to avoid ORB issues with opaque responses if possible, 
            // though audio tags might still complain. 404 is correct semantic.
            return res.status(404).json({ error: 'Audio source not found' });
        }

        console.log(`🔗 Upstream URL: ${audioUrl.substring(0, 100)}...`);

        const headers = {};
        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s connection timeout

        try {
            const response = await fetch(audioUrl, {
                headers,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            console.log(`📡 Upstream Response: ${response.status} ${response.statusText}`);

            if (!response.ok && response.status !== 206) {
                throw new Error(`Upstream fetch failed: ${response.status} ${response.statusText}`);
            }

            // Forward important headers
            res.status(response.status);

            const forwardHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
            forwardHeaders.forEach(header => {
                const value = response.headers.get(header);
                if (value) res.setHeader(header, value);
            });

            // Handle client disconnect to stop stream processing
            req.on('close', () => {
                console.log(`🔌 Client disconnected from stream: ${videoId}`);
                // The pipe will automatically stop, but good to log
            });

            // Pipe the stream
            // Use pipeline if available for better error handling, but pipe is fine here
            const stream = Readable.fromWeb(response.body);
            stream.pipe(res);

            stream.on('error', (err) => {
                console.error('❌ Stream Pipe Error:', err.message);
                if (!res.headersSent) res.end();
            });

        } catch (fetchErr) {
            clearTimeout(timeoutId);
            throw fetchErr;
        }

    } catch (err) {
        console.error('❌ Stream Error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Streaming failed' });
        }
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
