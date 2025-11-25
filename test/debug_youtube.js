import { getAudioLink } from '../src/youtubeService.js';
import YTDlpWrap from 'yt-dlp-wrap';

async function run() {
    console.log("YTDlpWrap export:", YTDlpWrap);
    try {
        console.log("Fetching...");
        const url = await getAudioLink('i_SsnRdgitA');
        console.log(url ? "SUCCESS" : "FAILED (No URL)");
    } catch (err) {
        console.log("ERROR_MSG: " + err.message);
    }
}

run();
