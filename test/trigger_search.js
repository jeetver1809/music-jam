const io = require('socket.io-client');

const socket = io('http://localhost:3001');

socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('search_query', 'test song');
});

socket.on('search_results', (results) => {
    console.log('Received results:', results.length);
    process.exit(0);
});

socket.on('disconnect', () => {
    console.log('Disconnected');
});

setTimeout(() => {
    console.log('Timeout');
    process.exit(1);
}, 5000);
