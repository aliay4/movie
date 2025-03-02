function JoinParty({ onJoin }) {
    const [partyCode, setPartyCode] = React.useState('');
    const [userName, setUserName] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        try {
            if (!partyCode.trim()) {
                throw new Error('Parti kodu gerekli');
            }
            if (!userName.trim()) {
                throw new Error('İsim gerekli');
            }
            onJoin(partyCode, false, userName);
        } catch (error) {
            alert(error.message);
        }
    };

    const handleCreateParty = async () => {
        try {
            if (!userName.trim()) {
                throw new Error('İsim gerekli');
            }
            setIsLoading(true);
            const party = await createParty();
            onJoin(party.objectData.code, true, userName);
        } catch (error) {
            alert(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div data-name="join-party" className="join-container fixed inset-0 flex items-center justify-center">
            <div className="bg-white p-8 rounded-lg shadow-lg w-96">
                <h2 data-name="join-title" className="text-2xl font-bold mb-6 text-center">Film İzleme Partisi</h2>
                
                <input
                    data-name="name-input"
                    type="text"
                    placeholder="Adınızı girin"
                    className="w-full p-3 border rounded mb-4"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                />

                <button
                    data-name="create-button"
                    onClick={handleCreateParty}
                    disabled={isLoading}
                    className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700 mb-4 flex items-center justify-center"
                >
                    {isLoading ? (
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                    ) : (
                        <i className="fas fa-plus mr-2"></i>
                    )}
                    Yeni Parti Oluştur
                </button>

                <div className="relative my-6">
                    <hr className="border-t border-gray-300" />
                    <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-gray-500">
                        VEYA
                    </span>
                </div>

                <form onSubmit={handleSubmit}>
                    <input
                        data-name="party-code-input"
                        type="text"
                        placeholder="Parti kodunu girin"
                        className="w-full p-3 border rounded mb-4"
                        value={partyCode}
                        onChange={(e) => setPartyCode(e.target.value)}
                    />
                    <button
                        data-name="join-button"
                        type="submit"
                        className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 flex items-center justify-center"
                    >
                        <i className="fas fa-sign-in-alt mr-2"></i>
                        Partiye Katıl
                    </button>
                </form>
            </div>
        </div>
    );
}
