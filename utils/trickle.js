const API_BASE_URL = '/api';

async function handleResponse(response) {
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
    }
    return response.json();
}

// Error reporting function
function reportError(error) {
    console.error('Trickle Error:', error);
}

// Create a new object in the specified collection
async function trickleCreateObject(collection, objectData) {
    try {
        if (collection.startsWith('chat:')) {
            const partyCode = collection.split(':')[1];
            const response = await fetch(`${API_BASE_URL}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    partyCode,
                    ...objectData
                })
            });
            return handleResponse(response);
        } else if (collection === 'watchParty') {
            const response = await fetch(`${API_BASE_URL}/party`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(objectData)
            });
            return handleResponse(response);
        }
    } catch (error) {
        reportError(error);
        throw error;
    }
}

// List objects from a collection
async function trickleListObjects(collection) {
    try {
        if (collection.startsWith('chat:')) {
            const partyCode = collection.split(':')[1];
            const response = await fetch(`${API_BASE_URL}/messages/${partyCode}`);
            const messages = await handleResponse(response);
            return { items: messages };
        } else if (collection === 'watchParty') {
            const response = await fetch(`${API_BASE_URL}/party`);
            const parties = await handleResponse(response);
            return { items: Array.isArray(parties) ? parties : [parties] };
        }
    } catch (error) {
        reportError(error);
        throw error;
    }
}

// Update an existing object
async function trickleUpdateObject(collection, objectId, newObjectData) {
    try {
        if (collection === 'watchParty') {
            const response = await fetch(`${API_BASE_URL}/party/${newObjectData.code}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newObjectData)
            });
            return handleResponse(response);
        }
    } catch (error) {
        reportError(error);
        throw error;
    }
}

module.exports = {
    trickleCreateObject,
    trickleListObjects,
    trickleUpdateObject,
    reportError
};