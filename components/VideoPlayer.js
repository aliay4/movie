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
    const [ignoreStateChanges, setIgnoreStateChanges] = React.useState(false);
    const SYNC_THRESHOLD = 1; // 1 saniyelik senkronizasyon eşiği
    const SYNC_INTERVAL = 1000; // 1000ms kontrol aralığı
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [totalDuration, setTotalDuration] = React.useState(0);

    // YouTube Player API için event handlers
    const onYouTubePlayerReady = React.useCallback((event) => {
        console.log('YouTube player ready');
        youtubePlayerRef.current = event.target;
        
        // Mevcut interval'ı temizle
        if (syncInterval) {
            clearInterval(syncInterval);
        }
        
        // Yaratıcı için olay dinleyicileri ekle
        if (isCreator) {
            console.log('Setting up creator event listeners');
            
            // Doğrudan YouTube API'nin onStateChange olayını kullanıyoruz
            event.target.addEventListener('onStateChange', function(e) {
                if (ignoreStateChanges) return;
                
                const playerState = e.data;
                console.log(`Creator: State changed to ${playerState}`);
                
                if (playerState === YT.PlayerState.PLAYING) {
                    const currentTime = youtubePlayerRef.current.getCurrentTime();
                    console.log(`Creator: Video playing at ${currentTime}`);
                    socket.emit('videoPlay', {
                        partyCode,
                        currentTime,
                        timestamp: Date.now()
                    });
                } else if (playerState === YT.PlayerState.PAUSED) {
                    const currentTime = youtubePlayerRef.current.getCurrentTime();
                    console.log(`Creator: Video paused at ${currentTime}`);
                    socket.emit('videoPause', {
                        partyCode,
                        currentTime,
                        timestamp: Date.now()
                    });
                }
                
                setLastPlayerState(playerState);
            });
        }
        
        // Yeni senkronizasyon interval'ı başlat - sadece seek işlemleri için
        const newInterval = setInterval(() => {
            if (!youtubePlayerRef.current) return;
            
            try {
                const player = youtubePlayerRef.current;
                const currentTime = player.getCurrentTime();
                const playerState = player.getPlayerState();
                
                // Yaratıcı için seek kontrolü
                if (isCreator && !ignoreStateChanges && playerState === YT.PlayerState.PLAYING) {
                    const timeSinceLastSync = Date.now() - lastSyncTime;
                    
                    // Sadece oynatılıyorsa ve belirli bir süre geçtiyse seek kontrolü yap
                    if (Math.abs(currentTime - lastUpdateTime) > SYNC_THRESHOLD && 
                        timeSinceLastSync > 3000) {
                        
                        console.log(`Creator: Detected seek to ${currentTime}`);
                        socket.emit('videoSeek', {
                            partyCode,
                            currentTime,
                            timestamp: Date.now(),
                            isPlaying: playerState === YT.PlayerState.PLAYING
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
        
    }, [isCreator, socket, partyCode, lastUpdateTime, lastSyncTime, syncInterval, ignoreStateChanges]);

    // Cleanup effect
    React.useEffect(() => {
        return () => {
            if (syncInterval) {
                clearInterval(syncInterval);
            }
        };
    }, [syncInterval]);

    // Film sitesi için zaman güncellemesi
    React.useEffect(() => {
        if (videoType !== 'moviesite') return;
        
        // Varsayılan toplam süre (2 saat)
        setTotalDuration(7200);
        
        // Zaman güncellemesi için interval
        const timeUpdateInterval = setInterval(() => {
            if (isPlaying) {
                setCurrentTime(prevTime => {
                    const newTime = prevTime + 1;
                    return newTime > totalDuration ? totalDuration : newTime;
                });
            }
        }, 1000);
        
        return () => {
            clearInterval(timeUpdateInterval);
        };
    }, [videoType, isPlaying, totalDuration]);

    // Socket olaylarını dinle
    React.useEffect(() => {
        if (!socket) return;

        socket.on('videoPlay', (data) => {
            if (!isCreator) {
                if (videoType === 'youtube' && youtubePlayerRef.current) {
                    console.log('Viewer: Received play at', data.currentTime);
                    try {
                        setIgnoreStateChanges(true);
                        const player = youtubePlayerRef.current;
                        
                        // Önce zaman senkronize et, sonra oynat
                        player.seekTo(data.currentTime, true);
                        
                        // Kısa bir gecikme ile oynat
                        setTimeout(() => {
                            player.playVideo();
                            
                            // Durum değişikliklerini tekrar dinle
                            setTimeout(() => {
                                setIgnoreStateChanges(false);
                            }, 1000);
                        }, 200);
                        
                    } catch (error) {
                        console.error('Play failed:', error);
                        setIgnoreStateChanges(false);
                    }
                } else if (videoType === 'moviesite') {
                    // Film sitesi için senkronizasyon
                    console.log('Viewer: Received play at', data.currentTime);
                    setCurrentTime(data.currentTime);
                    setIsPlaying(true);
                }
            }
        });

        socket.on('videoPause', (data) => {
            if (!isCreator) {
                if (videoType === 'youtube' && youtubePlayerRef.current) {
                    console.log('Viewer: Received pause at', data.currentTime);
                    try {
                        setIgnoreStateChanges(true);
                        const player = youtubePlayerRef.current;
                        
                        // Önce videoyu durdur
                        player.pauseVideo();
                        
                        // Kısa bir gecikme ile zaman senkronize et
                        setTimeout(() => {
                            player.seekTo(data.currentTime, true);
                            
                            // Durum değişikliklerini tekrar dinle
                            setTimeout(() => {
                                setIgnoreStateChanges(false);
                            }, 500);
                        }, 200);
                        
                    } catch (error) {
                        console.error('Pause failed:', error);
                        setIgnoreStateChanges(false);
                    }
                } else if (videoType === 'moviesite') {
                    // Film sitesi için senkronizasyon
                    console.log('Viewer: Received pause at', data.currentTime);
                    setCurrentTime(data.currentTime);
                    setIsPlaying(false);
                }
            }
        });

        socket.on('videoSeek', (data) => {
            if (!isCreator) {
                if (videoType === 'youtube' && youtubePlayerRef.current) {
                    console.log('Viewer: Received seek to', data.currentTime, 'isPlaying:', data.isPlaying);
                    try {
                        setIsSeeking(true);
                        setIgnoreStateChanges(true);
                        const player = youtubePlayerRef.current;
                        
                        // Önce videoyu durdur
                        player.pauseVideo();
                        
                        // Sonra zaman değiştir
                        setTimeout(() => {
                            player.seekTo(data.currentTime, true);
                            
                            // Oynatma durumunu koru
                            setTimeout(() => {
                                if (data.isPlaying) {
                                    player.playVideo();
                                }
                                
                                setIsSeeking(false);
                                setLastUpdateTime(data.currentTime);
                                
                                // Durum değişikliklerini tekrar dinle
                                setTimeout(() => {
                                    setIgnoreStateChanges(false);
                                }, 500);
                            }, 200);
                        }, 100);
                        
                    } catch (error) {
                        console.error('Seek failed:', error);
                        setIsSeeking(false);
                        setIgnoreStateChanges(false);
                    }
                } else if (videoType === 'moviesite') {
                    // Film sitesi için senkronizasyon
                    console.log('Viewer: Received seek to', data.currentTime, 'isPlaying:', data.isPlaying);
                    setCurrentTime(data.currentTime);
                    setIsPlaying(data.isPlaying);
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

        // Manuel senkronizasyon olayını dinle
        socket.on('manualSync', (data) => {
            console.log('Manual sync received:', data);
            // Sohbete mesaj ekle
            if (data.message) {
                alert(`Senkronizasyon: ${data.message}`);
            }
        });

        return () => {
            socket.off('videoPlay');
            socket.off('videoPause');
            socket.off('videoSeek');
            socket.off('partyEnded');
            socket.off('manualSync');
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

    // Film sitesi URL'sini kontrol et
    const isMovieSiteUrl = (url) => {
        try {
            // Desteklenen film sitelerinin domain listesi
            const movieSiteDomains = [
                'hdfilmcehennemi.', 'fullhdfilmizlesene.', 'filmizle.', 'dizibox.',
                'dizilab.', 'dizilla.', 'jetfilmizle.', 'filmmakinesi.',
                'hdfilmcehennemi2.', 'filmmodu.', 'fullhdfilmizle.',
                'netflix.', 'amazon.', 'hulu.', 'disney.', 'blutv.', 'exxen.',
                'puhu.', 'mubi.', 'filmbox.'
            ];
            
            // URL'yi kontrol et
            const urlObj = new URL(url);
            return movieSiteDomains.some(domain => urlObj.hostname.includes(domain));
        } catch (error) {
            return false;
        }
    };

    const handleUrlSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!urlInput.trim()) return;

            let finalUrl = urlInput.trim();
            let type = 'url';

            // YouTube URL kontrolü
            if (finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be')) {
                type = 'youtube';
                // Extract video ID
                const videoId = extractYoutubeId(finalUrl);
                if (!videoId) {
                    throw new Error('Geçersiz YouTube URL\'si');
                }
                finalUrl = videoId; // Sadece video ID'sini sakla
            }
            // Film sitesi URL kontrolü
            else if (isMovieSiteUrl(finalUrl)) {
                type = 'moviesite';
                
                // Film sitelerinin embed URL'lerini düzenle
                if (finalUrl.includes('hdfilmcehennemi')) {
                    // hdfilmcehennemi için embed URL'si
                    const match = finalUrl.match(/\/([^\/]+)(?:-izle)?\/?$/);
                    if (match && match[1]) {
                        const filmSlug = match[1].replace(/-izle$/, '');
                        // Farklı domain'leri dene
                        const domains = [
                            'https://www.hdfilmcehennemi.nl',
                            'https://hdfilmcehennemi.cx',
                            'https://www.hdfilmcehennemi.net',
                            'https://hdfilmcehennemi.tv'
                        ];
                        finalUrl = `${domains[0]}/player/${filmSlug}`;
                    }
                } else if (finalUrl.includes('dizibox')) {
                    // dizibox için embed URL'si
                    const match = finalUrl.match(/\/([^\/]+)\/([^\/]+)\/([^\/]+)\/?$/);
                    if (match && match[1] && match[2] && match[3]) {
                        const diziSlug = match[1];
                        const sezonSlug = match[2];
                        const bolumSlug = match[3];
                        finalUrl = `https://www.dizibox.tv/embed/${diziSlug}/${sezonSlug}/${bolumSlug}`;
                    }
                } else if (finalUrl.includes('filmizle')) {
                    // filmizle için embed URL'si
                    const match = finalUrl.match(/\/([^\/]+)(?:\/[^\/]+)?$/);
                    if (match && match[1]) {
                        const filmSlug = match[1];
                        finalUrl = `https://www.filmizle.fun/embed/${filmSlug}`;
                    }
                } else if (finalUrl.includes('fullhdfilmizlesene')) {
                    // fullhdfilmizlesene için embed URL'si
                    const match = finalUrl.match(/\/([^\/]+)-izle\/?$/);
                    if (match && match[1]) {
                        const filmSlug = match[1];
                        finalUrl = `https://www.fullhdfilmizlesene.pw/player/${filmSlug}`;
                    }
                }
                
                // Eğer URL bir embed URL'si değilse, orijinal URL'yi kullan
                if (!finalUrl.includes('/embed/') && !finalUrl.includes('/player/')) {
                    console.log('Film sitesi için embed URL\'si bulunamadı, orijinal URL kullanılıyor');
                }
                
                console.log('Film sitesi URL\'si tespit edildi:', finalUrl);
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
                <div className="w-full aspect-video">
                    <YTPlayer
                        videoId={videoUrl}
                        onReady={onYouTubePlayerReady}
                        className="w-full h-full"
                    />
                </div>
            );
        }
        
        // Film sitesi embed desteği
        if (videoType === 'moviesite') {
            return (
                <div className="w-full aspect-video relative">
                    <div className="absolute inset-0">
                        <iframe
                            src={`/proxy?url=${encodeURIComponent(videoUrl)}`}
                            className="w-full h-full"
                            frameBorder="0"
                            allowFullScreen
                            allow="autoplay; encrypted-media; picture-in-picture"
                            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
                            referrerPolicy="no-referrer"
                            style={{ zIndex: 1 }}
                        ></iframe>
                    </div>
                    
                    {/* Video Kontrolleri */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gray-800 bg-opacity-90 p-4" style={{ zIndex: 2 }}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                                {isPlaying ? (
                                    <button 
                                        onClick={() => {
                                            if (isCreator && socket) {
                                                socket.emit('videoPause', {
                                                    partyCode,
                                                    currentTime: currentTime,
                                                    timestamp: Date.now()
                                                });
                                            }
                                            setIsPlaying(false);
                                        }}
                                        className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full mr-2"
                                    >
                                        <i className="fas fa-pause"></i>
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => {
                                            if (isCreator && socket) {
                                                socket.emit('videoPlay', {
                                                    partyCode,
                                                    currentTime: currentTime,
                                                    timestamp: Date.now()
                                                });
                                            }
                                            setIsPlaying(true);
                                        }}
                                        className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full mr-2"
                                    >
                                        <i className="fas fa-play"></i>
                                    </button>
                                )}
                                <span className="text-white">{formatTime(currentTime)}</span>
                            </div>
                            
                            <div className="flex items-center">
                                <input 
                                    type="text" 
                                    placeholder="ör: 1:30:45"
                                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white mr-2 w-24"
                                    id="syncTimeInput"
                                />
                                <button 
                                    onClick={() => {
                                        const timestamp = document.getElementById('syncTimeInput').value;
                                        if (timestamp) {
                                            // Zaman damgasını saniyeye çevir
                                            const parts = timestamp.split(':').map(Number);
                                            let seconds = 0;
                                            if (parts.length === 3) { // saat:dakika:saniye
                                                seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                                            } else if (parts.length === 2) { // dakika:saniye
                                                seconds = parts[0] * 60 + parts[1];
                                            } else {
                                                seconds = parts[0];
                                            }
                                            
                                            // Zaman damgasını gönder
                                            if (isCreator && socket) {
                                                socket.emit('videoSeek', {
                                                    partyCode,
                                                    currentTime: seconds,
                                                    timestamp: Date.now(),
                                                    isPlaying: isPlaying
                                                });
                                                
                                                // Ayrıca manuel senkronizasyon mesajı da gönder
                                                socket.emit('manualSync', {
                                                    partyCode,
                                                    timestamp: seconds,
                                                    message: `Film ${formatTime(seconds)} noktasına senkronize edildi.`
                                                });
                                            }
                                            
                                            setCurrentTime(seconds);
                                            
                                            // Input'u temizle
                                            document.getElementById('syncTimeInput').value = '';
                                        }
                                    }}
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                >
                                    <i className="fas fa-sync-alt mr-1"></i> Senkronize Et
                                </button>
                            </div>
                        </div>
                        
                        {/* İlerleme Çubuğu */}
                        <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                            <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${(currentTime / totalDuration) * 100}%` }}
                            ></div>
                        </div>
                        
                        {/* Zaman Kontrolleri */}
                        <div className="flex justify-between text-gray-400 text-sm">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(totalDuration)}</span>
                        </div>
                    </div>
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

    // Zaman formatı yardımcı fonksiyonu
    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        
        const hDisplay = h > 0 ? h + ":" : "";
        const mDisplay = m < 10 ? "0" + m + ":" : m + ":";
        const sDisplay = s < 10 ? "0" + s : s;
        
        return hDisplay + mDisplay + sDisplay;
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
    const [playerLoaded, setPlayerLoaded] = React.useState(false);
    
    React.useEffect(() => {
        // YouTube API'yi yükle
        if (!window.YT) {
            // Global callback fonksiyonu
            window.onYouTubeIframeAPIReady = function() {
                console.log('YouTube API loaded globally');
                setPlayerLoaded(true);
            };
            
            // Script ekle
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.body.appendChild(tag);
        } else {
            setPlayerLoaded(true);
        }
        
        // Cleanup
        return () => {
            // Global callback'i temizle
            if (window.onYouTubeIframeAPIReady === window.onYouTubeIframeAPIReady) {
                window.onYouTubeIframeAPIReady = null;
            }
        };
    }, []);
    
    // Doğrudan iframe kullanarak YouTube videosunu göster
    return (
        <div className={className}>
            {playerLoaded ? (
                <iframe 
                    id="youtube-player"
                    width="100%" 
                    height="100%" 
                    src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}&rel=0&modestbranding=1`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={(e) => {
                        console.log('YouTube iframe loaded');
                        if (onReady) {
                            // YouTube Player API'yi iframe üzerinden başlat
                            if (window.YT && window.YT.Player) {
                                const player = new window.YT.Player('youtube-player', {
                                    events: {
                                        onReady: onReady,
                                        onError: (e) => console.error('YouTube player error:', e.data)
                                    }
                                });
                            }
                        }
                    }}
                ></iframe>
            ) : (
                <div className="flex items-center justify-center h-full bg-gray-800 text-white">
                    <p>YouTube yükleniyor...</p>
                </div>
            )}
        </div>
    );
}
