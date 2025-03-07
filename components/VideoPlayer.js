function VideoPlayer({ partyCode, isCreator, onVideoSelect, socket }) {
    const videoRef = React.useRef(null);
    const youtubePlayerRef = React.useRef(null);
    const fileInputRef = React.useRef(null);
    const [videoUrl, setVideoUrl] = React.useState('');
    const [videoType, setVideoType] = React.useState(''); // 'local', 'youtube', 'url'
    const [urlInput, setUrlInput] = React.useState('');
    const [showUrlInput, setShowUrlInput] = React.useState(false);
    const [isSeeking, setIsSeeking] = React.useState(false);
    const [isActive, setIsActive] = React.useState(true);
    const [lastUpdateTime, setLastUpdateTime] = React.useState(0);
    const [lastPlayerState, setLastPlayerState] = React.useState(null);
    const [syncInterval, setSyncInterval] = React.useState(null);
    const [lastSyncTime, setLastSyncTime] = React.useState(0);
    const SYNC_THRESHOLD = 1; // 1 saniyelik senkronizasyon eşiği
    const SYNC_INTERVAL = 300; // 300ms kontrol aralığı

    // YouTube Player API için event handlers
    const onYouTubePlayerReady = React.useCallback((event) => {
        console.log('YouTube player ready');
        youtubePlayerRef.current = event.target;
        
        // Mevcut interval'ı temizle
        if (syncInterval) {
            clearInterval(syncInterval);
        }
        
        // Yeni senkronizasyon interval'ı başlat
        const newInterval = setInterval(() => {
            if (!youtubePlayerRef.current) return;
            
            try {
                const player = youtubePlayerRef.current;
                const currentTime = player.getCurrentTime();
                const playerState = player.getPlayerState();
                
                // Yaratıcı için event gönderme
                if (isCreator) {
                    // Durum değişikliği kontrolü
                    if (playerState !== lastPlayerState) {
                        console.log(`Creator: State changed from ${lastPlayerState} to ${playerState}`);
                        
                        if (playerState === YT.PlayerState.PLAYING) {
                            socket.emit('videoPlay', {
                                partyCode,
                                currentTime,
                                timestamp: Date.now()
                            });
                        } else if (playerState === YT.PlayerState.PAUSED) {
                            socket.emit('videoPause', {
                                partyCode,
                                currentTime,
                                timestamp: Date.now()
                            });
                        }
                        
                        setLastPlayerState(playerState);
                    }
                    
                    // Seek kontrolü - sadece oynatılıyorsa ve son senkronizasyondan beri yeterli zaman geçtiyse
                    const timeSinceLastSync = Date.now() - lastSyncTime;
                    if (playerState === YT.PlayerState.PLAYING && 
                        Math.abs(currentTime - lastUpdateTime) > SYNC_THRESHOLD && 
                        timeSinceLastSync > 1000) {
                        
                        console.log(`Creator: Detected seek to ${currentTime}`);
                        socket.emit('videoSeek', {
                            partyCode,
                            currentTime,
                            timestamp: Date.now()
                        });
                        
                        setLastUpdateTime(currentTime);
                        setLastSyncTime(Date.now());
                    }
                }
            } catch (error) {
                console.error('Sync error:', error);
            }
        }, SYNC_INTERVAL);
        
        setSyncInterval(newInterval);
        
    }, [isCreator, socket, partyCode, lastPlayerState, lastUpdateTime, lastSyncTime, syncInterval]);

    // Cleanup effect
    React.useEffect(() => {
        return () => {
            if (syncInterval) {
                clearInterval(syncInterval);
            }
        };
    }, [syncInterval]);

    // Socket olaylarını dinle
    React.useEffect(() => {
        if (!socket) return;

        socket.on('videoPlay', (data) => {
            if (!isCreator && youtubePlayerRef.current) {
                console.log('Viewer: Received play at', data.currentTime);
                try {
                    const player = youtubePlayerRef.current;
                    const currentTime = player.getCurrentTime();
                    const currentState = player.getPlayerState();
                    
                    // Zaman farkı kontrolü
                    if (Math.abs(currentTime - data.currentTime) > SYNC_THRESHOLD) {
                        console.log(`Viewer: Syncing time from ${currentTime} to ${data.currentTime}`);
                        player.seekTo(data.currentTime, true);
                    }
                    
                    // Sadece durdurulmuşsa oynat
                    if (currentState !== YT.PlayerState.PLAYING) {
                        player.playVideo();
                    }
                    
                    setLastPlayerState(YT.PlayerState.PLAYING);
                } catch (error) {
                    console.error('Play failed:', error);
                }
            }
        });

        socket.on('videoPause', (data) => {
            if (!isCreator && youtubePlayerRef.current) {
                console.log('Viewer: Received pause at', data.currentTime);
                try {
                    const player = youtubePlayerRef.current;
                    const currentTime = player.getCurrentTime();
                    
                    // Önce videoyu durdur
                    player.pauseVideo();
                    
                    // Zaman farkı kontrolü - önemli: durdurduktan sonra yap
                    if (Math.abs(currentTime - data.currentTime) > SYNC_THRESHOLD) {
                        console.log(`Viewer: Syncing time from ${currentTime} to ${data.currentTime}`);
                        player.seekTo(data.currentTime, true);
                    }
                    
                    setLastPlayerState(YT.PlayerState.PAUSED);
                } catch (error) {
                    console.error('Pause failed:', error);
                }
            }
        });

        socket.on('videoSeek', (data) => {
            if (!isCreator && youtubePlayerRef.current) {
                console.log('Viewer: Received seek to', data.currentTime);
                try {
                    setIsSeeking(true);
                    const player = youtubePlayerRef.current;
                    const currentState = player.getPlayerState();
                    
                    // Önce zaman değiştir
                    player.seekTo(data.currentTime, true);
                    
                    // Oynatma durumunu koru
                    setTimeout(() => {
                        if (currentState === YT.PlayerState.PLAYING) {
                            player.playVideo();
                        } else {
                            player.pauseVideo();
                        }
                        setIsSeeking(false);
                    }, 200);
                    
                    setLastUpdateTime(data.currentTime);
                } catch (error) {
                    console.error('Seek failed:', error);
                    setIsSeeking(false);
                }
            }
        });

        socket.on('partyEnded', () => {
            console.log('Party ended event received');
            setIsActive(false);
            if (videoType === 'youtube' && youtubePlayerRef.current) {
                youtubePlayerRef.current.stopVideo();
            }
            window.location.reload();
        });

        return () => {
            socket.off('videoPlay');
            socket.off('videoPause');
            socket.off('videoSeek');
            socket.off('partyEnded');
        };
    }, [socket, isCreator, isSeeking, videoType]);

    // Video olaylarını yönet
    const handlePlay = React.useCallback(() => {
        if (isCreator && socket && videoRef.current) {
            const currentTime = videoRef.current.currentTime;
            console.log('Video play event emitted', currentTime);
            socket.emit('videoPlay', {
                partyCode,
                currentTime: currentTime
            });
        }
    }, [isCreator, socket, partyCode]);

    const handlePause = React.useCallback(() => {
        if (isCreator && socket && videoRef.current) {
            const currentTime = videoRef.current.currentTime;
            console.log('Video pause event emitted', currentTime);
            socket.emit('videoPause', {
                partyCode,
                currentTime: currentTime
            });
        }
    }, [isCreator, socket, partyCode]);

    const handleTimeUpdate = React.useCallback(() => {
        if (isCreator && socket && videoRef.current && !isSeeking) {
            const currentTime = videoRef.current.currentTime;
            const timeSinceLastUpdate = Date.now() - lastUpdateTime;
            
            if (timeSinceLastUpdate > 1000) {
                console.log('Video time update event emitted', currentTime);
                socket.emit('videoSeek', {
                    partyCode,
                    currentTime: currentTime
                });
                setLastUpdateTime(Date.now());
            }
        }
    }, [isCreator, socket, partyCode, isSeeking, lastUpdateTime]);

    const handleSeeking = React.useCallback(() => {
        if (isCreator && socket && videoRef.current && !isSeeking) {
            const currentTime = videoRef.current.currentTime;
            console.log('Video seek event emitted', currentTime);
            setIsSeeking(true);
            socket.emit('videoSeek', {
                partyCode,
                currentTime: currentTime
            });
            setTimeout(() => setIsSeeking(false), 500);
        }
    }, [isCreator, socket, partyCode, isSeeking]);

    const handleSeeked = React.useCallback(() => {
        setIsSeeking(false);
    }, []);

    React.useEffect(() => {
        // Parti bilgilerini periyodik olarak kontrol et
        const checkPartyUpdates = async () => {
            try {
                if (!partyCode) return;
                
                const party = await joinParty(partyCode);
                if (!party.objectData.isActive) {
                    console.log('Party is not active anymore');
                    setIsActive(false);
                    if (videoType === 'youtube' && youtubePlayerRef.current) {
                        youtubePlayerRef.current.stopVideo();
                    } else if (videoRef.current) {
                        videoRef.current.pause();
                    }
                    window.location.reload(); // Sayfayı yenile
                    return;
                }

                if (party.objectData.videoUrl && party.objectData.videoUrl !== videoUrl) {
                    setVideoUrl(party.objectData.videoUrl);
                    setVideoType(party.objectData.videoType);
                }
            } catch (error) {
                if (error.message === 'This party has ended') {
                    setIsActive(false);
                    if (videoType === 'youtube' && youtubePlayerRef.current) {
                        youtubePlayerRef.current.stopVideo();
                    } else if (videoRef.current) {
                        videoRef.current.pause();
                    }
                    window.location.reload(); // Sayfayı yenile
                } else {
                    reportError(error);
                }
            }
        };

        // İlk yükleme
        checkPartyUpdates();
        
        // 5 saniyede bir kontrol et
        const interval = setInterval(checkPartyUpdates, 5000);
        
        return () => clearInterval(interval);
    }, [partyCode, videoUrl]);

    const handleFileSelect = async (e) => {
        try {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                setVideoUrl(url);
                setVideoType('local');
                await updatePartyVideo(partyCode, url, 'local');
                onVideoSelect(url);
                
                // Kullanıcıya uyarı göster
                alert('Not: Yerel dosya yüklediğiniz için, bu video sadece sizin tarayıcınızda görünecektir. Diğer katılımcılar göremeyecektir. Herkesin görebilmesi için bir video URL\'si kullanmanız önerilir.');
            }
        } catch (error) {
            reportError(error);
            alert('Video yüklenirken hata oluştu: ' + error.message);
        }
    };

    const handleUrlSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!urlInput.trim()) return;

            let finalUrl = urlInput.trim();
            let type = 'url';

            // Check if it's a YouTube URL
            if (finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be')) {
                type = 'youtube';
                // Extract video ID
                const videoId = extractYoutubeId(finalUrl);
                if (!videoId) {
                    throw new Error('Geçersiz YouTube URL\'si');
                }
                finalUrl = videoId; // Sadece video ID'sini sakla
            }

            setVideoUrl(finalUrl);
            setVideoType(type);
            await updatePartyVideo(partyCode, finalUrl, type);
            onVideoSelect(finalUrl);
            setShowUrlInput(false);
            setUrlInput('');
        } catch (error) {
            reportError(error);
            alert('Video yüklenirken hata oluştu: ' + error.message);
        }
    };

    const extractYoutubeId = (url) => {
        try {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
        } catch (error) {
            reportError(error);
            return null;
        }
    };

    const renderVideoContent = () => {
        if (!videoUrl) return null;

        if (!isActive) {
            return (
                <div className="flex items-center justify-center h-full min-h-[300px] bg-gray-800 text-white">
                    <p>Bu parti sona erdi.</p>
                </div>
            );
        }

        if (videoType === 'youtube') {
            return (
                <div id="youtube-player" className="w-full aspect-video">
                    <YTPlayer
                        videoId={videoUrl}
                        onReady={onYouTubePlayerReady}
                        className="w-full h-full"
                    />
                </div>
            );
        }

        return (
            <div>
                <video
                    ref={videoRef}
                    className="w-full h-full"
                    controls
                    crossOrigin="anonymous"
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onSeeking={handleSeeking}
                    onSeeked={handleSeeked}
                    onTimeUpdate={handleTimeUpdate}
                >
                    <source src={videoUrl} type="video/mp4" />
                    Tarayıcınız video etiketini desteklemiyor.
                </video>
                {videoType === 'local' && (
                    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mt-2">
                        <p className="font-bold">Not:</p>
                        <p>Bu yerel video sadece sizin tarayıcınızda görünecektir. Diğer katılımcılar göremeyecektir.</p>
                        <p>Herkesin görebilmesi için bir video URL'si kullanmanız önerilir.</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div data-name="video-player" className="video-container w-full">
            {isCreator && !videoUrl && (
                <div className="flex items-center justify-center h-full min-h-[300px] bg-gray-800">
                    <div className="text-center p-8 space-y-4">
                        <h3 className="text-xl text-white mb-4">Video Seçin</h3>
                        
                        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4 text-left">
                            <p className="font-bold">Önerilen: Video URL'si Kullanın</p>
                            <p>Herkesin görebilmesi için bir video URL'si kullanmanız önerilir. YouTube veya doğrudan video bağlantısı kullanabilirsiniz.</p>
                        </div>
                        
                        <div className="flex space-x-4 justify-center">
                            <button
                                data-name="enter-url-button"
                                onClick={() => setShowUrlInput(true)}
                                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                            >
                                <i className="fas fa-link mr-2"></i>
                                Video URL'si Girin (Önerilen)
                            </button>
                            <button
                                data-name="select-file-button"
                                onClick={() => fileInputRef.current.click()}
                                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
                            >
                                <i className="fas fa-file-video mr-2"></i>
                                Yerel Dosya Seçin
                            </button>
                        </div>
                        {showUrlInput && (
                            <form onSubmit={handleUrlSubmit} className="mt-4">
                                <input
                                    type="text"
                                    placeholder="Video URL'si girin (YouTube desteklenir)"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    className="w-full px-4 py-2 rounded text-black mb-2"
                                />
                                <button
                                    type="submit"
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
                                >
                                    Videoyu Yükle
                                </button>
                            </form>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="video/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                    </div>
                </div>
            )}
            {videoUrl && renderVideoContent()}
            {!isCreator && !videoUrl && (
                <div className="flex items-center justify-center h-full min-h-[300px] bg-gray-800 text-white">
                    <p>Parti oluşturucunun video seçmesi bekleniyor...</p>
                </div>
            )}
        </div>
    );
}

// YouTube Player bileşeni
function YTPlayer({ videoId, onReady, className }) {
    const playerRef = React.useRef(null);

    React.useEffect(() => {
        // YouTube Player'ı oluştur
        if (!playerRef.current && window.YT) {
            playerRef.current = new window.YT.Player('youtube-player', {
                videoId: videoId,
                playerVars: {
                    controls: 1,
                    rel: 0,
                    modestbranding: 1
                },
                events: {
                    onReady: onReady
                }
            });
        }
    }, [videoId, onReady]);

    return (
        <div id="youtube-player" className={className}></div>
    );
}
