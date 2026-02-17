// ============================================
// PULSE MESSENGER — Клиент v1.1
// Исправлены баги + новые фичи
// ============================================

class PulseMessenger {
  constructor() {
    this.socket = null;
    this.user = null;
    this.currentRoom = 'general';
    this.selectedSound = 'default';
    this.replyingTo = null;
    this.typingTimeout = null;
    this.rooms = new Map();
    this.onlineUsers = [];
    this.isJoiningRoom = false; // ← ФИКС мерцания

    this.soundMap = {
      default:  { name: 'Обычный',        emoji: '🔔', color: '#6c5ce7' },
      birthday: { name: 'День рождения',  emoji: '🎂', color: '#fdcb6e' },
      funny:    { name: 'Смешной',        emoji: '😂', color: '#00b894' },
      urgent:   { name: 'Срочно!',        emoji: '🚨', color: '#ff7675' },
      romantic: { name: 'Романтика',      emoji: '❤️', color: '#e17055' },
      applause: { name: 'Аплодисменты',   emoji: '👏', color: '#00cec9' },
      none:     { name: 'Без звука',      emoji: '🔇', color: '#636e72' }
    };

    this.emojis = [
      '😀','😂','🤣','😊','😍','🥰','😘','😎',
      '🤔','😏','😢','😭','😡','🤯','🥳','🤩',
      '👍','👎','👋','🤝','💪','🙏','❤️','🔥',
      '⭐','🎉','🎂','🎈','🎁','🏆','💎','🌟',
      '✅','❌','⚡','💬','📱','🎵','🎸','🎮',
      '🍕','🍔','☕','🍺','🌮','🍰','🍭','🫡',
      '👀','💀','🗿','🐸','🦄','🐱','🐶','🦊'
    ];

    this.audioContext = null;
    this.init();
  }

  // ============================================
  // ИНИЦИАЛИЗАЦИЯ
  // ============================================
  init() {
    this.bindLoginEvents();
    this.bindChatEvents();
    this.bindSoundSelector();
    this.bindEmojiPicker();
    this.bindFileUpload();
    this.buildEmojiGrid();
  }

  // ============================================
  // АУДИО
  // ============================================
  getAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  playSound(soundType) {
    if (soundType === 'none') return;
    try {
      const ctx = this.getAudioContext();
      switch (soundType) {
        case 'default':
          this.playTone(ctx, [800], [0.1], 'sine');
          break;
        case 'birthday':
          this.playMelody(ctx, [523, 523, 587, 523, 698, 659], [0.2, 0.2, 0.4, 0.4, 0.4, 0.8]);
          break;
        case 'funny':
          this.playTone(ctx, [300, 600, 200, 800], [0.1, 0.1, 0.1, 0.15], 'square');
          break;
        case 'urgent':
          this.playTone(ctx, [880, 0, 880, 0, 880], [0.15, 0.05, 0.15, 0.05, 0.3], 'sawtooth');
          break;
        case 'romantic':
          this.playMelody(ctx, [523, 659, 784, 1047], [0.3, 0.3, 0.3, 0.6]);
          break;
        case 'applause':
          this.playNoise(ctx, 1.0);
          break;
      }
    } catch (e) {
      console.log('Audio error:', e);
    }
  }

  playTone(ctx, frequencies, durations, type = 'sine') {
    let startTime = ctx.currentTime;
    frequencies.forEach((freq, i) => {
      if (freq === 0) { startTime += durations[i]; return; }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + durations[i]);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + durations[i]);
      startTime += durations[i];
    });
  }

  playMelody(ctx, notes, durations) {
    let startTime = ctx.currentTime;
    notes.forEach((note, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note;
      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + durations[i] * 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + durations[i]);
      startTime += durations[i];
    });
  }

  playNoise(ctx, duration) {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.05;
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  // ============================================
  // ВХОД
  // ============================================
  bindLoginEvents() {
    const form = document.getElementById('login-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('username-input').value.trim();
      const displayName = document.getElementById('displayname-input').value.trim();
      if (!username) return;
      this.connect(username, displayName || username);
    });
  }

  // ============================================
  // ПОДКЛЮЧЕНИЕ
  // ============================================
  connect(username, displayName) {
    this.socket = io(window.location.origin);

    this.socket.on('connect', () => {
      console.log('🟢 Подключено');
      this.socket.emit('user:join', { username, displayName });
    });

    // Успешный вход
    this.socket.on('user:joined', (data) => {
      this.user = data.user;
      this.onlineUsers = data.onlineUsers || [];
      this.showMainScreen();
      this.updateMyProfile();

      data.rooms.forEach(room => {
        this.rooms.set(room.id, room);
      });
      this.renderChatList();
      this.renderUsersList();

      // Загрузка сообщений общего чата
      data.messages.forEach(msg => this.renderMessage(msg));
      this.scrollToBottom();
    });

    // Новое сообщение
    this.socket.on('message:new', (message) => {
      if (message.room === this.currentRoom) {
        this.renderMessage(message);
        this.scrollToBottom();
      }

      // Звук
      if (message.sender.id !== this.socket.id && message.type !== 'system') {
        if (message.sendSound && message.sendSound !== 'default' && message.sendSound !== 'none') {
          this.playSound(message.sendSound);
          this.showSoundNotification(message.sendSound);
        } else if (message.sendSound !== 'none') {
          this.playSound('default');
        }
      }

      // Обновляем последнее сообщение в списке чатов
      this.updateChatListLastMessage(message);
    });

    // Сообщение удалено
    this.socket.on('message:deleted', (data) => {
      if (data.room === this.currentRoom) {
        const msgEl = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (msgEl) {
          msgEl.style.animation = 'fadeOut 0.3s ease';
          setTimeout(() => msgEl.remove(), 300);
        }
      }
    });

    // Чат очищен
    this.socket.on('chat:cleared', (data) => {
      if (data.room === this.currentRoom) {
        document.getElementById('messages-list').innerHTML = '';
      }
    });

    // Группа удалена
    this.socket.on('room:deleted', (data) => {
      this.rooms.delete(data.roomId);
      if (this.currentRoom === data.roomId) {
        this.switchRoom('general');
      }
      this.renderChatList();
      this.showNotification(`Группа "${data.roomName}" удалена`);
    });

    // Обновление пользователей
    this.socket.on('users:update', (users) => {
      this.onlineUsers = users;
      this.renderUsersList();
      this.updateChatSubtitle();
    });

    // Печатает
    this.socket.on('typing:update', (data) => {
      if (data.room === this.currentRoom) {
        const indicator = document.getElementById('typing-indicator');
        const text = document.getElementById('typing-text');
        if (data.isTyping) {
          text.textContent = `${data.username} печатает...`;
          indicator.style.display = 'flex';
        } else {
          indicator.style.display = 'none';
        }
      }
    });

    // Реакции
    this.socket.on('message:reacted', (data) => {
      if (data.room === this.currentRoom) {
        this.updateMessageReactions(data.messageId, data.reactions);
      }
    });

    // Новая комната
    this.socket.on('room:created', (room) => {
      this.rooms.set(room.id, room);
      this.renderChatList();
    });

    // Присоединение к комнате — ФИКС МЕРЦАНИЯ
    this.socket.on('room:joined', (data) => {
      if (!this.isJoiningRoom) return; // Игнорируем если не мы инициировали

      this.rooms.set(data.room.id, data.room);

      // Очищаем и загружаем сообщения
      document.getElementById('messages-list').innerHTML = '';
      data.messages.forEach(msg => this.renderMessage(msg));
      this.scrollToBottom();

      this.isJoiningRoom = false;
    });

    // ЛС
    this.socket.on('dm:opened', (data) => {
      this.rooms.set(data.room.id, data.room);
      this.renderChatList();
      this.currentRoom = data.room.id;
      this.updateChatHeader(data.room);

      document.getElementById('messages-list').innerHTML = '';
      data.messages.forEach(msg => this.renderMessage(msg));
      this.scrollToBottom();
      this.renderChatList();
    });

    // Ошибки
    this.socket.on('error:message', (data) => {
      this.showNotification(data.text, 'error');
    });

    this.socket.on('disconnect', () => {
      console.log('🔴 Отключено');
    });
  }

  // ============================================
  // ИНТЕРФЕЙС
  // ============================================
  showMainScreen() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
  }

  updateMyProfile() {
    document.getElementById('my-name').textContent = this.user.displayName;
    document.getElementById('my-status').textContent = 'В сети';
  }

  // ============================================
  // СОБЫТИЯ ЧАТА
  // ============================================
  bindChatEvents() {
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('btn-send');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    sendBtn.addEventListener('click', () => this.sendMessage());

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      this.emitTyping();
    });

    // Создание группы
    document.getElementById('btn-new-group').addEventListener('click', () => {
      this.showGroupModal();
    });

    document.getElementById('btn-close-modal').addEventListener('click', () => {
      document.getElementById('modal-new-group').style.display = 'none';
    });

    document.getElementById('btn-cancel-group').addEventListener('click', () => {
      document.getElementById('modal-new-group').style.display = 'none';
    });

    document.getElementById('btn-create-group').addEventListener('click', () => {
      this.createGroup();
    });

    // Отмена ответа
    document.getElementById('btn-cancel-reply').addEventListener('click', () => {
      this.cancelReply();
    });
  }

  // ============================================
  // ОТПРАВКА
  // ============================================
  sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();

    if (!content && !this.pendingFile) return;

    const messageData = {
      type: this.pendingFile ? 'file' : 'text',
      content: content,
      room: this.currentRoom,
      sendSound: this.selectedSound,
      replyTo: this.replyingTo,
      file: this.pendingFile || null
    };

    this.socket.emit('message:send', messageData);

    input.value = '';
    input.style.height = 'auto';
    this.pendingFile = null;
    this.cancelReply();
    this.socket.emit('typing:stop', { room: this.currentRoom });
  }

  // ============================================
  // УДАЛЕНИЕ СООБЩЕНИЯ
  // ============================================
  deleteMessage(messageId) {
    if (!confirm('Удалить сообщение?')) return;

    this.socket.emit('message:delete', {
      messageId: messageId,
      room: this.currentRoom
    });
  }

  // ============================================
  // ОЧИСТКА ЧАТА
  // ============================================
  clearChat() {
    if (!confirm('Очистить всю историю чата?')) return;

    this.socket.emit('chat:clear', {
      room: this.currentRoom
    });
  }

  // ============================================
  // УДАЛЕНИЕ ГРУППЫ
  // ============================================
  deleteRoom() {
    if (this.currentRoom === 'general') {
      this.showNotification('Общий чат нельзя удалить', 'error');
      return;
    }

    if (!confirm('Удалить эту группу? Это действие нельзя отменить!')) return;

    this.socket.emit('room:delete', {
      roomId: this.currentRoom
    });
  }

  // ============================================
  // РЕНДЕР СООБЩЕНИЙ
  // ============================================
  renderMessage(message) {
    const container = document.getElementById('messages-list');

    if (message.type === 'system') {
      const sysDiv = document.createElement('div');
      sysDiv.className = 'system-message';
      sysDiv.textContent = message.content;
      container.appendChild(sysDiv);
      return;
    }

    const isOwn = message.sender.username === this.user?.username;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isOwn ? 'own' : ''}`;
    msgDiv.dataset.messageId = message.id;

    const avatarHTML = isOwn ? '' : `
      <div class="avatar-small">
        ${message.sender.displayName?.charAt(0).toUpperCase() || '?'}
      </div>
    `;

    // Звук
    let soundBadgeHTML = '';
    if (message.sendSound && message.sendSound !== 'default' && message.sendSound !== 'none') {
      const soundInfo = this.soundMap[message.sendSound];
      soundBadgeHTML = `
        <div class="message-sound-badge" onclick="app.playSound('${message.sendSound}')"
             title="Нажми, чтобы послушать">
          <i class="fas fa-music"></i> ${soundInfo.emoji} ${soundInfo.name}
        </div>
      `;
    }

    // Файл
    let fileHTML = '';
    if (message.file) {
      if (message.file.mimetype?.startsWith('image/')) {
        fileHTML = `<img src="${message.file.url}" class="message-image" alt="image">`;
      } else {
        fileHTML = `
          <div class="message-file">
            <i class="fas fa-file"></i>
            <div class="message-file-info">
              <div class="message-file-name">${message.file.originalName}</div>
              <div class="message-file-size">${this.formatSize(message.file.size)}</div>
            </div>
            <a href="${message.file.url}" download class="btn-icon btn-small">
              <i class="fas fa-download"></i>
            </a>
          </div>
        `;
      }
    }

    // Ответ
    let replyHTML = '';
    if (message.replyTo) {
      replyHTML = `
        <div class="reply-preview" style="margin-bottom: 6px; padding: 6px 10px;">
          <div class="reply-content">
            <i class="fas fa-reply"></i>
            <span>${message.replyTo.content?.substring(0, 50)}...</span>
          </div>
        </div>
      `;
    }

    const reactionsHTML = this.renderReactions(message.id, message.reactions);

    const time = new Date(message.timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Кнопка удаления (только свои сообщения)
    const deleteBtn = isOwn ? `
      <button class="btn-delete-msg" onclick="app.deleteMessage('${message.id}')" title="Удалить">
        <i class="fas fa-trash"></i>
      </button>
    ` : '';

    msgDiv.innerHTML = `
      ${avatarHTML}
      <div class="message-bubble">
        ${!isOwn ? `<div class="message-sender">${message.sender.displayName}</div>` : ''}
        ${soundBadgeHTML}
        ${replyHTML}
        ${message.content ? `<div class="message-text">${this.escapeHTML(message.content)}</div>` : ''}
        ${fileHTML}
        ${reactionsHTML}
        <div class="message-footer">
          <span class="message-time">${time}</span>
          ${deleteBtn}
        </div>

        <div class="reaction-picker">
          <span onclick="app.react('${message.id}', '❤️')">❤️</span>
          <span onclick="app.react('${message.id}', '😂')">😂</span>
          <span onclick="app.react('${message.id}', '👍')">👍</span>
          <span onclick="app.react('${message.id}', '😮')">😮</span>
          <span onclick="app.react('${message.id}', '😢')">😢</span>
          <span onclick="app.react('${message.id}', '🔥')">🔥</span>
        </div>
      </div>
    `;

    container.appendChild(msgDiv);
  }

  renderReactions(messageId, reactions) {
    if (!reactions || Object.keys(reactions).length === 0) return '';
    let html = '<div class="message-reactions">';
    for (const [emoji, users] of Object.entries(reactions)) {
      const isOwn = users.includes(this.user?.username);
      html += `
        <div class="reaction ${isOwn ? 'own' : ''}" onclick="app.react('${messageId}', '${emoji}')">
          ${emoji} <span class="reaction-count">${users.length}</span>
        </div>
      `;
    }
    html += '</div>';
    return html;
  }

  updateMessageReactions(messageId, reactions) {
    const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!msgEl) return;
    const existingReactions = msgEl.querySelector('.message-reactions');
    const newReactionsHTML = this.renderReactions(messageId, reactions);
    if (existingReactions) {
      existingReactions.outerHTML = newReactionsHTML;
    } else {
      const bubble = msgEl.querySelector('.message-bubble');
      const footer = bubble.querySelector('.message-footer');
      footer.insertAdjacentHTML('beforebegin', newReactionsHTML);
    }
  }

  react(messageId, emoji) {
    this.socket.emit('message:react', {
      messageId,
      emoji,
      room: this.currentRoom
    });
  }

  // ============================================
  // СПИСОК ЧАТОВ — ФИКС МЕРЦАНИЯ
  // ============================================
  renderChatList() {
    const container = document.getElementById('chat-list');
    container.innerHTML = '';

    this.rooms.forEach((room) => {
      const item = document.createElement('div');
      item.className = `chat-item ${room.id === this.currentRoom ? 'active' : ''}`;

      const initial = room.name.replace(/[^\w\u0400-\u04FF]/g, '').charAt(0).toUpperCase() || '💬';

      // Считаем онлайн участников
      const onlineCount = this.getOnlineCountForRoom(room);

      item.innerHTML = `
        <div class="avatar-small">${initial}</div>
        <div class="chat-item-info">
          <div class="chat-item-name">${room.name}</div>
          <div class="chat-item-last">
            ${room.type === 'direct' ? 'Личные сообщения' : `👥 ${onlineCount} в сети`}
          </div>
        </div>
      `;

      item.addEventListener('click', () => {
        if (this.currentRoom === room.id) return; // ← ФИКС! Не переключаем если уже тут
        this.switchRoom(room.id);
      });

      container.appendChild(item);
    });
  }

  getOnlineCountForRoom(room) {
    const onlineUsernames = this.onlineUsers.map(u => u.username);
    return room.members.filter(m => onlineUsernames.includes(m)).length;
  }

  switchRoom(roomId) {
    if (this.isJoiningRoom) return; // ← ФИКС! Предотвращаем множественные переключения

    this.currentRoom = roomId;
    this.isJoiningRoom = true;

    const room = this.rooms.get(roomId);
    this.updateChatHeader(room);

    // Очищаем сообщения
    document.getElementById('messages-list').innerHTML = '';

    // Присоединяемся к комнате
    this.socket.emit('room:join', { roomId });

    // Обновляем список чатов
    this.renderChatList();

    // Таймаут на случай если сервер не ответит
    setTimeout(() => {
      this.isJoiningRoom = false;
    }, 3000);
  }

  updateChatHeader(room) {
    if (!room) return;
    document.getElementById('chat-name').textContent = room.name;
    this.updateChatSubtitle();
  }

  updateChatSubtitle() {
    const room = this.rooms.get(this.currentRoom);
    if (!room) return;

    const subtitle = document.getElementById('chat-subtitle');
    if (room.type === 'direct') {
      // Проверяем онлайн ли собеседник
      const otherUser = room.members.find(m => m !== this.user?.username);
      const isOnline = this.onlineUsers.some(u => u.username === otherUser);
      subtitle.textContent = isOnline ? '🟢 В сети' : '⚫ Не в сети';
    } else {
      const onlineCount = this.getOnlineCountForRoom(room);
      subtitle.textContent = `👥 ${onlineCount} из ${room.members.length} в сети`;
    }
  }

  updateChatListLastMessage(message) {
    // Обновляем превью последнего сообщения в списке чатов
    this.renderChatList();
  }

  // ============================================
  // СПИСОК ПОЛЬЗОВАТЕЛЕЙ (только онлайн!)
  // ============================================
  renderUsersList() {
    const container = document.getElementById('users-list');
    container.innerHTML = '';

    // Заголовок с количеством
    const header = document.querySelector('.panel-header h3');
    if (header) {
      header.textContent = `👥 В сети (${this.onlineUsers.length})`;
    }

    this.onlineUsers.forEach((user) => {
      const item = document.createElement('div');
      item.className = 'user-item';

      const initial = user.displayName.charAt(0).toUpperCase();
      const isMe = user.username === this.user?.username;

      item.innerHTML = `
        <div class="avatar-small" style="position: relative;">
          ${initial}
          <div class="online-dot"></div>
        </div>
        <div class="user-item-info">
          <div class="user-item-name">${user.displayName} ${isMe ? '(вы)' : ''}</div>
          <div class="user-item-status">${user.statusText || '🟢 В сети'}</div>
        </div>
      `;

      // Клик — ЛС (не с собой)
      if (!isMe) {
        item.addEventListener('click', () => {
          this.socket.emit('dm:start', { username: user.username });
        });
        item.title = `Написать ${user.displayName}`;
        item.style.cursor = 'pointer';
      }

      container.appendChild(item);
    });
  }

  // ============================================
  // ЗВУК
  // ============================================
  bindSoundSelector() {
    const btn = document.getElementById('btn-sound');
    const dropdown = document.getElementById('sound-dropdown');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    document.querySelectorAll('.sound-option').forEach(option => {
      option.addEventListener('click', (e) => {
        if (e.target.closest('.btn-play')) return;
        const sound = option.dataset.sound;
        this.selectedSound = sound;
        document.querySelectorAll('.sound-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        btn.classList.toggle('has-sound', sound !== 'default');
        dropdown.classList.remove('show');
      });
    });

    document.querySelectorAll('.btn-play').forEach(playBtn => {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playSound(playBtn.dataset.sound);
      });
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('show');
    });
  }

  showSoundNotification(soundType) {
    const soundInfo = this.soundMap[soundType];
    if (!soundInfo) return;

    const notif = document.getElementById('sound-notification');
    const text = document.getElementById('sound-notif-text');
    text.textContent = `${soundInfo.emoji} ${soundInfo.name}!`;
    notif.style.display = 'block';
    setTimeout(() => { notif.style.display = 'none'; }, 3000);
  }

  showNotification(text, type = 'info') {
    const notif = document.getElementById('sound-notification');
    const notifText = document.getElementById('sound-notif-text');
    notifText.textContent = text;
    notif.style.display = 'block';
    setTimeout(() => { notif.style.display = 'none'; }, 3000);
  }

  // ============================================
  // ЭМОДЗИ
  // ============================================
  bindEmojiPicker() {
    const btn = document.getElementById('btn-emoji');
    const picker = document.getElementById('emoji-picker');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', () => {
      picker.style.display = 'none';
    });

    picker.addEventListener('click', (e) => e.stopPropagation());
  }

  buildEmojiGrid() {
    const grid = document.querySelector('.emoji-grid');
    if (!grid) return;
    this.emojis.forEach(emoji => {
      const span = document.createElement('span');
      span.textContent = emoji;
      span.addEventListener('click', () => {
        const input = document.getElementById('message-input');
        input.value += emoji;
        input.focus();
      });
      grid.appendChild(span);
    });
  }

  // ============================================
  // ФАЙЛЫ
  // ============================================
  bindFileUpload() {
    const btn = document.getElementById('btn-attach');
    const fileInput = document.getElementById('file-input');

    btn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const fileInfo = await response.json();

        this.socket.emit('message:send', {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          content: '',
          room: this.currentRoom,
          sendSound: this.selectedSound,
          file: fileInfo
        });
      } catch (err) {
        console.error('Ошибка загрузки:', err);
        this.showNotification('Ошибка загрузки файла', 'error');
      }

      fileInput.value = '';
    });
  }

  // ============================================
  // ГРУППЫ
  // ============================================
  showGroupModal() {
    const modal = document.getElementById('modal-new-group');
    const membersContainer = document.getElementById('members-select');
    membersContainer.innerHTML = '';

    this.onlineUsers.forEach(user => {
      if (user.username === this.user?.username) return;
      const option = document.createElement('label');
      option.className = 'member-option';
      option.innerHTML = `
        <input type="checkbox" value="${user.username}">
        <div class="avatar-small" style="width:32px;height:32px;font-size:13px;">
          ${user.displayName.charAt(0).toUpperCase()}
        </div>
        <span>${user.displayName}</span>
      `;
      membersContainer.appendChild(option);
    });

    modal.style.display = 'flex';
  }

  createGroup() {
    const name = document.getElementById('group-name-input').value.trim();
    if (!name) {
      this.showNotification('Введите название группы', 'error');
      return;
    }

    const checkboxes = document.querySelectorAll('#members-select input:checked');
    const members = Array.from(checkboxes).map(cb => cb.value);

    this.socket.emit('room:create', { name, type: 'group', members });

    document.getElementById('modal-new-group').style.display = 'none';
    document.getElementById('group-name-input').value = '';
  }

  // ============================================
  // ОТВЕТ
  // ============================================
  setReply(messageId, content) {
    this.replyingTo = { id: messageId, content };
    document.getElementById('reply-preview').style.display = 'flex';
    document.getElementById('reply-text').textContent = content.substring(0, 50);
    document.getElementById('message-input').focus();
  }

  cancelReply() {
    this.replyingTo = null;
    document.getElementById('reply-preview').style.display = 'none';
  }

  // ============================================
  // ПЕЧАТАЕТ
  // ============================================
  emitTyping() {
    if (!this.socket) return;
    this.socket.emit('typing:start', { room: this.currentRoom });
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.socket.emit('typing:stop', { room: this.currentRoom });
    }, 2000);
  }

  // ============================================
  // УТИЛИТЫ
  // ============================================
  scrollToBottom() {
    const container = document.getElementById('messages-container');
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
  }

  escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  }
}

// ============================================
// ЗАПУСК
// ============================================
const app = new PulseMessenger();