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

        // Daha gerçekçi tarayıcı başlıkları
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'iframe',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
            'Referer': new URL(url).origin
        };

        console.log(`Proxy request to: ${url}`);
        
        // İsteği yap ve yanıtı ilet
        const response = await axios({
            method: 'get',
            url: url,
            headers: headers,
            responseType: 'arraybuffer', // Binary data için
            maxRedirects: 5, // Yönlendirmeleri takip et
            timeout: 10000 // 10 saniye timeout
        });

        // İçerik türünü kontrol et
        const contentType = response.headers['content-type'] || 'text/html';
        
        // Yanıt başlıklarını ayarla
        Object.keys(response.headers).forEach(key => {
            // CORS ve güvenlik başlıklarını hariç tut
            if (!['x-frame-options', 'content-security-policy', 'access-control-allow-origin', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
                res.setHeader(key, response.headers[key]);
            }
        });

        // CORS başlıklarını ekle
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', contentType);
        
        // HTML içeriğini değiştir - CSP ve X-Frame-Options kaldır
        if (contentType.includes('html')) {
            let html = response.data.toString('utf8');
            
            // CSP meta etiketlerini kaldır
            html = html.replace(/<meta[^>]*content-security-policy[^>]*>/gi, '');
            
            // X-Frame-Options meta etiketlerini kaldır
            html = html.replace(/<meta[^>]*x-frame-options[^>]*>/gi, '');
            
            // Bağlantıları mutlak URL'lere dönüştür
            const baseUrl = new URL(url).origin;
            html = html.replace(/src="\/([^"]*)"/g, `src="${baseUrl}/$1"`);
            html = html.replace(/href="\/([^"]*)"/g, `href="${baseUrl}/$1"`);
            
            return res.send(html);
        }
        
        // Binary içerik için
        res.end(response.data);
    } catch (error) {
        console.error('Proxy error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
        }
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
  socket.on('manualSync', async (data) => {
    socket.to(data.partyCode).emit('manualSync', data);
    console.log(`Manuel senkronizasyon: ${data.partyCode}, zaman: ${data.timestamp}`);
    
    // Senkronizasyon mesajını sohbete ekle
    try {
      const message = {
        partyCode: data.partyCode,
        sender: 'Sistem',
        text: data.message || `Film ${formatTime(data.timestamp)} noktasına senkronize edildi.`
      };
      
      await Message.create(message);
      console.log('Senkronizasyon mesajı sohbete eklendi');
    } catch (error) {
      console.error('Senkronizasyon mesajı eklenirken hata:', error);
    }
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

// Zaman formatı yardımcı fonksiyonu
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const hDisplay = h > 0 ? h + ":" : "";
  const mDisplay = m < 10 ? "0" + m + ":" : m + ":";
  const sDisplay = s < 10 ? "0" + s : s;
  
  return hDisplay + mDisplay + sDisplay;
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
