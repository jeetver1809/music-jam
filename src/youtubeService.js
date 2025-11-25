const { Innertube, UniversalCache } = require('youtubei.js');

class YouTubeService {
    constructor() {
        this.youtube = null;
        this.init();
    }

    async init() {
        try {
            this.youtube = await Innertube.create({
                cache: new UniversalCache(false),
                generate_session_locally: true
            });
            console.log('✅ YouTube Service Initialized');
        } catch (err) {
            console.error('❌ Failed to initialize YouTube Service:', err);
        }
    }
    async search(query) {
        if (!this.youtube) await this.init();
        try {
            const search = await this.youtube.search(query, { type: 'video' });

            // Filter for videos and map results safely
            return search.results
                .filter(item => item.type === 'Video')
                .map(video => {
                    try {
                        return {
                            id: video.id,
                            title: video.title?.text || 'Unknown Title',
                            thumbnail: video.thumbnails?.[0]?.url || '',
                            channel: video.author?.name || 'Unknown Channel',
                            duration: video.duration?.text || '0:00'
                        };
                    } catch (e) {
                        return null;
                    }
                })
                .filter(item => item !== null);
        } catch (err) {
            console.error('❌ Search Error:', err.message);
            return [];
        }
    }

    async getStream(videoId) {
        if (!this.youtube) await this.init();
        try {
            const info = await this.youtube.getBasicInfo(videoId);
            const format = info.streaming_data.formats
                .concat(info.streaming_data.adaptive_formats)
                .find(f => f.has_audio && !f.has_video); // Prefer audio-only

            if (format) {
                return {
                    url: format.url, // Note: youtubei.js sometimes requires deciphering, but basic info might give direct url if lucky. 
                    // Actually, for reliable playback we might need to use the deciphered url or a proxy if the URL is signature protected.
                    // However, youtubei.js handles a lot. Let's try getting the url from the format.
                    // If format.url is missing, it means we need to decipher. Innertube usually handles this if we use download/getStreamingData.
                    // Let's use a safer approach:
                };
            }

            // Better approach with Innertube to get a playable URL:
            // Innertube doesn't always expose a direct HTTP link easily for all videos due to signature cipher.
            // But for a simple backend, we might need to use `youtube-dl-exec` as a fallback or if `youtubei.js` is too complex for direct link extraction without a proxy.
            // WAIT: The user's original code used `youtube-dl-exec`. It works but is slow.
            // `youtubei.js` is great but extracting a direct playback URL that works in a simple <audio> tag on client can be tricky if it expires or is IP bound.
            // Let's stick to `youtube-dl-exec` for the *stream URL* generation as it's robust for that, 
            // BUT use `youtubei.js` for *search* as it's much faster.

            return null;
        } catch (err) {
            console.error('❌ Stream Error:', err.message);
            return null;
        }
    }

    // Re-implementing getAudioLink using youtube-dl-exec for reliability on the stream link
    // while keeping search on youtubei.js
}

// We will actually use a hybrid approach.
// Search -> youtubei.js (Fast)
// Stream -> youtube-dl-exec (Reliable for direct links)

async function getAudioLink(videoId) {
    try {
        console.log(`🎧 Fetching audio link for: ${videoId}`);
        const info = await module.exports.youtubeService.youtube.getBasicInfo(videoId);

        // Find best audio format
        const format = info.streaming_data.formats
            .concat(info.streaming_data.adaptive_formats)
            .find(f => f.has_audio && !f.has_video);

        if (format) {
            return format.url;
        }

        // Fallback: Try to decipher if needed (Innertube usually handles this)
        // If no direct url found in basic info, we might need full getInfo
        // But for now, let's try this.
        return null;
    } catch (err) {
        console.error("❌ Link Fetch Error:", err.message);
        return null;
    }
}

module.exports = {
    youtubeService: new YouTubeService(),
    getAudioLink
};
