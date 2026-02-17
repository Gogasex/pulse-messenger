// ============================================
// PULSE MESSENGER — ULTIMATE EDITION v2.0
// Полная версия со всеми фичами
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
  .catch(err => console.error('❌ MongoDB:', err.message));

// ============================================
// СХЕМЫ БАЗЫ ДАННЫХ
// ============================================
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  displayName: String,
  avatar: String,
  avatarColor: { type: String, default: '#6c5ce7' },
  bio: { type: String, default: '' },
  status: { type: String, default: 'offline' },
  statusText: { type: String, default: '' },
  activityStatus: { type: String, default: '' },
  lastSeen: Date,
  invisible: { type: Boolean, default: false },
  doNotDisturb: { type: Boolean, default: false },
  blockedUsers: [String],
  theme: { type: String, default: 'dark' },
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
  forwarded: { type: Boolean, default: false },
  forwardedFrom: String,
  expiresAt: Date,
  pollData: Object,
  gameData: Object,
  timestamp: { type: Date, default: Date.now }
});

const roomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true },
  name: String,
  type: { type: String, default: 'group' },
  members: [String],
  admin: String,
  moderators: [String],
  banned: [String],
  muted: [String],
  description: { type: String, default: '' },
  avatar: String,
  pinnedMessage: String,
  inviteCode: String,
  isSecret: { type: Boolean, default: false },
  secretPassword: String,
  slowMode: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const pollSchema = new mongoose.Schema({
  pollId: { type: String, unique: true },
  question: String,
  options: [{
    text: String,
    votes: [String]
  }],
  room: String,
  creator: String,
  multipleChoice: { type: Boolean, default: false },
  anonymous: { type: Boolean, default: false },
  closed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const Room = mongoose.model('Room', roomSchema);
const Poll = mongoose.model('Poll', pollSchema);

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ============================================
// ОНЛАЙН ХРАНИЛИЩЕ (RAM)
// ============================================
const onlineUsers = new Map();
const unreadCounts = new Map();
const activeGames = new Map();
const lastMessageTime = new Map();

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
async function init() {
  const exists = await Room.findOne({ roomId: 'general' });
  if (!exists) {
    await Room.create({
      roomId: 'general', name: '💬 Общий чат', type: 'group',
      members: [], admin: null, description: 'Общий чат для всех',
      inviteCode: 'general'
    });
  }
  // Удаляем истёкшие сообщения каждую минуту
  setInterval(async () => {
    await Message.deleteMany({ expiresAt: { $lt: new Date() } });
  }, 60000);
}
init();

// ============================================
// ЗАГРУЗКА ФАЙЛОВ
// ============================================
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  try {
    let resourceType = 'auto';
    if (req.file.mimetype.startsWith('audio/')) resourceType = 'video';
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'pulse-messenger', resource_type: resourceType, public_id: uuidv4() },
        (err, result) => err ? reject(err) : resolve(result)
      );
      stream.end(req.file.buffer);
    });
    res.json({
      id: uuidv4(), originalName: req.file.originalname,
      filename: result.public_id, size: req.file.size,
      mimetype: req.file.mimetype, url: result.secure_url,
      cloudinaryId: result.public_id, uploadedAt: new Date()
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Ошибка загрузки' });
  }
});

// Присоединение по ссылке-приглашению
app.get('/invite/:code', (req, res) => {
  res.redirect(`/?invite=${req.params.code}`);
});

// ============================================
// SOCKET.IO — ГЛАВНАЯ ЛОГИКА
// ============================================
io.on('connection', (socket) => {
  console.log(`🟢 ${socket.id}`);

  // ========== ВХОД ==========
  socket.on('user:join', async (userData) => {
    try {
      let dbUser = await User.findOne({ username: userData.username });
      if (!dbUser) {
        dbUser = await User.create({
          username: userData.username,
          displayName: userData.displayName || userData.username,
          avatarColor: getRandomColor(),
          status: 'online', lastSeen: new Date()
        });
      } else {
        dbUser.status = dbUser.invisible ? 'offline' : 'online';
        dbUser.lastSeen = new Date();
        if (userData.displayName) dbUser.displayName = userData.displayName;
        await dbUser.save();
      }

      const user = {
        id: socket.id, username: dbUser.username,
        displayName: dbUser.displayName, avatar: dbUser.avatar,
        avatarColor: dbUser.avatarColor, bio: dbUser.bio,
        status: dbUser.invisible ? 'offline' : 'online',
        statusText: dbUser.statusText, activityStatus: dbUser.activityStatus,
        invisible: dbUser.invisible, doNotDisturb: dbUser.doNotDisturb,
        blockedUsers: dbUser.blockedUsers || [], theme: dbUser.theme,
        lastSeen: new Date()
      };

      onlineUsers.set(socket.id, user);
      if (!unreadCounts.has(user.username)) unreadCounts.set(user.username, {});

      socket.join('general');
      await Room.updateOne({ roomId: 'general' }, { $addToSet: { members: user.username } });

      const userRooms = await Room.find({
        $or: [{ members: user.username }, { roomId: 'general' }],
        banned: { $ne: user.username }
      });

      userRooms.forEach(r => socket.join(r.roomId));

      const generalMsgs = await Message.find({ room: 'general' })
        .sort({ timestamp: -1 }).limit(100).lean();

      socket.emit('user:joined', {
        user,
        rooms: userRooms.map(r => formatRoom(r)),
        messages: generalMsgs.reverse(),
        onlineUsers: getOnlineUsersList(),
        unreadCounts: unreadCounts.get(user.username) || {}
      });

      if (!user.invisible) {
        io.emit('users:update', getOnlineUsersList());
        const sysMsg = await saveMessage({
          type: 'system', content: `${user.displayName} присоединился к чату`, room: 'general'
        });
        io.to('general').emit('message:new', sysMsg);
      }
    } catch (err) { console.error('Join error:', err); }
  });

  // ========== СООБЩЕНИЯ ==========
  socket.on('message:send', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      const room = await Room.findOne({ roomId: data.room });
      if (!room) return;

      // Проверка бана
      if (room.banned?.includes(user.username)) {
        socket.emit('error:message', { text: 'Вы заблокированы в этом чате' });
        return;
      }

      // Проверка мута
      if (room.muted?.includes(user.username)) {
        socket.emit('error:message', { text: 'Вы не можете писать в этом чате (мут)' });
        return;
      }

      // Slow mode
      if (room.slowMode > 0) {
        const key = `${user.username}:${data.room}`;
        const lastTime = lastMessageTime.get(key);
        if (lastTime && Date.now() - lastTime < room.slowMode * 1000) {
          const wait = Math.ceil((room.slowMode * 1000 - (Date.now() - lastTime)) / 1000);
          socket.emit('error:message', { text: `Подождите ${wait} сек. (медленный режим)` });
          return;
        }
        lastMessageTime.set(key, Date.now());
      }

      const msgData = {
        type: data.type || 'text',
        content: data.content, room: data.room,
        sender: { username: user.username, displayName: user.displayName, avatar: user.avatar, avatarColor: user.avatarColor },
        sendSound: data.sendSound || 'default',
        replyTo: data.replyTo, file: data.file,
        duration: data.duration, pollData: data.pollData,
        gameData: data.gameData
      };

      // Исчезающие сообщения
      if (data.expiresIn) {
        msgData.expiresAt = new Date(Date.now() + data.expiresIn * 60000);
      }

      const message = await saveMessage(msgData);

      // Непрочитанные
      room.members.forEach(m => {
        if (m !== user.username) {
          if (!unreadCounts.has(m)) unreadCounts.set(m, {});
          const c = unreadCounts.get(m);
          c[data.room] = (c[data.room] || 0) + 1;
          const ms = findSocketByUsername(m);
          if (ms) {
            const targetUser = getOnlineUser(m);
            if (!targetUser?.doNotDisturb) {
              ms.emit('unread:update', { room: data.room, count: c[data.room] });
            }
          }
        }
      });

      io.to(data.room).emit('message:new', message);
    } catch (err) { console.error('Send error:', err); }
  });

  // ========== РЕДАКТИРОВАНИЕ ==========
  socket.on('message:edit', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const msg = await Message.findOne({ messageId: data.messageId });
      if (!msg || msg.sender.username !== user.username) return;
      msg.content = data.newContent;
      msg.edited = true;
      await msg.save();
      io.to(msg.room).emit('message:edited', {
        messageId: data.messageId, newContent: data.newContent, room: msg.room
      });
    } catch (err) { console.error('Edit error:', err); }
  });

  // ========== ЗАКРЕПЛЕНИЕ ==========
  socket.on('message:pin', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const msg = await Message.findOne({ messageId: data.messageId });
      if (!msg) return;
      msg.pinned = !msg.pinned;
      await msg.save();
      await Room.updateOne({ roomId: data.room }, { pinnedMessage: msg.pinned ? data.messageId : null });
      io.to(data.room).emit('message:pinned', {
        messageId: data.messageId, pinned: msg.pinned, room: data.room,
        content: msg.content, sender: msg.sender
      });
      const action = msg.pinned ? 'закрепил' : 'открепил';
      const sysMsg = await saveMessage({ type: 'system', content: `${user.displayName} ${action} сообщение`, room: data.room });
      io.to(data.room).emit('message:new', sysMsg);
    } catch (err) { console.error('Pin error:', err); }
  });

  // ========== ПЕРЕСЫЛКА ==========
  socket.on('message:forward', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const orig = await Message.findOne({ messageId: data.messageId }).lean();
      if (!orig) return;
      const fwd = await saveMessage({
        type: orig.type, room: data.targetRoom,
        content: orig.content,
        sender: { username: user.username, displayName: user.displayName, avatar: user.avatar, avatarColor: user.avatarColor },
        sendSound: 'default', file: orig.file,
        forwarded: true, forwardedFrom: orig.sender.displayName
      });
      io.to(data.targetRoom).emit('message:new', fwd);
    } catch (err) { console.error('Forward error:', err); }
  });

  // ========== ПРОЧИТАНО ==========
  socket.on('messages:read', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    const c = unreadCounts.get(user.username);
    if (c) c[data.room] = 0;
    await Message.updateMany(
      { room: data.room, 'sender.username': { $ne: user.username } },
      { $addToSet: { readBy: user.username } }
    );
    socket.to(data.room).emit('messages:were-read', { room: data.room, readBy: user.username });
  });

  // ========== УДАЛЕНИЕ ==========
  socket.on('message:delete', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const msg = await Message.findOne({ messageId: data.messageId });
      if (!msg) return;
      const room = await Room.findOne({ roomId: data.room });
      const canDelete = msg.sender.username === user.username ||
        room?.admin === user.username ||
        room?.moderators?.includes(user.username);
      if (!canDelete) return;
      if (msg.file?.cloudinaryId) {
        try { await cloudinary.uploader.destroy(msg.file.cloudinaryId); } catch (e) {}
      }
      await Message.deleteOne({ messageId: data.messageId });
      io.to(data.room).emit('message:deleted', { messageId: data.messageId, room: data.room });
    } catch (err) { console.error('Delete error:', err); }
  });

  // ========== ОЧИСТКА ЧАТА ==========
  socket.on('chat:clear', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const room = await Room.findOne({ roomId: data.room });
      if (!room) return;
      if (room.type === 'group' && room.roomId !== 'general') {
        if (room.admin !== user.username && !room.moderators?.includes(user.username)) {
          socket.emit('error:message', { text: 'Нет прав' }); return;
        }
      }
      await Message.deleteMany({ room: data.room });
      const sysMsg = await saveMessage({ type: 'system', content: `${user.displayName} очистил чат`, room: data.room });
      io.to(data.room).emit('chat:cleared', { room: data.room });
      io.to(data.room).emit('message:new', sysMsg);
    } catch (err) { console.error('Clear error:', err); }
  });

  // ========== УДАЛЕНИЕ ГРУППЫ ==========
  socket.on('room:delete', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const room = await Room.findOne({ roomId: data.roomId });
      if (!room || room.roomId === 'general') return;
      if (room.admin !== user.username) {
        socket.emit('error:message', { text: 'Только админ может удалить' }); return;
      }
      io.to(data.roomId).emit('room:deleted', { roomId: data.roomId, roomName: room.name });
      await Message.deleteMany({ room: data.roomId });
      await Room.deleteOne({ roomId: data.roomId });
    } catch (err) { console.error('Delete room error:', err); }
  });

  // ========== РЕАКЦИИ ==========
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
        if (!msg.reactions[data.emoji].length) delete msg.reactions[data.emoji];
      } else {
        msg.reactions[data.emoji].push(user.username);
      }
      msg.markModified('reactions');
      await msg.save();
      io.to(data.room).emit('message:reacted', { messageId: data.messageId, reactions: msg.reactions, room: data.room });
    } catch (err) { console.error('React error:', err); }
  });

  // ========== ПЕЧАТАЕТ ==========
  socket.on('typing:start', (data) => {
    const user = onlineUsers.get(socket.id);
    if (user) socket.to(data.room).emit('typing:update', { username: user.displayName, room: data.room, isTyping: true });
  });
  socket.on('typing:stop', (data) => {
    const user = onlineUsers.get(socket.id);
    if (user) socket.to(data.room).emit('typing:update', { username: user.displayName, room: data.room, isTyping: false });
  });

  // ========== ПОИСК ==========
  socket.on('messages:search', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const q = data.query.trim();
      if (!q) { socket.emit('messages:search-results', { results: [], query: '' }); return; }
      const rooms = await Room.find({ members: user.username });
      const roomIds = rooms.map(r => r.roomId);
      roomIds.push('general');
      const results = await Message.find({
        room: { $in: roomIds }, type: { $ne: 'system' },
        content: { $regex: q, $options: 'i' }
      }).sort({ timestamp: -1 }).limit(50).lean();
      const roomMap = {};
      rooms.forEach(r => roomMap[r.roomId] = r.name);
      roomMap['general'] = '💬 Общий чат';
      socket.emit('messages:search-results', {
        results: results.map(m => ({ ...m, roomName: roomMap[m.room] || 'Чат', roomId: m.room })),
        query: data.query
      });
    } catch (err) { console.error('Search error:', err); }
  });

  // ========== ПРОФИЛЬ ==========
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
      if (data.activityStatus !== undefined) { updates.activityStatus = data.activityStatus; user.activityStatus = data.activityStatus; }
      if (data.invisible !== undefined) { updates.invisible = data.invisible; user.invisible = data.invisible; user.status = data.invisible ? 'offline' : 'online'; updates.status = user.status; }
      if (data.doNotDisturb !== undefined) { updates.doNotDisturb = data.doNotDisturb; user.doNotDisturb = data.doNotDisturb; }
      if (data.theme) { updates.theme = data.theme; user.theme = data.theme; }
      await User.updateOne({ username: user.username }, updates);
      io.emit('users:update', getOnlineUsersList());
      socket.emit('profile:updated', user);
    } catch (err) { console.error('Profile error:', err); }
  });

  socket.on('profile:get', async (data) => {
    try {
      const p = await User.findOne({ username: data.username }).lean();
      if (p) socket.emit('profile:data', {
        username: p.username, displayName: p.displayName, avatar: p.avatar,
        avatarColor: p.avatarColor, bio: p.bio, status: p.status,
        statusText: p.statusText, activityStatus: p.activityStatus,
        lastSeen: p.lastSeen, joinedAt: p.createdAt
      });
    } catch (err) { console.error('Get profile error:', err); }
  });

  // ========== БЛОКИРОВКА ==========
  socket.on('user:block', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    await User.updateOne({ username: user.username }, { $addToSet: { blockedUsers: data.username } });
    user.blockedUsers = user.blockedUsers || [];
    user.blockedUsers.push(data.username);
    socket.emit('user:blocked', { username: data.username });
  });

  socket.on('user:unblock', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    await User.updateOne({ username: user.username }, { $pull: { blockedUsers: data.username } });
    user.blockedUsers = (user.blockedUsers || []).filter(u => u !== data.username);
    socket.emit('user:unblocked', { username: data.username });
  });

  // ========== КОМНАТЫ ==========
  socket.on('room:create', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const roomId = uuidv4();
      const inviteCode = generateInviteCode();
      const room = await Room.create({
        roomId, name: data.name, type: data.type || 'group',
        members: [user.username, ...(data.members || [])],
        admin: user.username, moderators: [],
        description: data.description || '',
        inviteCode, isSecret: data.isSecret || false,
        secretPassword: data.secretPassword || null
      });
      const rd = formatRoom(room);
      room.members.forEach(m => {
        const ms = findSocketByUsername(m);
        if (ms) { ms.join(roomId); ms.emit('room:created', rd); }
      });
      const sysMsg = await saveMessage({ type: 'system', content: `${user.displayName} создал группу "${data.name}"`, room: roomId });
      io.to(roomId).emit('message:new', sysMsg);
    } catch (err) { console.error('Create room error:', err); }
  });

  socket.on('room:join', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      socket.join(data.roomId);
      await Room.updateOne({ roomId: data.roomId }, { $addToSet: { members: user.username } });
      const room = await Room.findOne({ roomId: data.roomId }).lean();
      const msgs = await Message.find({ room: data.roomId }).sort({ timestamp: -1 }).limit(100).lean();
      socket.emit('room:joined', { room: formatRoom(room), messages: msgs.reverse() });
    } catch (err) { console.error('Join room error:', err); }
  });

  // Присоединение по приглашению
  socket.on('room:join-invite', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const room = await Room.findOne({ inviteCode: data.inviteCode });
      if (!room) { socket.emit('error:message', { text: 'Приглашение не найдено' }); return; }
      if (room.banned?.includes(user.username)) { socket.emit('error:message', { text: 'Вы заблокированы' }); return; }
      if (room.isSecret && data.password !== room.secretPassword) {
        socket.emit('error:message', { text: 'Неверный пароль' }); return;
      }
      await Room.updateOne({ roomId: room.roomId }, { $addToSet: { members: user.username } });
      socket.join(room.roomId);
      const msgs = await Message.find({ room: room.roomId }).sort({ timestamp: -1 }).limit(100).lean();
      socket.emit('room:joined', { room: formatRoom(room), messages: msgs.reverse() });
      socket.emit('room:created', formatRoom(room));
      const sysMsg = await saveMessage({ type: 'system', content: `${user.displayName} присоединился по приглашению`, room: room.roomId });
      io.to(room.roomId).emit('message:new', sysMsg);
    } catch (err) { console.error('Join invite error:', err); }
  });

  // Настройки комнаты
  socket.on('room:update', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const room = await Room.findOne({ roomId: data.roomId });
      if (!room) return;
      if (room.admin !== user.username && !room.moderators?.includes(user.username)) return;
      const updates = {};
      if (data.name) updates.name = data.name;
      if (data.description !== undefined) updates.description = data.description;
      if (data.slowMode !== undefined) updates.slowMode = data.slowMode;
      if (data.avatar) updates.avatar = data.avatar;
      await Room.updateOne({ roomId: data.roomId }, updates);
      const updated = await Room.findOne({ roomId: data.roomId });
      io.to(data.roomId).emit('room:updated', formatRoom(updated));
    } catch (err) { console.error('Update room error:', err); }
  });

  // ========== МОДЕРАЦИЯ ==========
  socket.on('room:set-role', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const room = await Room.findOne({ roomId: data.roomId });
      if (!room || room.admin !== user.username) return;
      if (data.role === 'moderator') {
        await Room.updateOne({ roomId: data.roomId }, { $addToSet: { moderators: data.username } });
      } else if (data.role === 'member') {
        await Room.updateOne({ roomId: data.roomId }, { $pull: { moderators: data.username } });
      }
      const sysMsg = await saveMessage({ type: 'system', content: `${user.displayName} изменил роль ${data.username}: ${data.role}`, room: data.roomId });
      io.to(data.roomId).emit('message:new', sysMsg);
      const updated = await Room.findOne({ roomId: data.roomId });
      io.to(data.roomId).emit('room:updated', formatRoom(updated));
    } catch (err) { console.error('Set role error:', err); }
  });

  socket.on('room:ban', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const room = await Room.findOne({ roomId: data.roomId });
      if (!room) return;
      if (room.admin !== user.username && !room.moderators?.includes(user.username)) return;
      if (data.username === room.admin) return;
      await Room.updateOne({ roomId: data.roomId }, {
        $addToSet: { banned: data.username },
        $pull: { members: data.username, moderators: data.username }
      });
      const targetSocket = findSocketByUsername(data.username);
      if (targetSocket) {
        targetSocket.leave(data.roomId);
        targetSocket.emit('room:deleted', { roomId: data.roomId, roomName: room.name + ' (забанены)' });
      }
      const sysMsg = await saveMessage({ type: 'system', content: `${user.displayName} заблокировал ${data.username}`, room: data.roomId });
      io.to(data.roomId).emit('message:new', sysMsg);
    } catch (err) { console.error('Ban error:', err); }
  });

  socket.on('room:mute', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const room = await Room.findOne({ roomId: data.roomId });
      if (!room) return;
      if (room.admin !== user.username && !room.moderators?.includes(user.username)) return;
      if (data.muted) {
        await Room.updateOne({ roomId: data.roomId }, { $addToSet: { muted: data.username } });
      } else {
        await Room.updateOne({ roomId: data.roomId }, { $pull: { muted: data.username } });
      }
      const action = data.muted ? 'замутил' : 'размутил';
      const sysMsg = await saveMessage({ type: 'system', content: `${user.displayName} ${action} ${data.username}`, room: data.roomId });
      io.to(data.roomId).emit('message:new', sysMsg);
    } catch (err) { console.error('Mute error:', err); }
  });

  // ========== ЛС ==========
  socket.on('dm:start', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      // Проверка блокировки
      const targetUser = await User.findOne({ username: data.username });
      if (targetUser?.blockedUsers?.includes(user.username)) {
        socket.emit('error:message', { text: 'Пользователь вас заблокировал' }); return;
      }
      let existing = await Room.findOne({ type: 'direct', members: { $all: [user.username, data.username] } });
      if (existing) {
        socket.join(existing.roomId);
        const msgs = await Message.find({ room: existing.roomId }).sort({ timestamp: -1 }).limit(100).lean();
        socket.emit('dm:opened', { room: formatRoom(existing), messages: msgs.reverse() });
        return;
      }
      const roomId = uuidv4();
      const room = await Room.create({
        roomId, name: `${user.displayName} & ${targetUser?.displayName || data.username}`,
        type: 'direct', members: [user.username, data.username]
      });
      socket.join(roomId);
      const ts = findSocketByUsername(data.username);
      if (ts) { ts.join(roomId); ts.emit('room:created', formatRoom(room)); }
      socket.emit('dm:opened', { room: formatRoom(room), messages: [] });
    } catch (err) { console.error('DM error:', err); }
  });

  // ========== ОПРОСЫ ==========
  socket.on('poll:create', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const pollId = uuidv4();
      const poll = await Poll.create({
        pollId, question: data.question,
        options: data.options.map(o => ({ text: o, votes: [] })),
        room: data.room, creator: user.username,
        multipleChoice: data.multipleChoice || false,
        anonymous: data.anonymous || false
      });
      const msg = await saveMessage({
        type: 'poll', content: `📊 ${data.question}`,
        room: data.room, sender: { username: user.username, displayName: user.displayName, avatar: user.avatar, avatarColor: user.avatarColor },
        pollData: { pollId, question: data.question, options: poll.options, multipleChoice: data.multipleChoice, anonymous: data.anonymous, creator: user.username }
      });
      io.to(data.room).emit('message:new', msg);
    } catch (err) { console.error('Poll create error:', err); }
  });

  socket.on('poll:vote', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const poll = await Poll.findOne({ pollId: data.pollId });
      if (!poll || poll.closed) return;
      // Убираем предыдущие голоса если не multiple choice
      if (!poll.multipleChoice) {
        poll.options.forEach(o => {
          o.votes = o.votes.filter(v => v !== user.username);
        });
      }
      const option = poll.options[data.optionIndex];
      if (!option) return;
      const voteIdx = option.votes.indexOf(user.username);
      if (voteIdx > -1) option.votes.splice(voteIdx, 1);
      else option.votes.push(user.username);
      poll.markModified('options');
      await poll.save();
      io.to(poll.room).emit('poll:updated', {
        pollId: data.pollId, options: poll.options, room: poll.room
      });
    } catch (err) { console.error('Poll vote error:', err); }
  });

  // ========== МИНИ-ИГРЫ ==========
  // Крестики-нолики
  socket.on('game:tictactoe:start', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    const gameId = uuidv4();
    const game = {
      id: gameId, type: 'tictactoe',
      board: Array(9).fill(null),
      players: { X: user.username, O: data.opponent },
      currentTurn: 'X', winner: null, room: data.room
    };
    activeGames.set(gameId, game);
    const msg = await saveMessage({
      type: 'game', content: `🎮 ${user.displayName} приглашает в крестики-нолики!`,
      room: data.room, sender: { username: user.username, displayName: user.displayName, avatar: user.avatar, avatarColor: user.avatarColor },
      gameData: game
    });
    io.to(data.room).emit('message:new', msg);
  });

  socket.on('game:tictactoe:move', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    const game = activeGames.get(data.gameId);
    if (!game) return;
    const symbol = game.players.X === user.username ? 'X' : 'O';
    if (game.currentTurn !== symbol || game.winner) return;
    if (game.board[data.position] !== null) return;
    game.board[data.position] = symbol;
    game.winner = checkTicTacToeWinner(game.board);
    game.currentTurn = symbol === 'X' ? 'O' : 'X';
    if (!game.board.includes(null) && !game.winner) game.winner = 'draw';
    io.to(game.room).emit('game:tictactoe:updated', game);
  });

  // Камень-ножницы-бумага
  socket.on('game:rps:start', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    const gameId = uuidv4();
    const game = {
      id: gameId, type: 'rps',
      players: { [user.username]: null, [data.opponent]: null },
      playerNames: { [user.username]: user.displayName },
      winner: null, room: data.room
    };
    activeGames.set(gameId, game);
    const msg = await saveMessage({
      type: 'game', content: `🎮 ${user.displayName} приглашает в Камень-Ножницы-Бумага!`,
      room: data.room, sender: { username: user.username, displayName: user.displayName, avatar: user.avatar, avatarColor: user.avatarColor },
      gameData: { gameId, type: 'rps', players: Object.keys(game.players) }
    });
    io.to(data.room).emit('message:new', msg);
  });

  socket.on('game:rps:choose', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    const game = activeGames.get(data.gameId);
    if (!game || game.winner) return;
    if (!(user.username in game.players)) return;
    game.players[user.username] = data.choice;
    game.playerNames[user.username] = user.displayName;
    const choices = Object.values(game.players);
    if (choices.every(c => c !== null)) {
      const players = Object.keys(game.players);
      game.winner = getRPSWinner(game.players[players[0]], game.players[players[1]], players[0], players[1]);
      io.to(game.room).emit('game:rps:result', game);
    } else {
      socket.emit('game:rps:waiting', { gameId: data.gameId });
    }
  });

  // Кубик
  socket.on('game:dice', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    const result = Math.floor(Math.random() * 6) + 1;
    const diceEmojis = ['⚀','⚁','⚂','⚃','⚄','⚅'];
    const msg = await saveMessage({
      type: 'text', content: `🎲 ${user.displayName} бросил кубик: ${diceEmojis[result-1]} ${result}!`,
      room: data.room, sender: { username: user.username, displayName: user.displayName, avatar: user.avatar, avatarColor: user.avatarColor },
      sendSound: 'default'
    });
    io.to(data.room).emit('message:new', msg);
  });

  // ========== СТАТИСТИКА ==========
  socket.on('stats:get', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    try {
      const totalMsgs = await Message.countDocuments({ room: data.room, type: { $ne: 'system' } });
      const topSenders = await Message.aggregate([
        { $match: { room: data.room, type: { $ne: 'system' } } },
        { $group: { _id: '$sender.displayName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      const room = await Room.findOne({ roomId: data.room });
      socket.emit('stats:data', {
        totalMessages: totalMsgs,
        totalMembers: room?.members?.length || 0,
        topSenders: topSenders.map(s => ({ name: s._id, count: s.count })),
        room: data.room
      });
    } catch (err) { console.error('Stats error:', err); }
  });

  // ========== СТАТУС АКТИВНОСТИ ==========
  socket.on('activity:set', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    user.activityStatus = data.activity;
    await User.updateOne({ username: user.username }, { activityStatus: data.activity });
    io.emit('users:update', getOnlineUsersList());
  });

  // ========== ОТКЛЮЧЕНИЕ ==========
  socket.on('disconnect', async () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      await User.updateOne({ username: user.username }, { status: 'offline', lastSeen: new Date() });
      if (!user.invisible) {
        const sysMsg = await saveMessage({ type: 'system', content: `${user.displayName} покинул чат`, room: 'general' });
        io.to('general').emit('message:new', sysMsg);
      }
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
    messageId: uuidv4(), type: data.type || 'text',
    content: data.content,
    sender: data.sender || { username: 'system', displayName: 'Система' },
    room: data.room, sendSound: data.sendSound,
    replyTo: data.replyTo, file: data.file,
    duration: data.duration, reactions: {},
    readBy: [], edited: false, pinned: false,
    forwarded: data.forwarded || false,
    forwardedFrom: data.forwardedFrom || null,
    expiresAt: data.expiresAt || null,
    pollData: data.pollData, gameData: data.gameData,
    timestamp: new Date()
  };
  try { await Message.create(msg); } catch (err) { console.error('Save msg error:', err); }
  return msg;
}

function formatRoom(r) {
  return {
    id: r.roomId, name: r.name, type: r.type,
    members: r.members, admin: r.admin,
    moderators: r.moderators || [],
    banned: r.banned || [], muted: r.muted || [],
    description: r.description, avatar: r.avatar,
    pinnedMessage: r.pinnedMessage,
    inviteCode: r.inviteCode,
    isSecret: r.isSecret, slowMode: r.slowMode || 0
  };
}

function getOnlineUsersList() {
  return Array.from(onlineUsers.values())
    .filter(u => !u.invisible)
    .map(u => ({
      username: u.username, displayName: u.displayName,
      avatar: u.avatar, avatarColor: u.avatarColor,
      bio: u.bio, status: u.status,
      statusText: u.statusText, activityStatus: u.activityStatus,
      lastSeen: u.lastSeen, doNotDisturb: u.doNotDisturb
    }));
}

function getOnlineUser(username) {
  for (const [, u] of onlineUsers) {
    if (u.username === username) return u;
  }
  return null;
}

function findSocketByUsername(username) {
  for (const [sid, u] of onlineUsers) {
    if (u.username === username) return io.sockets.sockets.get(sid);
  }
  return null;
}

function getRandomColor() {
  const colors = ['#6c5ce7','#00cec9','#e17055','#00b894','#fdcb6e','#ff7675','#a29bfe','#55efc4','#fab1a0','#74b9ff','#fd79a8','#636e72'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function checkTicTacToeWinner(board) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function getRPSWinner(c1, c2, p1, p2) {
  if (c1 === c2) return 'draw';
  const wins = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
  return wins[c1] === c2 ? p1 : p2;
}

// ============================================
// ЗАПУСК
// ============================================
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   🚀 PULSE MESSENGER v2.0 ULTIMATE ║
  ║   Порт: ${PORT}                        ║
  ╚══════════════════════════════════════╝
  `);
});