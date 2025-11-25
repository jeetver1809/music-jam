// ============================================
// FRONTEND AUTOPLAY FIX FOR EXPO AV WEB
// ============================================

/**
 * Problem: Browser blocks autoplay when socket event triggers loadSound()
 * Solution: Track user interaction state and require explicit play button click
 */

// Add these state variables to your component:
const [awaitingUserPlay, setAwaitingUserPlay] = useState(false);
const [pendingSong, setPendingSong] = useState(null);

// Modified loadSound function:
const loadSound = async (song, sync = false, startTime = 0) => {
    if (!song?.audioUrl) return;

    const uri = `${currentServer}${song.audioUrl}`;
    setCurrentSong(song);
    currentSongIdRef.current = song.id;
    setIsLoading(true);

    if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch (e) { }
    }

    try {
        const { sound, status } = await Audio.Sound.createAsync(
            { uri: uri },
            {
                shouldPlay: false, // Don't autoplay initially
                positionMillis: startTime * 1000
            }
        );
        soundRef.current = sound;
        setupPlaybackListeners(sound, activeSocket);

        if (status.durationMillis) setDuration(status.durationMillis / 1000);

        // On web, check if this is from socket event (auto-triggered)
        if (Platform.OS === 'web' && !sync) {
            // This is an automatic song change, require user interaction
            setAwaitingUserPlay(true);
            setPendingSong({ sound, startTime });
            setStatus('Ready - Click Play');
            console.log('🎵 Song loaded, waiting for user to click Play');
        } else {
            // User explicitly clicked play, or we're syncing (mobile is fine)
            await sound.playAsync();
            setStatus('Playing');
            setAwaitingUserPlay(false);
        }

        setIsLoading(false);
    } catch (error) {
        console.log("Load error:", error);
        if (activeSocket) {
            activeSocket.emit('song_load_error', {
                roomCode,
                songId: currentSongIdRef.current
            });
        }
        setStatus('Error');
        setIsLoading(false);
    }
};

// Modified handleTogglePlayPause:
const handleTogglePlayPause = async () => {
    if (!soundRef.current && !currentSong) return;

    try {
        // If we're waiting for user interaction, play the pending song
        if (awaitingUserPlay && pendingSong) {
            await pendingSong.sound.playAsync();
            setAwaitingUserPlay(false);
            setPendingSong(null);
            setStatus('Playing');

            // Notify server that we're playing
            if (activeSocket) {
                activeSocket.emit('play_track', { roomCode });
            }
            return;
        }

        // Normal play/pause toggle
        const status = await soundRef.current?.getStatusAsync();
        if (status?.isLoaded) {
            if (isPlaying) {
                await soundRef.current.pauseAsync();
                if (activeSocket) {
                    activeSocket.emit('pause_track', { roomCode });
                }
            } else {
                await soundRef.current.playAsync();
                if (activeSocket) {
                    activeSocket.emit('play_track', { roomCode });
                }
            }
        }
    } catch (error) {
        console.error('Play/Pause error:', error);
    }
};

// Update socket listener for 'play_song':
useEffect(() => {
    if (!activeSocket) return;

    const handlePlaySong = (song) => {
        console.log('🎵 Server says play:', song.title);
        // Load the song but don't autoplay on web
        loadSound(song, false, 0);
    };

    activeSocket.on('play_song', handlePlaySong);

    return () => {
        activeSocket.off('play_song', handlePlaySong);
    };
}, [activeSocket, currentServer]);

// Update your UI to show when awaiting user interaction:
{
    awaitingUserPlay && (
        <View style={styles.autoplayBlockedBanner}>
            <Text style={styles.bannerText}>
                🎵 Click Play to start the song
            </Text>
        </View>
    )
}

// Banner styles:
const styles = StyleSheet.create({
    // ... your existing styles
    autoplayBlockedBanner: {
        backgroundColor: '#FFA500',
        padding: 12,
        borderRadius: 8,
        marginVertical: 8,
        alignItems: 'center',
    },
    bannerText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 14,
    },
});
