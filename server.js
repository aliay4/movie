require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Proxy endpoint for movie sites
app.get('/proxy', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        // URL'nin güvenli olduğundan emin olun
        const validDomains = [
            'hdfilmcehennemi.', 'fullhdfilmizlesene.', 'filmizle.', 'dizibox.',
            'dizilab.', 'dizilla.', 'jetfilmizle.', 'filmmakinesi.',
            'hdfilmcehennemi2.', 'filmmodu.', 'fullhdfilmizle.',
            'netflix.', 'amazon.', 'hulu.', 'disney.', 'blutv.', 'exxen.',
            'puhu.', 'mubi.', 'filmbox.'
        ];

        try {
            const urlObj = new URL(url);
            const isValidDomain = validDomains.some(domain => urlObj.hostname.includes(domain));
            if (!isValidDomain) {
                return res.status(403).json({ error: 'Domain not allowed' });
            }
        } catch (error) {
            return res.status(400).json({ error: 'Invalid URL' });
        }

        // İsteği yap ve yanıtı ilet
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': new URL(url).origin
            },
            responseType: 'stream'
        });

        // Yanıt başlıklarını ayarla
        Object.keys(response.headers).forEach(key => {
            // CORS ve güvenlik başlıklarını hariç tut
            if (!['x-frame-options', 'content-security-policy', 'access-control-allow-origin'].includes(key.toLowerCase())) {
                res.setHeader(key, response.headers[key]);
            }
        });

        // CORS başlıklarını ekle
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Yanıtı ilet
        response.data.pipe(res);
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({ error: 'Proxy request failed', details: error.message });
    }
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log('Yeni kullanıcı bağlandı:', socket.id);

  // Bir odaya katılma
  socket.on('joinRoom', (partyCode) => {
    socket.join(partyCode);
    console.log(`Kullanıcı ${socket.id} ${partyCode} odasına katıldı`);
  });

  // Video olayları
  socket.on('videoPlay', (data) => {
    socket.to(data.partyCode).emit('videoPlay', data);
  });

  socket.on('videoPause', (data) => {
    socket.to(data.partyCode).emit('videoPause', data);
  });

  socket.on('videoSeek', (data) => {
    socket.to(data.partyCode).emit('videoSeek', data);
  });

  // Manuel senkronizasyon olayı
  socket.on('manualSync', (data) => {
    socket.to(data.partyCode).emit('manualSync', data);
    console.log(`Manuel senkronizasyon: ${data.partyCode}, zaman: ${data.timestamp}`);
  });

  socket.on('endParty', (partyCode) => {
    io.to(partyCode).emit('partyEnded');
    console.log(`Party ended: ${partyCode}`);
  });

  socket.on('disconnect', () => {
    console.log('Kullanıcı ayrıldı:', socket.id);
  });
});

// MongoDB connection
console.log('Mevcut ortam değişkenleri:', {
  MONGO_URL: process.env.MONGO_URL,
  MONGODB_URI: process.env.MONGODB_URI,
  MONGO_URI: process.env.MONGO_URI
});

const MONGODB_URI = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 
  'mongodb://localhost:27017/movie-party';

console.log('Trying to connect to MongoDB with URI:', MONGODB_URI);

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  console.error('Connection error details:', JSON.stringify(err, null, 2));
});

// Define schemas
const partySchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
    participants: [String],
    creatorId: String,
    videoUrl: String,
    videoType: String,
    isActive: { type: Boolean, default: true }
});

const messageSchema = new mongoose.Schema({
    partyCode: { type: String, required: true },
    sender: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const Party = mongoose.model('Party', partySchema);
const Message = mongoose.model('Message', messageSchema);

// API Routes
app.post('/api/party', async (req, res) => {
    try {
        const party = new Party(req.body);
        await party.save();
        res.status(201).json({
            objectId: party._id.toString(),
            objectData: party.toObject()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/party/:code', async (req, res) => {
    try {
        const party = await Party.findOne({ code: req.params.code });
        if (!party) {
            return res.status(404).json({ error: 'Party not found' });
        }
        res.json({
            objectId: party._id.toString(),
            objectData: party.toObject()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/party', async (req, res) => {
    try {
        const parties = await Party.find({ isActive: true });
        const formattedParties = parties.map(party => ({
            objectId: party._id.toString(),
            objectData: party.toObject()
        }));
        res.json(formattedParties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/party/:code', async (req, res) => {
    try {
        const party = await Party.findOneAndUpdate(
            { code: req.params.code },
            req.body,
            { new: true }
        );
        if (!party) {
            return res.status(404).json({ error: 'Party not found' });
        }
        res.json({
            objectId: party._id.toString(),
            objectData: party.toObject()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/messages', async (req, res) => {
    try {
        const message = new Message(req.body);
        await message.save();
        res.status(201).json({
            objectId: message._id.toString(),
            objectData: message.toObject()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/messages/:partyCode', async (req, res) => {
    try {
        const messages = await Message.find({ partyCode: req.params.partyCode })
            .sort({ timestamp: 1 });
        const formattedMessages = messages.map(message => ({
            objectId: message._id.toString(),
            objectData: message.toObject()
        }));
        res.json(formattedMessages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
