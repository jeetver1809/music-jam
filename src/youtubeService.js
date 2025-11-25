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
            } catch (err) {
                console.error('❌ Failed to download yt-dlp binary:', err);
                throw new Error('yt-dlp download failed. Binary must be included in repository.');
            }
        }

        // CRITICAL: Ensure executable permissions on Linux/Mac EVERY TIME
        if (process.platform !== 'win32') {
            try {
                fs.chmodSync(this.ytDlpPath, 0o755); // Use octal notation
                console.log('✅ Set executable permissions on yt-dlp');
            } catch (e) {
                console.error('❌ Failed to set permissions:', e.message);
            }
        }

        // Verify binary works
        try {
            const ytDlpWrap = new YTDlpWrap.default(this.ytDlpPath);
            const version = await ytDlpWrap.execPromise(['--version']);
            console.log(`✅ yt-dlp verified. Version: ${version.trim()}`);
        } catch (e) {
            console.error(`❌ yt-dlp verification failed:`, e.message);
            throw new Error(`yt-dlp binary not executable. Platform: ${process.platform}`);
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
                    // Extract actual error from stderr if available
                    let errorMsg = err.message || 'Unknown error';
                    if (err.stderr) {
                        // yt-dlp errors are in stderr, extract the ERROR: line
                        const stderrLines = err.stderr.split('\n');
                        const errorLine = stderrLines.find(line => line.includes('ERROR:'));
                        if (errorLine) {
                            errorMsg = errorLine;
                        }
                    }

                    console.warn(`⚠️ Extraction failed with ${client}: ${errorMsg}`);

                    // Fail fast on specific errors (don't retry other clients)
                    if (errorMsg.includes('Video unavailable') ||
                        errorMsg.includes('Private video') ||
                        errorMsg.includes('This video is not available') ||
                        errorMsg.includes('has been removed') ||
                        errorMsg.includes('age-restricted')) {
                        console.error(`❌ Fatal Error: Video ${videoId} cannot be played: ${errorMsg}`);
                        return null;
                    }

                    // Continue trying other clients for other errors
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
