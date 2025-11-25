const { io } = require("socket.io-client");

const socket = io("http://localhost:3001");
const ROOM_CODE = "TEST_ROOM";

console.log("🔌 Connecting to server...");

socket.on("connect", () => {
    console.log("✅ Connected with ID:", socket.id);

    // Join Room
    socket.emit("join_room", { roomCode: ROOM_CODE, username: "TestUser" });
});

socket.on("update_users", (users) => {
    console.log("👥 Users updated:", users.length);
});

socket.on("sync_state", (state) => {
    console.log("🔄 Sync State Received:", state.currentSong ? state.currentSong.title : "No Song");

    if (!state.currentSong) {
        // Search and Request
        console.log("🔎 Searching for 'lofi'...");
        socket.emit("search_query", "lofi");
    }
});

socket.on("search_results", (results) => {
    console.log(`✅ Search got ${results.length} results`);
    if (results.length > 0) {
        const first = results[0];
        console.log(`▶️ Requesting: ${first.title}`);
        socket.emit("request_song", {
            roomCode: ROOM_CODE,
            videoId: first.id,
            title: first.title,
            thumbnail: first.thumbnail
        });
    }
});

socket.on("play_song", (song) => {
    console.log(`🎶 Playing: ${song.title}`);
    setTimeout(() => {
        console.log("👋 Disconnecting...");
        socket.disconnect();
        process.exit(0);
    }, 5000);
});

socket.on("error", (err) => {
    console.error("❌ Error:", err);
});
