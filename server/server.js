// ============================================
// PULSE MESSENGER — Серверная часть v1.2
// + Прочитано/непрочитано
// + Голосовые сообщения
// + Уведомления
// + Поиск
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
  maxHttpBufferSize: 50 * 1024 * 1024
});

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ============================================
// ХРАНИЛИЩЕ
// ============================================
const users = new Map();
const rooms = new Map();
const messages = new Map();
const userProfiles = new Map();
const unreadCounts = new Map(); // username -> { roomId: count }

rooms.set('general', {
  id: 'general',
  name: '💬 Общий чат',
  type: 'group',
  members: [],
  createdAt: new Date()
});
messages.set('general', []);

// ============================================
// ЗАГРУЗКА ФАЙЛОВ
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
// SOCKET.IO
// ============================================
io.on('connection', (socket) => {
  console.log(`🟢 Подключился: ${socket.id}`);

  // ----------------------------------------
  // ВХОД
  // ----------------------------------------
  socket.on('user:join', (userData) => {
    const user = {
      id: socket.id,
      username: userData.username,
      displayName: userData.displayName || userData.username,
      avatar: userData.avatar || null,
      avatarColor: userData.avatarColor || getRandomColor(),
      bio: userData.bio || '',
      status: 'online',
      statusText: userData.statusText || '',
      lastSeen: new Date(),
      joinedAt: new Date()
    };

    users.set(socket.id, user);
    userProfiles.set(user.username, user);

    // Инициализируем счётчик непрочитанных
    if (!unreadCounts.has(user.username)) {
      unreadCounts.set(user.username, {});
    }

    socket.join('general');
    const generalRoom = rooms.get('general');
    if (!generalRoom.members.includes(user.username)) {
      generalRoom.members.push(user.username);
    }

    // Собираем данные о непрочитанных
    const userUnread = unreadCounts.get(user.username) || {};

    socket.emit('user:joined', {
      user,
      rooms: Array.from(rooms.values()).filter(r =>
        r.members.includes(user.username) || r.id === 'general'
      ),
      messages: messages.get('general') || [],
      onlineUsers: getOnlineUsers(),
      unreadCounts: userUnread
    });

    io.emit('users:update', getOnlineUsers());

    const sysMsg = createMessage({
      type: 'system',
      content: `${user.displayName} присоединился к чату`,
      room: 'general'
    });
    messages.get('general').push(sysMsg);
    io.to('general').emit('message:new', sysMsg);

    console.log(`👤 ${user.displayName} вошёл`);
  });

  // ----------------------------------------
  // СООБЩЕНИЯ
  // ----------------------------------------
  socket.on('message:send', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const message = createMessage({
      type: data.type || 'text',
      content: data.content,
      room: data.room || 'general',
      sender: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        avatarColor: user.avatarColor
      },
      sendSound: data.sendSound || 'default',
      replyTo: data.replyTo || null,
      file: data.file || null,
      duration: data.duration || null // Для голосовых
    });

    if (!messages.has(data.room)) {
      messages.set(data.room, []);
    }
    messages.get(data.room).push(message);

    // Увеличиваем счётчик непрочитанных для всех кроме отправителя
    const room = rooms.get(data.room);
    if (room) {
      room.members.forEach(memberUsername => {
        if (memberUsername !== user.username) {
          if (!unreadCounts.has(memberUsername)) {
            unreadCounts.set(memberUsername, {});
          }
          const counts = unreadCounts.get(memberUsername);
          counts[data.room] = (counts[data.room] || 0) + 1;

          // Отправляем обновление счётчика конкретному пользователю
          const memberSocket = findSocketByUsername(memberUsername);
          if (memberSocket) {
            memberSocket.emit('unread:update', {
              room: data.room,
              count: counts[data.room]
            });
          }
        }
      });
    }

    io.to(data.room).emit('message:new', message);
    console.log(`💬 ${user.displayName}: ${data.content?.substring(0, 50)}`);
  });

  // ----------------------------------------
  // ПРОЧИТАНО
  // ----------------------------------------
  socket.on('messages:read', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    // Сбрасываем счётчик непрочитанных
    const counts = unreadCounts.get(user.username);
    if (counts) {
      counts[data.room] = 0;
    }

    // Помечаем сообщения как прочитанные
    const roomMessages = messages.get(data.room);
    if (roomMessages) {
      roomMessages.forEach(msg => {
        if (msg.sender.username !== user.username && !msg.readBy) {
          msg.readBy = [];
        }
        if (msg.readBy && !msg.readBy.includes(user.username)) {
          msg.readBy.push(user.username);
        }
      });

      // Уведомляем отправителей что их сообщения прочитаны
      socket.to(data.room).emit('messages:were-read', {
        room: data.room,
        readBy: user.username
      });
    }
  });

  // ----------------------------------------
  // УДАЛЕНИЕ СООБЩЕНИЙ
  // ----------------------------------------
  socket.on('message:delete', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const roomMessages = messages.get(data.room);
    if (!roomMessages) return;

    const msgIndex = roomMessages.findIndex(m => m.id === data.messageId);
    if (msgIndex === -1) return;

    const message = roomMessages[msgIndex];
    if (message.sender.username !== user.username) return;

    roomMessages.splice(msgIndex, 1);

    io.to(data.room).emit('message:deleted', {
      messageId: data.messageId,
      room: data.room
    });

    console.log(`🗑 ${user.displayName} удалил сообщение`);
  });

  // ----------------------------------------
  // ОЧИСТКА ЧАТА
  // ----------------------------------------
  socket.on('chat:clear', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const room = rooms.get(data.room);
    if (!room) return;

    if (room.type === 'group' && room.id !== 'general') {
      if (room.admin && room.admin !== user.username) {
        socket.emit('error:message', { text: 'Только админ может очистить чат' });
        return;
      }
    }

    messages.set(data.room, []);

    // Сбрасываем непрочитанные для всех
    room.members.forEach(memberUsername => {
      const counts = unreadCounts.get(memberUsername);
      if (counts) {
        counts[data.room] = 0;
      }
    });

    const sysMsg = createMessage({
      type: 'system',
      content: `${user.displayName} очистил историю чата`,
      room: data.room
    });
    messages.get(data.room).push(sysMsg);

    io.to(data.room).emit('chat:cleared', { room: data.room });
    io.to(data.room).emit('message:new', sysMsg);

    console.log(`🧹 ${user.displayName} очистил чат ${room.name}`);
  });

  // ----------------------------------------
  // УДАЛЕНИЕ ГРУППЫ
  // ----------------------------------------
  socket.on('room:delete', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const room = rooms.get(data.roomId);
    if (!room) return;
    if (room.id === 'general') return;

    if (room.admin && room.admin !== user.username) {
      socket.emit('error:message', { text: 'Только админ может удалить группу' });
      return;
    }

    io.to(data.roomId).emit('room:deleted', {
      roomId: data.roomId,
      roomName: room.name
    });

    rooms.delete(data.roomId);
    messages.delete(data.roomId);

    console.log(`🗑 ${user.displayName} удалил группу "${room.name}"`);
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
  // ПЕЧАТАЕТ
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
  // ПОИСК СООБЩЕНИЙ
  // ----------------------------------------
  socket.on('messages:search', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const query = data.query.toLowerCase().trim();
    if (!query) {
      socket.emit('messages:search-results', { results: [], query: '' });
      return;
    }

    const results = [];

    // Ищем по всем комнатам где пользователь состоит
    rooms.forEach((room) => {
      if (!room.members.includes(user.username) && room.id !== 'general') return;

      const roomMessages = messages.get(room.id) || [];
      roomMessages.forEach(msg => {
        if (msg.type === 'system') return;
        if (msg.content && msg.content.toLowerCase().includes(query)) {
          results.push({
            ...msg,
            roomName: room.name,
            roomId: room.id
          });
        }
      });
    });

    // Сортируем по дате (новые первые)
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    socket.emit('messages:search-results', {
      results: results.slice(0, 50), // Максимум 50 результатов
      query: data.query
    });
  });

  // ----------------------------------------
  // ПРОФИЛЬ
  // ----------------------------------------
  socket.on('profile:update', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    if (data.displayName) user.displayName = data.displayName;
    if (data.bio !== undefined) user.bio = data.bio;
    if (data.statusText !== undefined) user.statusText = data.statusText;
    if (data.avatarColor) user.avatarColor = data.avatarColor;
    if (data.avatar !== undefined) user.avatar = data.avatar;

    userProfiles.set(user.username, user);

    io.emit('users:update', getOnlineUsers());
    socket.emit('profile:updated', user);

    console.log(`👤 ${user.displayName} обновил профиль`);
  });

  socket.on('profile:get', (data) => {
    const profile = userProfiles.get(data.username);
    if (profile) {
      socket.emit('profile:data', {
        username: profile.username,
        displayName: profile.displayName,
        avatar: profile.avatar,
        avatarColor: profile.avatarColor,
        bio: profile.bio,
        status: profile.status,
        statusText: profile.statusText,
        lastSeen: profile.lastSeen,
        joinedAt: profile.joinedAt
      });
    }
  });

  // ----------------------------------------
  // КОМНАТЫ
  // ----------------------------------------
  socket.on('room:create', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const roomId = uuidv4();
    const room = {
      id: roomId,
      name: data.name,
      type: data.type || 'group',
      members: [user.username, ...(data.members || [])],
      admin: user.username,
      createdAt: new Date()
    };

    rooms.set(roomId, room);
    messages.set(roomId, []);

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

    const roomOnline = getRoomOnlineUsers(data.roomId);

    socket.emit('room:joined', {
      room,
      messages: messages.get(data.roomId) || [],
      onlineUsers: roomOnline
    });
  });

  // ----------------------------------------
  // ЛС
  // ----------------------------------------
  socket.on('dm:start', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

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
  // СТАТУС
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

      user.lastSeen = new Date();
      user.status = 'offline';
      userProfiles.set(user.username, user);

      const generalRoom = rooms.get('general');
      if (generalRoom) {
        const memberIndex = generalRoom.members.indexOf(user.username);
        if (memberIndex > -1) {
          generalRoom.members.splice(memberIndex, 1);
        }
      }

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
// ФУНКЦИИ
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
    duration: data.duration || null,
    reactions: {},
    readBy: [],
    timestamp: new Date()
  };
}

function getOnlineUsers() {
  return Array.from(users.values()).map(u => ({
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar,
    avatarColor: u.avatarColor,
    bio: u.bio,
    status: u.status,
    statusText: u.statusText,
    lastSeen: u.lastSeen
  }));
}

function getRoomOnlineUsers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];

  const onlineUsernames = Array.from(users.values()).map(u => u.username);

  return room.members
    .filter(member => onlineUsernames.includes(member))
    .map(member => {
      const profile = userProfiles.get(member);
      return {
        username: member,
        displayName: profile?.displayName || member,
        avatarColor: profile?.avatarColor,
        status: 'online'
      };
    });
}

function findSocketByUsername(username) {
  for (const [socketId, user] of users) {
    if (user.username === username) {
      return io.sockets.sockets.get(socketId);
    }
  }
  return null;
}

function getRandomColor() {
  const colors = [
    '#6c5ce7', '#00cec9', '#e17055', '#00b894',
    '#fdcb6e', '#ff7675', '#a29bfe', '#55efc4',
    '#fab1a0', '#74b9ff', '#fd79a8', '#636e72'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ============================================
// ЗАПУСК
// ============================================
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║     🚀 PULSE MESSENGER v1.2        ║
  ║     Запущен на порту ${PORT}           ║
  ║     http://localhost:${PORT}           ║
  ╚══════════════════════════════════════╝
  `);
});