const roomManager = require('./roomManager');

describe('RoomManager', () => {
    const roomCode = 'TEST_ROOM';
    const user = { id: 'user1', name: 'Test User' };
    const song1 = { id: 'song1', title: 'Song 1' };
    const song2 = { id: 'song2', title: 'Song 2' };

    beforeAll(() => {
        jest.useFakeTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        // Reset state
        roomManager.rooms.clear();
    });

    test('should create and join a room', () => {
        const room = roomManager.joinRoom(roomCode, user);
        expect(room.code).toBe(roomCode);
        expect(room.users).toHaveLength(1);
        expect(room.users[0].id).toBe(user.id);
    });

    test('should add songs to queue with unique IDs', () => {
        roomManager.joinRoom(roomCode, user);
        roomManager.addToQueue(roomCode, song1);
        roomManager.addToQueue(roomCode, song1); // Add same song twice

        const room = roomManager.getRoom(roomCode);
        expect(room.queue).toHaveLength(2);
        expect(room.queue[0].queueId).toBeDefined();
        expect(room.queue[1].queueId).toBeDefined();
        expect(room.queue[0].queueId).not.toBe(room.queue[1].queueId);
    });

    test('should play next song from queue', () => {
        roomManager.joinRoom(roomCode, user);
        roomManager.addToQueue(roomCode, song1);

        const currentSong = roomManager.playNext(roomCode);
        const room = roomManager.getRoom(roomCode);

        expect(currentSong.id).toBe(song1.id);
        expect(room.isPlaying).toBe(true);
        expect(room.queue).toHaveLength(0);
    });

    test('should remove song from queue', () => {
        roomManager.joinRoom(roomCode, user);
        roomManager.addToQueue(roomCode, song1);
        roomManager.addToQueue(roomCode, song2);

        const room = roomManager.getRoom(roomCode);
        const targetQueueId = room.queue[0].queueId; // Remove first song

        roomManager.removeFromQueue(roomCode, targetQueueId);

        expect(room.queue).toHaveLength(1);
        expect(room.queue[0].id).toBe(song2.id);
    });

    test('should skip if removing currently playing song', () => {
        roomManager.joinRoom(roomCode, user);
        roomManager.addToQueue(roomCode, song1);
        roomManager.addToQueue(roomCode, song2);

        // Play first song
        const currentSong = roomManager.playNext(roomCode);

        // Remove currently playing song
        const nextSong = roomManager.removeFromQueue(roomCode, currentSong.queueId);

        expect(nextSong.id).toBe(song2.id);
        expect(roomManager.getRoom(roomCode).queue).toHaveLength(0);
    });
});
