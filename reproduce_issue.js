import { getAudioLink } from './src/youtubeService.js';

const videoId = 'X8WEMtDqyZg'; // The failing ID

console.log(`Testing extraction for ${videoId}...`);

getAudioLink(videoId).then(url => {
    if (url) {
        console.log('✅ Success! URL:', url);
    } else {
        console.error('❌ Failed to get URL');
    }
}).catch(err => {
    console.error('❌ Error:', err);
});
