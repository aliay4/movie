function VideoPlayer({ partyCode, isCreator, onVideoSelect }) {
    const videoRef = React.useRef(null);
    const fileInputRef = React.useRef(null);
    const [videoUrl, setVideoUrl] = React.useState('');
    const [videoType, setVideoType] = React.useState(''); // 'local', 'youtube', 'url'
    const [urlInput, setUrlInput] = React.useState('');
    const [showUrlInput, setShowUrlInput] = React.useState(false);
    const [socket, setSocket] = React.useState(null);
    const [isSeeking, setIsSeeking] = React.useState(false);
    const [isActive, setIsActive] = React.useState(true);

    // Olay işleyicilerini useCallback ile oluştur
    const handlePlay = React.useCallback(() => {
        if (isCreator && socket && videoRef.current) {
            console.log('Video play event emitted');
            socket.emit('videoPlay', {
                partyCode,
                currentTime: videoRef.current.currentTime
            });
        }
    }, [isCreator, socket, partyCode]);

    const handlePause = React.useCallback(() => {
        if (isCreator && socket && videoRef.current) {
            console.log('Video pause event emitted');
            socket.emit('videoPause', {
                partyCode,
                currentTime: videoRef.current.currentTime
            });
        }
    }, [isCreator, socket, partyCode]);

    const handleSeeking = React.useCallback(() => {
        if (isCreator && socket && videoRef.current && !isSeeking) {
            console.log('Video seek event emitted');
            socket.emit('videoSeek', {
                partyCode,
                currentTime: videoRef.current.currentTime
            });
        }
    }, [isCreator, socket, partyCode, isSeeking]);

    React.useEffect(() => {
        // Socket.IO bağlantısı
        const newSocket = io(window.location.origin);
        setSocket(newSocket);

        // Parti odasına katıl
        if (partyCode) {
            newSocket.emit('joinRoom', partyCode);
        }

        // Socket.IO olaylarını dinle
        newSocket.on('videoPlay', async (currentTime) => {
            if (!isCreator && videoRef.current) {
                console.log('Video play event received', currentTime);
                try {
                    videoRef.current.currentTime = currentTime;
                    await videoRef.current.play();
                } catch (error) {
                    console.error('Video play failed:', error);
                }
            }
        });

        newSocket.on('videoPause', (currentTime) => {
            if (!isCreator && videoRef.current) {
                console.log('Video pause event received', currentTime);
                videoRef.current.currentTime = currentTime;
                videoRef.current.pause();
            }
        });

        newSocket.on('videoSeek', (currentTime) => {
            if (!isCreator && videoRef.current && !isSeeking) {
                console.log('Video seek event received', currentTime);
                setIsSeeking(true);
                videoRef.current.currentTime = currentTime;
                setIsSeeking(false);
            }
        });

        newSocket.on('partyEnded', () => {
            console.log('Party ended event received');
            setIsActive(false);
            if (videoRef.current) {
                videoRef.current.pause();
            }
            window.location.reload(); // Sayfayı yenile
        });

        return () => {
            newSocket.disconnect();
        };
    }, [partyCode, isCreator]);

    React.useEffect(() => {
        // Parti bilgilerini periyodik olarak kontrol et
        const checkPartyUpdates = async () => {
            try {
                if (!partyCode) return;
                
                const party = await joinParty(partyCode);
                if (!party.objectData.isActive) {
                    console.log('Party is not active anymore');
                    setIsActive(false);
                    if (videoRef.current) {
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
                    if (videoRef.current) {
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
                finalUrl = `https://www.youtube.com/embed/${videoId}`;
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
                <iframe
                    className="w-full aspect-video"
                    src={videoUrl}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe>
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
                    onSeeked={() => setIsSeeking(false)}
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
