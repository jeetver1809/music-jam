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

            // Force executable permissions on Linux/Mac every time, just in case
            if (process.platform !== 'win32') {
                try {
                    fs.chmodSync(this.ytDlpPath, '755');
                } catch (e) { /* ignore */ }
            }

            console.log(`🎧 Fetching audio link for: ${videoId}`);

            const ytDlpWrap = new YTDlpWrap.default(this.ytDlpPath);
            const url = `https://www.youtube.com/watch?v=${videoId}`;

            const clients = ['android', 'ios', 'web'];
            const cookiesPath = path.join(process.cwd(), 'cookies.txt');
            const hasCookies = fs.existsSync(cookiesPath);

            if (hasCookies) {
                console.log('🍪 Using cookies.txt for authentication');
            }

            for (const client of clients) {
                try {
                    console.log(`🎧 Attempting extraction with client: ${client}`);
                    const args = [
                        url,
                        '-f', 'bestaudio/best',
                        '-g',
                        '--no-warnings',
                        '--no-playlist',
                        '--force-ipv4',
                        '--extractor-args', `youtube:player_client=${client}`,
                        '--referer', 'https://www.youtube.com/'
                    ];

                    if (client === 'ios') {
                        args.push('--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1');
                    } else if (client === 'android') {
                        args.push('--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36');
                    } else {
                        args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
                    }

                    if (hasCookies) {
                        args.push('--cookies', cookiesPath);
                    }

                    const output = await ytDlpWrap.execPromise(args);
                    if (output && output.trim()) {
                        console.log(`✅ Extraction successful with ${client}`);
                        return output.trim();
                    }
                } catch (err) {
                    const errorMsg = err.message.split('\n')[0];
                    console.warn(`⚠️ Extraction failed with ${client}:`, errorMsg);

                    // Fail fast on specific errors
                    if (errorMsg.includes('Video unavailable') || errorMsg.includes('Private video')) {
                        console.error(`❌ Fatal Error: Video ${videoId} is unavailable or private.`);
                        return null; // Don't retry other clients
                    }
                }
            }

            console.error(`❌ All extraction attempts failed for ${videoId}.`);
            return null;
        } catch (err) {
            console.error("❌ Link Fetch Error (Fatal):", err);
            return null;
        }
    }
}

export const youtubeService = new YouTubeService();

export async function getAudioLink(videoId) {
    return await youtubeService.getAudioUrl(videoId);
}
