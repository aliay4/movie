function App() {
    const [partyCode, setPartyCode] = React.useState(null);
    const [isCreator, setIsCreator] = React.useState(false);
    const [videoUrl, setVideoUrl] = React.useState('');
    const [userName, setUserName] = React.useState('');

    const handleJoinParty = async (code, creator = false, name) => {
        try {
            const party = await joinParty(code);
            setPartyCode(code);
            setIsCreator(creator);
            setUserName(name);
            if (party.objectData.videoUrl) {
                setVideoUrl(party.objectData.videoUrl);
            }
        } catch (error) {
            reportError(error);
            alert('Partiye katılırken hata oluştu: ' + error.message);
        }
    };

    const handleEndParty = async () => {
        try {
            if (!isCreator) return;
            
            await endParty(partyCode);
            setPartyCode(null);
            setIsCreator(false);
            setVideoUrl('');
            setUserName('');
        } catch (error) {
            reportError(error);
            alert('Parti sonlandırılırken hata oluştu: ' + error.message);
        }
    };

    const handleVideoSelect = (url) => {
        setVideoUrl(url);
    };

    return (
        <div data-name="app">
            <Header />
            
            {!partyCode ? (
                <JoinParty onJoin={handleJoinParty} />
            ) : (
                <div className="container mx-auto p-4">
                    <div className="bg-gray-800 text-white p-4 rounded-lg mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div data-name="party-code-display" className="flex items-center">
                                <span className="mr-2">Parti Kodu:</span>
                                <span className="font-mono bg-gray-700 px-3 py-1 rounded">{partyCode}</span>
                            </div>
                            <div data-name="user-name-display" className="flex items-center">
                                <span className="mr-2">Katılan:</span>
                                <span className="font-mono bg-gray-700 px-3 py-1 rounded">{userName}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                data-name="copy-code-button"
                                onClick={() => {
                                    navigator.clipboard.writeText(partyCode);
                                    alert('Parti kodu panoya kopyalandı!');
                                }}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                            >
                                <i className="fas fa-copy mr-2"></i>
                                Kodu Kopyala
                            </button>
                            {isCreator && (
                                <button
                                    data-name="end-party-button"
                                    onClick={handleEndParty}
                                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                                >
                                    <i className="fas fa-times mr-2"></i>
                                    Partiyi Sonlandır
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2">
                            <VideoPlayer 
                                partyCode={partyCode} 
                                isCreator={isCreator}
                                onVideoSelect={handleVideoSelect}
                            />
                        </div>
                        <div>
                            <Chat partyCode={partyCode} userName={userName} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
