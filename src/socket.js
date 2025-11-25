const roomManager = require('./roomManager');
const { youtubeService } = require('./youtubeService');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log(`⚡ User Connected: ${socket.id}`);

        // ========== JOIN ROOM ==========
        socket.on('join_room', ({ roomCode, username }) => {
            if (!roomCode) {
                socket.emit('error', 'Room code is required');
                return;
            }

            socket.join(roomCode);

            const user = {
                id: socket.id,
                name: username || `User ${socket.id.substring(0, 4)}`
            };

            const room = roomManager.joinRoom(roomCode, user);

            io.to(roomCode).emit('update_users', room.users);

            // Send current state to the new user
            const syncState = roomManager.getSyncState(roomCode);
            socket.emit('sync_state', syncState);

            console.log(`👤 ${user.name} joined ${roomCode}`);
        });

        // ========== SEARCH ==========
        socket.on('search_query', async (query) => {
            try {
                const results = await youtubeService.search(query);
                if (!results || results.length === 0) {
                    socket.emit('search_results', []);
                    socket.emit('song_error', 'No results found');
                } else {
                    socket.emit('search_results', results);
                }
            } catch (error) {
                console.error('❌ Search error:', error);
                socket.emit('song_error', 'Search failed. Try again.');
                socket.emit('search_results', []);
            }
        });

        // ========== REQUEST SONG ==========
        socket.on('request_song', async ({ roomCode, videoId, title, thumbnail }) => {
            const room = roomManager.getRoom(roomCode);
            if (!room) return;

            // If we only have a URL, try to extract ID (basic support)
            // But ideally frontend sends videoId from search results
            let id = videoId;
            if (!id && title && title.includes('youtube.com')) {
                // extract id logic if needed, but let's assume videoId is passed
            }

            // Use relative URL for proxy streaming
            const streamUrl = `/stream/${id}`;

            const song = {
                id,
                title,
                thumbnail,
                audioUrl: streamUrl,
                addedBy: socket.id
            };

            roomManager.addToQueue(roomCode, song);
            io.to(roomCode).emit('queue_updated', room.queue);

            // Auto-play if stopped
            if (!room.isPlaying && !room.currentSong) {
                const nextSong = roomManager.playNext(roomCode);
                if (nextSong) {
                    io.to(roomCode).emit('play_song', nextSong);
                }
            }
        });

        // ========== CONTROLS ==========
        socket.on('play_track', ({ roomCode }) => {
            roomManager.updatePlaybackState(roomCode, { isPlaying: true });
            io.to(roomCode).emit('receive_play'); // Broadcast to everyone including sender
        });

        socket.on('pause_track', ({ roomCode }) => {
            roomManager.updatePlaybackState(roomCode, { isPlaying: false });
            io.to(roomCode).emit('receive_pause'); // Broadcast to everyone including sender
        });

        socket.on('seek_track', ({ roomCode, timestamp }) => {
            roomManager.updatePlaybackState(roomCode, { seekTime: timestamp });
            io.to(roomCode).emit('receive_seek', timestamp); // Broadcast to everyone including sender
        });

        socket.on('skip_track', ({ roomCode }) => {
            const nextSong = roomManager.playNext(roomCode);
            if (nextSong) {
                io.to(roomCode).emit('play_song', nextSong);
                io.to(roomCode).emit('queue_updated', roomManager.getRoom(roomCode).queue);
            } else {
                io.to(roomCode).emit('stop_player');
            }
        });

        socket.on('song_ended', ({ roomCode, songId }) => {
            const room = roomManager.getRoom(roomCode);
            if (!room || !room.currentSong) return;

            // Race condition check: Ensure the song that ended is still the current one
            if (room.currentSong.id === songId) {
                const nextSong = roomManager.playNext(roomCode);
                if (nextSong) {
                    io.to(roomCode).emit('play_song', nextSong);
                    io.to(roomCode).emit('queue_updated', room.queue);
                } else {
                    io.to(roomCode).emit('stop_player');
                    roomManager.updatePlaybackState(roomCode, { isPlaying: false });
                }
            }
        });

        socket.on('song_load_error', ({ roomCode, songId }) => {
            const room = roomManager.getRoom(roomCode);
            if (!room || !room.currentSong) return;

            // Prevent spam: Only skip if the error is for the current song
            if (room.currentSong.id === songId) {
                console.log(`⚠️ Song load error in ${roomCode}, skipping...`);
                const nextSong = roomManager.playNext(roomCode);
                if (nextSong) {
                    io.to(roomCode).emit('play_song', nextSong);
                    io.to(roomCode).emit('queue_updated', room.queue);
                } else {
                    io.to(roomCode).emit('stop_player');
                    roomManager.updatePlaybackState(roomCode, { isPlaying: false });
                }
            }
        });

        socket.on('remove_from_queue', ({ roomCode, queueId }) => {
            const room = roomManager.getRoom(roomCode);
            if (!room) return;

            const currentSong = roomManager.removeFromQueue(roomCode, queueId);

            // If the current song changed (because we removed the playing song), broadcast it
            if (currentSong && currentSong.queueId !== (room.currentSong ? room.currentSong.queueId : null)) {
                io.to(roomCode).emit('play_song', currentSong);
            } else if (!currentSong && !room.isPlaying) {
                // Queue became empty and stopped
                io.to(roomCode).emit('stop_player');
            }

            io.to(roomCode).emit('queue_updated', room.queue);
        });

        // ========== DISCONNECT ==========
        socket.on('disconnect', () => {
            // We need to find which room the user was in. 
            // Since socket.io rooms are cleared on disconnect, we iterate our manager.
            // Optimization: We could map socketId -> roomCode in memory if needed.
            for (const [code, room] of roomManager.rooms.entries()) {
                const user = roomManager.leaveRoom(code, socket.id);
                if (user) {
                    console.log(`👋 ${user.name} left ${code}`);
                    io.to(code).emit('update_users', room.users);
                    break;
                }
            }
        });
    });
};
