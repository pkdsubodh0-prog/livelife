const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Nishad$100";
const DATA_FILE = path.join(__dirname, 'data', 'stream.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load stream data from disk
function getStreamData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error reading stream data:", err);
  }
  return {
    streamUrl: "https://demo.unified-streaming.com/k8s/live/stable/sintel.smil/.m3u8",
    title: "Live ROUNDER Stream",
    status: "LIVE",
    updatedAt: new Date().toISOString()
  };
}

// Save stream data to disk
function saveStreamData(data) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Error saving stream data:", err);
  }
}

// REST API Endpoints
app.get('/api/stream', (req, res) => {
  res.json(getStreamData());
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: "rounder_secure_token_" + Date.now() });
  } else {
    res.status(401).json({ success: false, message: "Galat password! Kripya sahi password enter karein." });
  }
});

app.post('/api/admin/update-stream', (req, res) => {
  const { password, streamUrl, title } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized access!" });
  }

  if (!streamUrl) {
    return res.status(400).json({ success: false, message: "Stream URL is required!" });
  }

  const updatedData = {
    streamUrl,
    title: title || "Live ROUNDER Stream",
    status: "LIVE",
    updatedAt: new Date().toISOString()
  };

  saveStreamData(updatedData);

  // Broadcast real-time update to all connected viewers
  io.emit('streamUpdated', updatedData);

  res.json({ success: true, message: "Stream updated successfully!", data: updatedData });
});

// Socket.IO Real-Time Connection
let viewerCount = 0;

io.on('connection', (socket) => {
  viewerCount++;
  
  // Send current stream data immediately upon connection
  socket.emit('currentStream', getStreamData());
  
  // Broadcast updated viewer count
  io.emit('viewerCount', { count: viewerCount });

  // Handle stream update via WebSocket
  socket.on('updateStream', (payload, callback) => {
    const { password, streamUrl, title } = payload;
    if (password !== ADMIN_PASSWORD) {
      if (typeof callback === 'function') callback({ success: false, message: "Galat password!" });
      return;
    }

    const updatedData = {
      streamUrl,
      title: title || "Live ROUNDER Stream",
      status: "LIVE",
      updatedAt: new Date().toISOString()
    };

    saveStreamData(updatedData);
    io.emit('streamUpdated', updatedData);

    if (typeof callback === 'function') callback({ success: true, message: "Live Stream Source Broadcasted to All Viewers!" });
  });

  socket.on('disconnect', () => {
    viewerCount = Math.max(0, viewerCount - 1);
    io.emit('viewerCount', { count: viewerCount });
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Live ROUNDER Server is running on http://localhost:${PORT}`);
  console.log(`🔒 Admin Password is set to: "${ADMIN_PASSWORD}"`);
});
