// ============================================
// PULSE MESSENGER — Серверная часть v1.3
// MongoDB + Cloudinary + все фичи
// ============================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 50 * 1024 * 1024
});

const PORT = process.env.PORT || 3000;

// ============================================
// CLOUDINARY
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dqjf052cj',
  api_key: process.env.CLOUDINARY_API_KEY || '624172533198457',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'Bc5T72aEKdQACF9DbDm98emSx4M'
});

// ============================================
// MONGODB
// ============================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://gogasexx:ПАРОЛЬ@cluster0.laqttnt.mongodb.net/pulse?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB подключена!'))
  .catch(err => console.error('❌ MongoDB ошибка:', err.message));

// --- СХЕМЫ ---

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  displayName: String,
  avatar: String,
  avatarColor: String,
  bio: String,
  status: { type: String, default: 'offline' },
  statusText: String,
  lastSeen: Date,
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  messageId: { type: String, unique: true },
  type: { type: String, default: 'text' },
  content: String,
  sender: {
    username: String,
    displayName: String,
    avatar: String,
    avatarColor: String
  },
  room: String,
  sendSound: String,
  replyTo: Object,
  file: Object,
  duration: Number,
  reactions: { type: Object, default: {} },
  readBy: [String],
  edited: { type: Boolean, default: false },
  pinned: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

const roomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true },
  name: String,
  type: { type: String, default: 'group' },
  members: [String],
  admin: String,
  description: String,
  avatar: String,
  pinnedMessage: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const Room = mongoose.model('Room', roomSchema);

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Multer для временного хранения перед загрузкой в Cloudinary
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ============================================
// ХРАНИЛИЩЕ ОНЛАЙН (только в RAM — это ОК)
// ============================================
const onlineUsers = new Map(); // socketId -> user
const unreadCounts = new Map(); // username -> { roomId: count }

// ============================================
// ИНИЦИАЛИЗАЦИЯ: Общий чат
// ============================================
async function initGeneralRoom() {
  const exists = await Room.findOne({ roomId: 'general' });
  if (!exists) {
    await Room.create({
      roomId: 'general',
      name: '💬 Общий чат',
      type: 'group',
      members: [],
      admin: null,
      description: 'Общий чат для всех пользователей'
    });
    console.log('✅ Общий чат создан');
  }
}
initGeneralRoom();

// ============================================
// ЗАГРУЗКА ФАЙЛОВ → Cloudinary
// ============================================
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }

  try {
    // Определяем тип ресурса
    let resourceType = 'auto';
    if (req.file.mimetype.startsWith('video/')) resourceType = 'video';
    if (req.file.mimetype.startsWith('audio/')) resourceType = 'video'; // Cloudinary хранит аудио как video

    // Загружаем в Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'pulse-messenger',
          resource_type: resourceType,
          public_id: `${uuidv4()}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const fileInfo = {
      id: uuidv4(),
      originalName: req.file.originalname,
      filename: result.public_id,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: result.secure_url,
      cloudinaryId: result.public_id,
      uploadedAt: new Date()
    };

    res.json(fileInfo);
  } catch (err) {
    console.error('Ошибка загрузки в Cloudinary:', err);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

// ============================================
// SOCKET.IO
// ============================================
io.on('connection', (socket) => {
  console.log(`🟢 Подключился: ${socket.id}`);

  // ----------------------------------------
  // ВХОД
  // ----------------------------------------
  socket.on('user:join', async (userData) => {
    try {
      // Ищем или создаём пользователя в БД
      let dbUser = await User.findOne({ username: userData.username });
      
      if (!dbUser) {
        dbUser = await User.create({
          username: userData.username,
          displayName: userData.displayName || userData.username,
          avatarColor: getRandomColor(),
          bio: '',
          status: 'online',
          lastSeen: new Date()
        });
      } else {
        dbUser.status = 'online';
        dbUser.lastSeen = new Date();
        if (userData.displayName) dbUser.displayName = userData.displayName;
        await dbUser.save();
      }

      const user = {
        id: socket.id,
        username: dbUser.username,
        displayName: dbUser.displayName,
        avatar: dbUser.avatar,
        avatarColor: dbUser.avatarColor,
        bio: dbUser.bio,
        status: 'online',
        statusText: dbUser.statusText || '',
        lastSeen: new Date()
      };

      onlineUsers.set(socket.id, user);

      if (!unreadCounts.has(user.username)) {
        unreadCounts.set(user.username, {});
      }

      // Добавляем в общий чат
      socket.join('general');
      await Room.updateOne(
        { roomId: 'general' },
        { $addToSet: { members: user.username } }
      );

      // Загружаем комнаты пользователя
      const userRooms = await Room.find({
        $or: [
          { members: user.username },
          { roomId: 'general' }
        ]
      });

      // Присоединяем к комнатам
      userRooms.forEach(room => socket.join(room.roomId));

      // Загружаем последние сообщения общего чата
      const generalMessages = await Message.find({ room: 'general' })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();

      const userUnread = unreadCounts.get(user.username) || {};

      socket.emit('user:joined', {
        user,
        rooms: userRooms.map(r => ({
          id: r.roomId,
          name: r.name,
          type: r.type,
          members: r.members,
          admin: r.admin,
          description: r.description,
          pinnedMessage: r.pinnedMessage
        })),
        messages: generalMessages.reverse(),
        onlineUsers: getOnlineUsersList(),
        unreadCounts: userUnread
      });

      io.emit('users:update', getOnlineUsersList());

      // Системное сообщение
      const sysMsg = await saveMessage({
        type: 'system',
        content: `${user.displayName} присоединился к чату`,
        room: 'general'
      });
      io.to('general').emit('message:new', sysMsg);

      console.log(`👤 ${user.displayName} вошёл`);
    } catch (err) {
      console.error('Ошибка входа:', err);
    }
  });

  // ----------------------------------------
  // СООБЩЕНИЯ
  // ----------------------------------------
  socket.on('message:send', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      const message = await saveMessage({
        type: data.type || 'text',
        content: data.content,
        room: data.room || 'general',
        sender: {
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          avatarColor: user.avatarColor
        },
        sendSound: data.sendSound || 'default',
        replyTo: data.replyTo || null,
        file: data.file || null,
        duration: data.duration || null
      });

      // Непрочитанные
      const room = await Room.findOne({ roomId: data.room });
      if (room) {
        room.members.forEach(memberUsername => {
          if (memberUsername !== user.username) {
            if (!unreadCounts.has(memberUsername)) {
              unreadCounts.set(memberUsername, {});
            }
            const counts = unreadCounts.get(memberUsername);
            counts[data.room] = (counts[data.room] || 0) + 1;

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
    } catch (err) {
      console.error('Ошибка отправки:', err);
    }
  });

  // ----------------------------------------
  // РЕДАКТИРОВАНИЕ СООБЩЕНИЙ
  // ----------------------------------------
  socket.on('message:edit', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      const msg = await Message.findOne({ messageId: data.messageId });
      if (!msg) return;
      if (msg.sender.username !== user.username) return;

      msg.content = data.newContent;
      msg.edited = true;
      await msg.save();

      io.to(msg.room).emit('message:edited', {
        messageId: data.messageId,
        newContent: data.newContent,
        room: msg.room
      });
    } catch (err) {
      console.error('Ошибка редактирования:', err);
    }
  });

  // ----------------------------------------
  // ЗАКРЕПЛЕНИЕ СООБЩЕНИЙ
  // ----------------------------------------
  socket.on('message:pin', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      const msg = await Message.findOne({ messageId: data.messageId });
      if (!msg) return;

      msg.pinned = !msg.pinned;
      await msg.save();

      // Сохраняем в комнате
      if (msg.pinned) {
        await Room.updateOne(
          { roomId: data.room },
          { pinnedMessage: data.messageId }
        );
      } else {
        await Room.updateOne(
          { roomId: data.room },
          { pinnedMessage: null }
        );
      }

      io.to(data.room).emit('message:pinned', {
        messageId: data.messageId,
        pinned: msg.pinned,
        room: data.room,
        content: msg.content,
        sender: msg.sender
      });

      const action = msg.pinned ? 'закрепил' : 'открепил';
      const sysMsg = await saveMessage({
        type: 'system',
        content: `${user.displayName} ${action} сообщение`,
        room: data.room
      });
      io.to(data.room).emit('message:new', sysMsg);
    } catch (err) {
      console.error('Ошибка закрепления:', err);
    }
  });

  // ----------------------------------------
  // ПРОЧИТАНО
  // ----------------------------------------
  socket.on('messages:read', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    const counts = unreadCounts.get(user.username);
    if (counts) counts[data.room] = 0;

    await Message.updateMany(
      { room: data.room, 'sender.username': { $ne: user.username } },
      { $addToSet: { readBy: user.username } }
    );

    socket.to(data.room).emit('messages:were-read', {
      room: data.room,
      readBy: user.username
    });
  });

  // ----------------------------------------
  // УДАЛЕНИЕ СООБЩЕНИЙ
  // ----------------------------------------
  socket.on('message:delete', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      const msg = await Message.findOne({ messageId: data.messageId });
      if (!msg) return;
      if (msg.sender.username !== user.username) return;

      // Удаляем файл из Cloudinary если есть
      if (msg.file && msg.file.cloudinaryId) {
        try {
          await cloudinary.uploader.destroy(msg.file.cloudinaryId);
        } catch (e) { console.log('Cloudinary delete error:', e); }
      }

      await Message.deleteOne({ messageId: data.messageId });

      io.to(data.room).emit('message:deleted', {
        messageId: data.messageId,
        room: data.room
      });
    } catch (err) {
      console.error('Ошибка удаления:', err);
    }
  });

  // ----------------------------------------
  // ОЧИСТКА ЧАТА
  // ----------------------------------------
  socket.on('chat:clear', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      const room = await Room.findOne({ roomId: data.room });
      if (!room) return;

      if (room.type === 'group' && room.roomId !== 'general') {
        if (room.admin && room.admin !== user.username) {
          socket.emit('error:message', { text: 'Только админ может очистить чат' });
          return;
        }
      }

      await Message.deleteMany({ room: data.room });

      room.members.forEach(m => {
        const c = unreadCounts.get(m);
        if (c) c[data.room] = 0;
      });

      const sysMsg = await saveMessage({
        type: 'system',
        content: `${user.displayName} очистил историю чата`,
        room: data.room
      });

      io.to(data.room).emit('chat:cleared', { room: data.room });
      io.to(data.room).emit('message:new', sysMsg);
    } catch (err) {
      console.error('Ошибка очистки:', err);
    }
  });

  // ----------------------------------------
  // УДАЛЕНИЕ ГРУППЫ
  // ----------------------------------------
  socket.on('room:delete', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      const room = await Room.findOne({ roomId: data.roomId });
      if (!room) return;
      if (room.roomId === 'general') return;

      if (room.admin && room.admin !== user.username) {
        socket.emit('error:message', { text: 'Только админ может удалить группу' });
        return;
      }

      io.to(data.roomId).emit('room:deleted', {
        roomId: data.roomId,
        roomName: room.name
      });

      await Message.deleteMany({ room: data.roomId });
      await Room.deleteOne({ roomId: data.roomId });
    } catch (err) {
      console.error('Ошибка удаления группы:', err);
    }
  });

  // ----------------------------------------
  // РЕАКЦИИ
  // ----------------------------------------
  socket.on('message:react', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      const msg = await Message.findOne({ messageId: data.messageId });
      if (!msg) return;

      if (!msg.reactions) msg.reactions = {};
      if (!msg.reactions[data.emoji]) msg.reactions[data.emoji] = [];

      const idx = msg.reactions[data.emoji].indexOf(user.username);
      if (idx > -1) {
        msg.reactions[data.emoji].splice(idx, 1);
        if (msg.reactions[data.emoji].length === 0) delete msg.reactions[data.emoji];
      } else {
        msg.reactions[data.emoji].push(user.username);
      }

      msg.markModified('reactions');
      await msg.save();

      io.to(data.room).emit('message:reacted', {
        messageId: data.messageId,
        reactions: msg.reactions,
        room: data.room
      });
    } catch (err) {
      console.error('Ошибка реакции:', err);
    }
  });

  // ----------------------------------------
  // ПЕЧАТАЕТ
  // ----------------------------------------
  socket.on('typing:start', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    socket.to(data.room).emit('typing:update', {
      username: user.displayName, room: data.room, isTyping: true
    });
  });

  socket.on('typing:stop', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    socket.to(data.room).emit('typing:update', {
      username: user.displayName, room: data.room, isTyping: false
    });
  });

  // ----------------------------------------
  // ПОИСК
  // ----------------------------------------
  socket.on('messages:search', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      const query = data.query.trim();
      if (!query) {
        socket.emit('messages:search-results', { results: [], query: '' });
        return;
      }

      const userRooms = await Room.find({ members: user.username });
      const roomIds = userRooms.map(r => r.roomId);
      roomIds.push('general');

      const results = await Message.find({
        room: { $in: roomIds },
        type: { $ne: 'system' },
        content: { $regex: query, $options: 'i' }
      })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

      // Добавляем имена комнат
      const roomMap = {};
      userRooms.forEach(r => { roomMap[r.roomId] = r.name; });
      roomMap['general'] = '💬 Общий чат';

      const enrichedResults = results.map(msg => ({
        ...msg,
        roomName: roomMap[msg.room] || 'Чат',
        roomId: msg.room
      }));

      socket.emit('messages:search-results', {
        results: enrichedResults,
        query: data.query
      });
    } catch (err) {
      console.error('Ошибка поиска:', err);
    }
  });

  // ----------------------------------------
  // ПРОФИЛЬ
  // ----------------------------------------
  socket.on('profile:update', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      const updates = {};
      if (data.displayName) { updates.displayName = data.displayName; user.displayName = data.displayName; }
      if (data.bio !== undefined) { updates.bio = data.bio; user.bio = data.bio; }
      if (data.statusText !== undefined) { updates.statusText = data.statusText; user.statusText = data.statusText; }
      if (data.avatarColor) { updates.avatarColor = data.avatarColor; user.avatarColor = data.avatarColor; }
      if (data.avatar !== undefined) { updates.avatar = data.avatar; user.avatar = data.avatar; }

      await User.updateOne({ username: user.username }, updates);

      io.emit('users:update', getOnlineUsersList());
      socket.emit('profile:updated', user);
    } catch (err) {
      console.error('Ошибка профиля:', err);
    }
  });

  socket.on('profile:get', async (data) => {
    try {
      const profile = await User.findOne({ username: data.username }).lean();
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
          joinedAt: profile.createdAt
        });
      }
    } catch (err) {
      console.error('Ошибка получения профиля:', err);
    }
  });

  // ----------------------------------------
  // КОМНАТЫ
  // ----------------------------------------
  socket.on('room:create', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      const roomId = uuidv4();
      const room = await Room.create({
        roomId,
        name: data.name,
        type: data.type || 'group',
        members: [user.username, ...(data.members || [])],
        admin: user.username,
        description: data.description || ''
      });

      const roomData = {
        id: room.roomId,
        name: room.name,
        type: room.type,
        members: room.members,
        admin: room.admin,
        description: room.description
      };

      room.members.forEach(memberUsername => {
        const memberSocket = findSocketByUsername(memberUsername);
        if (memberSocket) {
          memberSocket.join(roomId);
          memberSocket.emit('room:created', roomData);
        }
      });

      const sysMsg = await saveMessage({
        type: 'system',
        content: `${user.displayName} создал группу "${data.name}"`,
        room: roomId
      });
      io.to(roomId).emit('message:new', sysMsg);
    } catch (err) {
      console.error('Ошибка создания комнаты:', err);
    }
  });

  socket.on('room:join', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      socket.join(data.roomId);

      await Room.updateOne(
        { roomId: data.roomId },
        { $addToSet: { members: user.username } }
      );

      const room = await Room.findOne({ roomId: data.roomId }).lean();
      const roomMessages = await Message.find({ room: data.roomId })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();

      socket.emit('room:joined', {
        room: {
          id: room.roomId,
          name: room.name,
          type: room.type,
          members: room.members,
          admin: room.admin,
          description: room.description,
          pinnedMessage: room.pinnedMessage
        },
        messages: roomMessages.reverse()
      });
    } catch (err) {
      console.error('Ошибка входа в комнату:', err);
    }
  });

  // ----------------------------------------
  // ЛС
  // ----------------------------------------
  socket.on('dm:start', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      let existingRoom = await Room.findOne({
        type: 'direct',
        members: { $all: [user.username, data.username] }
      });

      if (existingRoom) {
        socket.join(existingRoom.roomId);
        const msgs = await Message.find({ room: existingRoom.roomId })
          .sort({ timestamp: -1 })
          .limit(100)
          .lean();

        socket.emit('dm:opened', {
          room: {
            id: existingRoom.roomId,
            name: existingRoom.name,
            type: 'direct',
            members: existingRoom.members
          },
          messages: msgs.reverse()
        });
        return;
      }

      const targetUser = await User.findOne({ username: data.username });
      const roomId = uuidv4();

      const room = await Room.create({
        roomId,
        name: `${user.displayName} & ${targetUser?.displayName || data.username}`,
        type: 'direct',
        members: [user.username, data.username]
      });

      socket.join(roomId);
      const targetSocket = findSocketByUsername(data.username);
      if (targetSocket) {
        targetSocket.join(roomId);
        targetSocket.emit('room:created', {
          id: room.roomId, name: room.name,
          type: 'direct', members: room.members
        });
      }

      socket.emit('dm:opened', {
        room: { id: room.roomId, name: room.name, type: 'direct', members: room.members },
        messages: []
      });
    } catch (err) {
      console.error('Ошибка ЛС:', err);
    }
  });

  // ----------------------------------------
  // ПЕРЕСЫЛКА
  // ----------------------------------------
  socket.on('message:forward', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      const originalMsg = await Message.findOne({ messageId: data.messageId }).lean();
      if (!originalMsg) return;

      const forwarded = await saveMessage({
        type: originalMsg.type,
        content: `↩️ Переслано от ${originalMsg.sender.displayName}:\n${originalMsg.content}`,
        room: data.targetRoom,
        sender: {
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          avatarColor: user.avatarColor
        },
        sendSound: 'default',
        file: originalMsg.file
      });

      io.to(data.targetRoom).emit('message:new', forwarded);
    } catch (err) {
      console.error('Ошибка пересылки:', err);
    }
  });

  // ----------------------------------------
  // СТАТУС
  // ----------------------------------------
  socket.on('user:status', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    user.statusText = data.statusText || '';
    user.status = data.status || 'online';

    await User.updateOne({ username: user.username }, {
      statusText: user.statusText,
      status: user.status
    });

    io.emit('users:update', getOnlineUsersList());
  });

  // ----------------------------------------
  // ОТКЛЮЧЕНИЕ
  // ----------------------------------------
  socket.on('disconnect', async () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      console.log(`🔴 ${user.displayName} вышел`);

      await User.updateOne({ username: user.username }, {
        status: 'offline',
        lastSeen: new Date()
      });

      const sysMsg = await saveMessage({
        type: 'system',
        content: `${user.displayName} покинул чат`,
        room: 'general'
      });
      io.to('general').emit('message:new', sysMsg);

      onlineUsers.delete(socket.id);
      io.emit('users:update', getOnlineUsersList());
    }
  });
});

// ============================================
// ФУНКЦИИ
// ============================================
async function saveMessage(data) {
  const msg = {
    messageId: uuidv4(),
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
    edited: false,
    pinned: false,
    timestamp: new Date()
  };

  try {
    await Message.create(msg);
  } catch (err) {
    console.error('Ошибка сохранения сообщения:', err);
  }

  return msg;
}

function getOnlineUsersList() {
  return Array.from(onlineUsers.values()).map(u => ({
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

function findSocketByUsername(username) {
  for (const [socketId, user] of onlineUsers) {
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
  ║     🚀 PULSE MESSENGER v1.3        ║
  ║     MongoDB + Cloudinary            ║
  ║     Порт: ${PORT}                      ║
  ╚══════════════════════════════════════╝
  `);
});