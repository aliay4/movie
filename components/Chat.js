function Chat({ partyCode, userName }) {
    const [messages, setMessages] = React.useState([]);
    const [newMessage, setNewMessage] = React.useState('');
    const chatRef = React.useRef(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        loadMessages();
        const interval = setInterval(loadMessages, 2000); // Poll for new messages every 2 seconds
        return () => clearInterval(interval);
    }, [partyCode]);

    const loadMessages = async () => {
        try {
            const chatMessages = await getMessages(partyCode);
            setMessages(chatMessages.map(msg => ({
                id: msg.objectId,
                ...msg.objectData
            })));
            setIsLoading(false);

            // Auto scroll to bottom when new messages arrive
            if (chatRef.current) {
                chatRef.current.scrollTop = chatRef.current.scrollHeight;
            }
        } catch (error) {
            reportError(error);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        try {
            if (!newMessage.trim()) return;

            await sendMessage(partyCode, userName, newMessage.trim());
            setNewMessage('');
            await loadMessages();
        } catch (error) {
            reportError(error);
            alert('Mesaj gönderilirken hata oluştu: ' + error.message);
        }
    };

    // Mesaj içeriğine göre özel stil belirle
    const getMessageStyle = (msg) => {
        // Senkronizasyon mesajı kontrolü
        if (msg.text.includes('senkronize edildi') || msg.text.toLowerCase().includes('sync')) {
            return 'bg-green-700 border-l-4 border-green-500';
        }
        
        // Kendi mesajlarımız
        if (msg.sender === userName) {
            return 'bg-blue-700';
        }
        
        // Diğer mesajlar
        return 'bg-gray-700';
    };

    return (
        <div data-name="chat" className="bg-gray-800 text-white p-4 rounded-lg">
            <h3 className="text-xl mb-4 font-bold">Sohbet</h3>
            <div data-name="chat-messages" ref={chatRef} className="chat-container h-96 overflow-y-auto mb-4 p-2 border border-gray-700 rounded">
                {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <i className="fas fa-spinner fa-spin"></i>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">
                        Henüz mesaj yok. İlk mesajı siz gönderin!
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            data-name="chat-message"
                            className={`chat-message p-3 rounded mb-2 ${getMessageStyle(msg)}`}
                        >
                            <div className="font-bold">{msg.sender}</div>
                            <div className="my-1">{msg.text}</div>
                            <div className="text-xs text-gray-400">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                            </div>
                        </div>
                    ))
                )}
            </div>
            <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
                <input
                    data-name="chat-input"
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Bir mesaj yazın..."
                    className="flex-1 p-2 rounded bg-gray-700"
                />
                <button
                    data-name="send-button"
                    type="submit"
                    className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
                >
                    Gönder
                </button>
            </form>
        </div>
    );
}
