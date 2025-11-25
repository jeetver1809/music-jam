import { Innertube, UniversalCache } from 'youtubei.js';
import YTDlpWrap from 'yt-dlp-wrap';
import fs from 'fs';
import path from 'path';

class YouTubeService {
    constructor() {
        this.youtube = null;
        this.init();
        this.ytDlpPath = path.join(process.cwd(), process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
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

    async ensureBinary() {
        if (!fs.existsSync(this.ytDlpPath)) {
            console.log('⬇️ Downloading yt-dlp binary...');
            try {
                await YTDlpWrap.default.downloadFromGithub(this.ytDlpPath);
                console.log('✅ yt-dlp binary downloaded');

                // Ensure executable permissions on Linux/Mac
                if (process.platform !== 'win32') {
                    fs.chmodSync(this.ytDlpPath, '755');
                }
            } catch (err) {
                console.error('❌ Failed to download yt-dlp binary:', err);
                throw err;
            }
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

    async getAudioUrl(videoId) {
        try {
            await this.ensureBinary();
            console.log(`🎧 Fetching audio link for: ${videoId}`);

            const ytDlpWrap = new YTDlpWrap.default(this.ytDlpPath);
            const url = `https://www.youtube.com/watch?v=${videoId}`;

            // Get direct URL
            const output = await ytDlpWrap.execPromise([
                url,
                '-f', 'bestaudio',
                '-g'
            ]);

            return output.trim();
        } catch (err) {
            console.error("❌ Link Fetch Error:", err.message);
            return null;
        }
    }
}

export const youtubeService = new YouTubeService();

export async function getAudioLink(videoId) {
    return await youtubeService.getAudioUrl(videoId);
}
