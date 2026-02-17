// ============================================
// PULSE MESSENGER — Серверная часть
// ============================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 50 * 1024 * 1024 // 50MB для файлов
});

// ============================================
// НАСТРОЙКИ
// ============================================
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Создаём папку для загрузок
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(UPLOAD_DIR));

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB лимит
});

// ============================================
// ХРАНИЛИЩЕ (в памяти — потом заменим на БД)
// ============================================
const users = new Map();          // socketId -> userInfo
const rooms = new Map();          // roomId -> roomInfo
const messages = new Map();       // roomId -> [messages]
const userProfiles = new Map();   // username -> profile

// Общий чат по умолчанию
rooms.set('general', {
  id: 'general',
  name: '💬 Общий чат',
  type: 'group',
  members: [],
  createdAt: new Date()
});
messages.set('general', []);

// ============================================
// ЗАГРУЗКА ФАЙЛОВ (REST API)
// ============================================
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }

  const fileInfo = {
    id: uuidv4(),
    originalName: req.file.originalname,
    filename: req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
    url: `/uploads/${req.file.filename}`,
    uploadedAt: new Date()
  };

  res.json(fileInfo);
});

// ============================================
// SOCKET.IO — РЕАЛ-ТАЙМ ЛОГИКА
// ============================================
io.on('connection', (socket) => {
  console.log(`🟢 Подключился: ${socket.id}`);

  // ----------------------------------------
  // РЕГИСТРАЦИЯ / ВХОД
  // ----------------------------------------
  socket.on('user:join', (userData) => {
    const user = {
      id: socket.id,
      username: userData.username,
      displayName: userData.displayName || userData.username,
      avatar: userData.avatar || null,
      status: 'online',
      statusText: userData.statusText || '',
      joinedAt: new Date()
    };

    users.set(socket.id, user);
    userProfiles.set(user.username, user);

    // Присоединяем к общему чату
    socket.join('general');
    const generalRoom = rooms.get('general');
    if (!generalRoom.members.includes(user.username)) {
      generalRoom.members.push(user.username);
    }

    // Отправляем данные пользователю
    socket.emit('user:joined', {
      user,
      rooms: Array.from(rooms.values()).filter(r =>
        r.members.includes(user.username) || r.id === 'general'
      ),
      messages: messages.get('general') || []
    });

    // Уведомляем всех
    io.emit('users:update', getOnlineUsers());

    // Системное сообщение
    const sysMsg = createMessage({
      type: 'system',
      content: `${user.displayName} присоединился к чату`,
      room: 'general'
    });
    messages.get('general').push(sysMsg);
    io.to('general').emit('message:new', sysMsg);

    console.log(`👤 ${user.displayName} вошёл в чат`);
  });

  // ----------------------------------------
  // СООБЩЕНИЯ
  // ----------------------------------------
  socket.on('message:send', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const message = createMessage({
      type: data.type || 'text',        // text, image, file, voice
      content: data.content,
      room: data.room || 'general',
      sender: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar
      },
      // ✨ УНИКАЛЬНАЯ ФИШКА — звук отправки!
      sendSound: data.sendSound || 'default',
      replyTo: data.replyTo || null,
      file: data.file || null
    });

    // Сохраняем
    if (!messages.has(data.room)) {
      messages.set(data.room, []);
    }
    messages.get(data.room).push(message);

    // Отправляем всем в комнате
    io.to(data.room).emit('message:new', message);

    console.log(`💬 ${user.displayName}: ${data.content?.substring(0, 50)}`);
  });

  // ----------------------------------------
  // РЕАКЦИИ
  // ----------------------------------------
  socket.on('message:react', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const roomMessages = messages.get(data.room);
    if (!roomMessages) return;

    const message = roomMessages.find(m => m.id === data.messageId);
    if (!message) return;

    // Добавляем/убираем реакцию
    if (!message.reactions) message.reactions = {};
    if (!message.reactions[data.emoji]) {
      message.reactions[data.emoji] = [];
    }

    const userIndex = message.reactions[data.emoji].indexOf(user.username);
    if (userIndex > -1) {
      message.reactions[data.emoji].splice(userIndex, 1);
      if (message.reactions[data.emoji].length === 0) {
        delete message.reactions[data.emoji];
      }
    } else {
      message.reactions[data.emoji].push(user.username);
    }

    io.to(data.room).emit('message:reacted', {
      messageId: data.messageId,
      reactions: message.reactions,
      room: data.room
    });
  });

  // ----------------------------------------
  // ПЕЧАТАЕТ...
  // ----------------------------------------
  socket.on('typing:start', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.to(data.room).emit('typing:update', {
      username: user.displayName,
      room: data.room,
      isTyping: true
    });
  });

  socket.on('typing:stop', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.to(data.room).emit('typing:update', {
      username: user.displayName,
      room: data.room,
      isTyping: false
    });
  });

  // ----------------------------------------
  // КОМНАТЫ / ГРУППЫ
  // ----------------------------------------
  socket.on('room:create', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const roomId = uuidv4();
    const room = {
      id: roomId,
      name: data.name,
      type: data.type || 'group', // 'group' или 'direct'
      members: [user.username, ...(data.members || [])],
      admin: user.username,
      createdAt: new Date()
    };

    rooms.set(roomId, room);
    messages.set(roomId, []);

    // Присоединяем всех участников
    room.members.forEach(memberUsername => {
      const memberSocket = findSocketByUsername(memberUsername);
      if (memberSocket) {
        memberSocket.join(roomId);
        memberSocket.emit('room:created', room);
      }
    });

    const sysMsg = createMessage({
      type: 'system',
      content: `${user.displayName} создал группу "${data.name}"`,
      room: roomId
    });
    messages.get(roomId).push(sysMsg);
    io.to(roomId).emit('message:new', sysMsg);
  });

  socket.on('room:join', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    socket.join(data.roomId);
    const room = rooms.get(data.roomId);
    if (room && !room.members.includes(user.username)) {
      room.members.push(user.username);
    }

    socket.emit('room:joined', {
      room,
      messages: messages.get(data.roomId) || []
    });
  });

  // ----------------------------------------
  // ЛИЧНЫЕ СООБЩЕНИЯ
  // ----------------------------------------
  socket.on('dm:start', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    // Проверяем, есть ли уже ЛС между этими пользователями
    let existingRoom = null;
    rooms.forEach((room) => {
      if (room.type === 'direct' &&
          room.members.includes(user.username) &&
          room.members.includes(data.username)) {
        existingRoom = room;
      }
    });

    if (existingRoom) {
      socket.emit('dm:opened', {
        room: existingRoom,
        messages: messages.get(existingRoom.id) || []
      });
      return;
    }

    // Создаём новую комнату для ЛС
    const roomId = uuidv4();
    const targetProfile = userProfiles.get(data.username);
    const room = {
      id: roomId,
      name: `${user.displayName} & ${targetProfile?.displayName || data.username}`,
      type: 'direct',
      members: [user.username, data.username],
      createdAt: new Date()
    };

    rooms.set(roomId, room);
    messages.set(roomId, []);

    socket.join(roomId);
    const targetSocket = findSocketByUsername(data.username);
    if (targetSocket) {
      targetSocket.join(roomId);
      targetSocket.emit('room:created', room);
    }

    socket.emit('dm:opened', { room, messages: [] });
  });

  // ----------------------------------------
  // СТАТУС ПОЛЬЗОВАТЕЛЯ
  // ----------------------------------------
  socket.on('user:status', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    user.statusText = data.statusText || '';
    user.status = data.status || 'online';

    io.emit('users:update', getOnlineUsers());
  });

  // ----------------------------------------
  // ОТКЛЮЧЕНИЕ
  // ----------------------------------------
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`🔴 ${user.displayName} вышел`);

      const sysMsg = createMessage({
        type: 'system',
        content: `${user.displayName} покинул чат`,
        room: 'general'
      });
      messages.get('general')?.push(sysMsg);
      io.to('general').emit('message:new', sysMsg);

      users.delete(socket.id);
      io.emit('users:update', getOnlineUsers());
    }
  });
});

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function createMessage(data) {
  return {
    id: uuidv4(),
    type: data.type || 'text',
    content: data.content,
    sender: data.sender || { username: 'system', displayName: 'Система' },
    room: data.room,
    sendSound: data.sendSound || null,
    replyTo: data.replyTo || null,
    file: data.file || null,
    reactions: {},
    timestamp: new Date(),
    read: false
  };
}

function getOnlineUsers() {
  return Array.from(users.values()).map(u => ({
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar,
    status: u.status,
    statusText: u.statusText
  }));
}

function findSocketByUsername(username) {
  for (const [socketId, user] of users) {
    if (user.username === username) {
      return io.sockets.sockets.get(socketId);
    }
  }
  return null;
}

// ============================================
// ЗАПУСК
// ============================================
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║     🚀 PULSE MESSENGER SERVER       ║
  ║     Запущен на порту ${PORT}           ║
  ║     http://localhost:${PORT}           ║
  ╚══════════════════════════════════════╝
  `);
});