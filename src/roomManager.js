const { v4: uuidv4 } = require('uuid');

class RoomManager {
    constructor() {
        this.rooms = new Map();
        // Cleanup interval: check every minute for empty rooms to remove
        setInterval(() => this.cleanupRooms(), 60 * 1000);
    }

    log(roomCode, action, details = {}) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [ROOM:${roomCode}] [${action}]`, JSON.stringify(details));
    }

    createRoom(roomCode) {
        if (this.rooms.has(roomCode)) {
            return this.rooms.get(roomCode);
        }

        const room = {
            code: roomCode,
            users: [],
            queue: [],
            currentSong: null, // { url, title, thumbnail, duration, startedAt, pausedAt, isPlaying, queueId }
            isPlaying: false,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            emptySince: null
        };

        this.rooms.set(roomCode, room);
        this.log(roomCode, 'CREATED');
        return room;
    }

    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }

    joinRoom(roomCode, user) {
        let room = this.getRoom(roomCode);
        if (!room) {
            room = this.createRoom(roomCode);
        }

        // Check if user already exists (reconnection)
        const existingUserIndex = room.users.findIndex(u => u.id === user.id);
        if (existingUserIndex !== -1) {
            room.users[existingUserIndex] = user; // Update user info
        } else {
            room.users.push(user);
        }

        room.emptySince = null; // Room is active
        room.lastActivity = Date.now();

        this.log(roomCode, 'USER_JOINED', { userId: user.id, name: user.name, totalUsers: room.users.length });
        return room;
    }

    leaveRoom(roomCode, userId) {
        const room = this.getRoom(roomCode);
        if (!room) return null;

        const index = room.users.findIndex(u => u.id === userId);
        if (index !== -1) {
            const user = room.users[index];
            room.users.splice(index, 1);

            if (room.users.length === 0) {
                room.emptySince = Date.now();
            }

            this.log(roomCode, 'USER_LEFT', { userId, name: user.name, remainingUsers: room.users.length });
            return user;
        }
        return null;
    }

    addToQueue(roomCode, song) {
        const room = this.getRoom(roomCode);
        if (!room) return false;

        const queueItem = {
            ...song,
            queueId: uuidv4() // Unique ID for this instance in the queue
        };

        room.queue.push(queueItem);
        room.lastActivity = Date.now();

        this.log(roomCode, 'QUEUE_ADD', { title: song.title, queueId: queueItem.queueId, queueLength: room.queue.length });
        return true;
    }

    removeFromQueue(roomCode, queueId) {
        const room = this.getRoom(roomCode);
        if (!room) return null;

        // Check if it's the current song
        if (room.currentSong && room.currentSong.queueId === queueId) {
            this.log(roomCode, 'REMOVE_CURRENT_SONG', { title: room.currentSong.title, queueId });
            return this.playNext(roomCode); // Skip to next
        }

        // Check queue
        const index = room.queue.findIndex(item => item.queueId === queueId);
        if (index !== -1) {
            const removed = room.queue.splice(index, 1)[0];
            this.log(roomCode, 'QUEUE_REMOVE', { title: removed.title, queueId, queueLength: room.queue.length });
            return room.currentSong; // Return current song (unchanged)
        }

        return null; // Not found
    }

    playNext(roomCode) {
        const room = this.getRoom(roomCode);
        if (!room) return null;

        if (room.queue.length === 0) {
            room.currentSong = null;
            room.isPlaying = false;
            this.log(roomCode, 'PLAYBACK_STOPPED', { reason: 'Queue empty' });
            return null;
        }

        const nextSong = room.queue.shift();
        room.currentSong = {
            ...nextSong,
            startedAt: Date.now(),
            pausedAt: null,
            isPlaying: true
        };
        room.isPlaying = true;
        room.lastActivity = Date.now();

        this.log(roomCode, 'PLAY_NEXT', { title: nextSong.title, queueId: nextSong.queueId });
        return room.currentSong;
    }

    updatePlaybackState(roomCode, state) {
        const room = this.getRoom(roomCode);
        if (!room) return;

        if (state.isPlaying !== undefined) {
            room.isPlaying = state.isPlaying;
            this.log(roomCode, state.isPlaying ? 'RESUME' : 'PAUSE');
        }

        if (room.currentSong) {
            if (state.isPlaying) {
                // Resuming
                if (room.currentSong.pausedAt) {
                    const pauseDuration = Date.now() - room.currentSong.pausedAt;
                    room.currentSong.startedAt += pauseDuration;
                    room.currentSong.pausedAt = null;
                } else if (!room.currentSong.startedAt) {
                    room.currentSong.startedAt = Date.now();
                }
            } else {
                // Pausing
                room.currentSong.pausedAt = Date.now();
            }
        }

        // Handle seek
        if (state.seekTime !== undefined && room.currentSong) {
            room.currentSong.startedAt = Date.now() - (state.seekTime * 1000);
            this.log(roomCode, 'SEEK', { position: state.seekTime });
        }

        room.lastActivity = Date.now();
    }

    getSyncState(roomCode) {
        const room = this.getRoom(roomCode);
        if (!room) return null;

        let currentTimestamp = 0;
        if (room.currentSong && room.isPlaying) {
            currentTimestamp = (Date.now() - room.currentSong.startedAt) / 1000;
        } else if (room.currentSong && room.currentSong.pausedAt) {
            currentTimestamp = (room.currentSong.pausedAt - room.currentSong.startedAt) / 1000;
        }

        return {
            roomCode: room.code,
            users: room.users,
            queue: room.queue,
            currentSong: room.currentSong,
            isPlaying: room.isPlaying,
            timestamp: Math.max(0, currentTimestamp)
        };
    }

    cleanupRooms() {
        const now = Date.now();
        const TIMEOUT = 5 * 60 * 1000; // 5 minutes

        for (const [code, room] of this.rooms.entries()) {
            if (room.users.length === 0 && room.emptySince && (now - room.emptySince > TIMEOUT)) {
                console.log(`🗑️ Room ${code} deleted due to inactivity`);
                this.rooms.delete(code);
            }
        }
    }
}

module.exports = new RoomManager();
