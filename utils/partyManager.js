const { trickleCreateObject, trickleListObjects, trickleUpdateObject, reportError } = require('./trickle');

function generatePartyCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createParty() {
    try {
        const partyCode = generatePartyCode();
        return trickleCreateObject('watchParty', {
            code: partyCode,
            createdAt: new Date().toISOString(),
            participants: [],
            creatorId: Date.now().toString(),
            videoUrl: null,
            videoType: null,
            isActive: true
        });
    } catch (error) {
        reportError(error);
        throw error;
    }
}

async function joinParty(partyCode) {
    try {
        const parties = await trickleListObjects('watchParty');
        const party = parties.items.find(p => p.objectData.code === partyCode);
        
        if (!party) {
            throw new Error('Party not found');
        }

        if (!party.objectData.isActive) {
            throw new Error('This party has ended');
        }

        return party;
    } catch (error) {
        reportError(error);
        throw error;
    }
}

async function updatePartyVideo(partyCode, videoUrl, videoType) {
    try {
        const parties = await trickleListObjects('watchParty');
        const party = parties.items.find(p => p.objectData.code === partyCode);
        
        if (!party) {
            throw new Error('Party not found');
        }

        return await trickleUpdateObject('watchParty', party.objectId, {
            ...party.objectData,
            videoUrl,
            videoType
        });
    } catch (error) {
        reportError(error);
        throw error;
    }
}

async function endParty(partyCode) {
    try {
        const parties = await trickleListObjects('watchParty');
        const party = parties.items.find(p => p.objectData.code === partyCode);
        
        if (!party) {
            throw new Error('Party not found');
        }

        return await trickleUpdateObject('watchParty', party.objectId, {
            ...party.objectData,
            isActive: false
        });
    } catch (error) {
        reportError(error);
        throw error;
    }
}

async function sendMessage(partyCode, userName, text) {
    try {
        return await trickleCreateObject(`chat:${partyCode}`, {
            sender: userName,
            text: text,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        reportError(error);
        throw error;
    }
}

async function getMessages(partyCode) {
    try {
        const messages = await trickleListObjects(`chat:${partyCode}`);
        return messages.items.sort((a, b) => 
            new Date(a.objectData.timestamp) - new Date(b.objectData.timestamp)
        );
    } catch (error) {
        reportError(error);
        throw error;
    }
}
