import { getAudioLink } from '../src/youtubeService.js';

async function test() {
    try {
        console.log("Fetching with cookies...");
        const url = await getAudioLink('97NWNz9kgxU'); // The video ID from user logs
        console.log(url ? "SUCCESS" : "FAILED (No URL)");
        if (url) console.log("URL:", url.substring(0, 50) + "...");
    } catch (err) {
        const fs = await import('fs');
        fs.writeFileSync('test/debug_error.log', "ERROR_MSG: " + err.message);
        console.log("Error logged to test/debug_error.log");
    }
}

test();
