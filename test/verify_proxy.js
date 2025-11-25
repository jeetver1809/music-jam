const http = require('http');
const { spawn } = require('child_process');

console.log('🚀 Starting Server for Verification...');
const serverProcess = spawn('node', ['src/server.js'], { cwd: 'c:/Users/jeetv/Downloads/music' });

serverProcess.stdout.on('data', (data) => {
    console.log(`[Server]: ${data}`);
    if (data.toString().includes('Music Jam Server Started')) {
        console.log('✅ Server Started. Testing Proxy...');
        testProxy();
    }
});

serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error]: ${data}`);
});

function testProxy() {
    // Known safe video ID (e.g., a copyright-free song or short clip)
    // Using a generic ID, hope it works or use a real one if known.
    // Let's use a popular NCS song ID: 'K4DyBUG242c' (Cartoon - On & On)
    const videoId = 'K4DyBUG242c';

    const options = {
        hostname: 'localhost',
        port: 3001,
        path: `/stream/${videoId}`,
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

        if (res.statusCode === 200 || res.statusCode === 206) {
            console.log('✅ Proxy Endpoint Works! Stream received.');
        } else {
            console.error('❌ Proxy Endpoint Failed.');
        }

        // Kill server
        serverProcess.kill();
        process.exit(0);
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
        serverProcess.kill();
        process.exit(1);
    });

    req.end();
}

// Timeout
setTimeout(() => {
    console.error('❌ Timeout waiting for server');
    serverProcess.kill();
    process.exit(1);
}, 20000);
