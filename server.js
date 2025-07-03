const express = require('express');
const http = require('http');
const path = require('path');
const socketio = require('socket.io');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// 🔒 Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📁 Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 💾 Multer config for handling uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const name = file.originalname.split('.')[0].replace(/\s+/g, '_');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${name}${ext}`);
  }
});
const upload = multer({ storage });

// 📋 In-memory data
let projects = [];
let users = []; // { username, password }

// 📁 Upload route
app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  const name = req.body.projectName?.toUpperCase() || 'UNTITLED PROJECT';

  if (!file) return res.status(400).send('NO FILE UPLOADED');

  const project = {
    name,
    filename: file.filename,
    type: file.mimetype.startsWith('image') ? 'image' : 'apk'
  };

  projects.unshift(project); // latest on top
  res.redirect('/projects.html');
});

// 🔍 API for projects
app.get('/api/projects', (req, res) => {
  res.json(projects);
});

// 🔥 DELETE a project by index
app.delete('/delete/:index', (req, res) => {
  const index = parseInt(req.params.index);
  if (isNaN(index) || !projects[index]) {
    return res.status(400).send('Invalid index');
  }

  // Delete file from uploads folder
  const filePath = path.join(uploadDir, projects[index].filename);
  fs.unlink(filePath, (err) => {
    if (err) console.warn('⚠️ Failed to delete file:', err.message);
  });

  // Remove from memory
  projects.splice(index, 1);
  res.sendStatus(200);
});

// 🔁 Default route (login)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

// 🔐 Register new user
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).send('Username and password required');

  const exists = users.find(u => u.username === username);
  if (exists)
    return res.status(409).send('User already exists');

  users.push({ username, password });
  console.log('✅ New user registered:', username);
  res.redirect('/login.html');
});

// 🔐 Login validation
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) return res.status(401).send('Invalid credentials');

  console.log(`✅ ${username} logged in`);
  res.redirect('/index.html');
});

// 💬 Socket.io Chat
io.on('connection', (socket) => {
  console.log('🟢 A user connected');

  socket.on('chat message', (msg) => {
    socket.broadcast.emit('chat message', msg); // send to all except sender
  });

  socket.on('typing', (isTyping) => {
    socket.broadcast.emit('typing', isTyping);
  });

  socket.on('disconnect', () => {
    console.log('🔴 A user disconnected');
  });
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
