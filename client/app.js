// ============================================
// PULSE MESSENGER — Клиент v1.2
// + Прочитано/непрочитано
// + Голосовые сообщения
// + Уведомления
// + Поиск
// + Профили
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
    this.isJoiningRoom = false;
    this.unreadCounts = {};
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recordingTimer = null;
    this.recordingSeconds = 0;
    this.notificationsEnabled = false;

    this.soundMap = {
      default:  { name: 'Обычный',        emoji: '🔔' },
      birthday: { name: 'День рождения',  emoji: '🎂' },
      funny:    { name: 'Смешной',        emoji: '😂' },
      urgent:   { name: 'Срочно!',        emoji: '🚨' },
      romantic: { name: 'Романтика',      emoji: '❤️' },
      applause: { name: 'Аплодисменты',   emoji: '👏' },
      none:     { name: 'Без звука',      emoji: '🔇' }
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

  init() {
    this.bindLoginEvents();
    this.bindChatEvents();
    this.bindSoundSelector();
    this.bindEmojiPicker();
    this.bindFileUpload();
    this.bindVoiceRecording();
    this.bindSearch();
    this.buildEmojiGrid();
    this.requestNotificationPermission();
  }

  // ============================================
  // УВЕДОМЛЕНИЯ В БРАУЗЕРЕ
  // ============================================
  requestNotificationPermission() {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        this.notificationsEnabled = true;
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          this.notificationsEnabled = permission === 'granted';
        });
      }
    }
  }

  showBrowserNotification(title, body, icon) {
    if (!this.notificationsEnabled) return;
    if (document.hasFocus()) return;

    try {
      const notif = new Notification(title, {
        body: body,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'pulse-message',
        renotify: true
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      setTimeout(() => notif.close(), 5000);
    } catch (e) {
      console.log('Notification error:', e);
    }
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
          this.playTone(ctx, [800], [0.1], 'sine'); break;
        case 'birthday':
          this.playMelody(ctx, [523, 523, 587, 523, 698, 659], [0.2, 0.2, 0.4, 0.4, 0.4, 0.8]); break;
        case 'funny':
          this.playTone(ctx, [300, 600, 200, 800], [0.1, 0.1, 0.1, 0.15], 'square'); break;
        case 'urgent':
          this.playTone(ctx, [880, 0, 880, 0, 880], [0.15, 0.05, 0.15, 0.05, 0.3], 'sawtooth'); break;
        case 'romantic':
          this.playMelody(ctx, [523, 659, 784, 1047], [0.3, 0.3, 0.3, 0.6]); break;
        case 'applause':
          this.playNoise(ctx, 1.0); break;
      }
    } catch (e) { console.log('Audio error:', e); }
  }

  playTone(ctx, frequencies, durations, type = 'sine') {
    let t = ctx.currentTime;
    frequencies.forEach((freq, i) => {
      if (freq === 0) { t += durations[i]; return; }
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + durations[i]);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + durations[i]);
      t += durations[i];
    });
  }

  playMelody(ctx, notes, durations) {
    let t = ctx.currentTime;
    notes.forEach((n, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = n;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + durations[i] * 0.9);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + durations[i]);
      t += durations[i];
    });
  }

  playNoise(ctx, dur) {
    const sz = ctx.sampleRate * dur, buf = ctx.createBuffer(1, sz, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < sz; i++) d[i] = (Math.random() * 2 - 1) * 0.05;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = buf;
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    s.connect(g); g.connect(ctx.destination); s.start();
  }

  // ============================================
  // ВХОД
  // ============================================
  bindLoginEvents() {
    document.getElementById('login-form').addEventListener('submit', (e) => {
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

    this.socket.on('user:joined', (data) => {
      this.user = data.user;
      this.onlineUsers = data.onlineUsers || [];
      this.unreadCounts = data.unreadCounts || {};
      this.showMainScreen();
      this.updateMyProfile();

      data.rooms.forEach(room => this.rooms.set(room.id, room));
      this.renderChatList();
      this.renderUsersList();

      data.messages.forEach(msg => this.renderMessage(msg));
      this.scrollToBottom();

      // Помечаем общий чат как прочитанный
      this.markAsRead('general');
    });

    this.socket.on('message:new', (message) => {
      if (message.room === this.currentRoom) {
        this.renderMessage(message);
        this.scrollToBottom();
        // Помечаем как прочитанное если мы в этом чате
        if (message.sender.username !== this.user?.username) {
          this.markAsRead(message.room);
        }
      }

      // Звук + уведомление
      if (message.sender.username !== this.user?.username && message.type !== 'system') {
        if (message.sendSound && message.sendSound !== 'default' && message.sendSound !== 'none') {
          this.playSound(message.sendSound);
          this.showSoundNotification(message.sendSound);
        } else if (message.sendSound !== 'none') {
          this.playSound('default');
        }

        // Браузерное уведомление
        this.showBrowserNotification(
          message.sender.displayName,
          message.type === 'voice' ? '🎤 Голосовое сообщение' : (message.content || '📎 Файл'),
        );
      }

      this.renderChatList();
    });

    // Счётчик непрочитанных
    this.socket.on('unread:update', (data) => {
      if (data.room !== this.currentRoom) {
        this.unreadCounts[data.room] = data.count;
        this.renderChatList();
      }
    });

    // Прочитано
    this.socket.on('messages:were-read', (data) => {
      if (data.room === this.currentRoom) {
        document.querySelectorAll('.message.own .message-read-status.unread').forEach(el => {
          el.classList.remove('unread');
          el.classList.add('read');
          el.innerHTML = '<i class="fas fa-check-double"></i>';
        });
      }
    });

    this.socket.on('message:deleted', (data) => {
      if (data.room === this.currentRoom) {
        const el = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (el) {
          el.style.animation = 'fadeOut 0.3s ease';
          setTimeout(() => el.remove(), 300);
        }
      }
    });

    this.socket.on('chat:cleared', (data) => {
      if (data.room === this.currentRoom) {
        document.getElementById('messages-list').innerHTML = '';
      }
    });

    this.socket.on('room:deleted', (data) => {
      this.rooms.delete(data.roomId);
      if (this.currentRoom === data.roomId) this.switchRoom('general');
      this.renderChatList();
      this.showNotification(`Группа "${data.roomName}" удалена`);
    });

    this.socket.on('users:update', (users) => {
      this.onlineUsers = users;
      this.renderUsersList();
      this.updateChatSubtitle();
    });

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

    this.socket.on('message:reacted', (data) => {
      if (data.room === this.currentRoom) {
        this.updateMessageReactions(data.messageId, data.reactions);
      }
    });

    this.socket.on('room:created', (room) => {
      this.rooms.set(room.id, room);
      this.renderChatList();
    });

    this.socket.on('room:joined', (data) => {
      if (!this.isJoiningRoom) return;
      this.rooms.set(data.room.id, data.room);
      document.getElementById('messages-list').innerHTML = '';
      data.messages.forEach(msg => this.renderMessage(msg));
      this.scrollToBottom();
      this.isJoiningRoom = false;
    });

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

    this.socket.on('messages:search-results', (data) => {
      this.renderSearchResults(data.results, data.query);
    });

    this.socket.on('profile:updated', (user) => {
      this.user = user;
      this.updateMyProfile();
    });

    this.socket.on('profile:data', (profile) => {
      this.showViewProfile(profile);
    });

    this.socket.on('error:message', (data) => {
      this.showNotification(data.text, 'error');
    });

    this.socket.on('disconnect', () => console.log('🔴 Отключено'));
  }

  // ============================================
  // ПРОЧИТАНО
  // ============================================
  markAsRead(roomId) {
    if (!this.socket) return;
    this.unreadCounts[roomId] = 0;
    this.socket.emit('messages:read', { room: roomId });
    this.renderChatList();
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
    document.getElementById('my-status').textContent = this.user.statusText || 'В сети';

    const avatar = document.getElementById('my-avatar');
    avatar.style.background = this.user.avatarColor || '#6c5ce7';
    avatar.innerHTML = this.user.displayName.charAt(0).toUpperCase();
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

    document.getElementById('btn-new-group').addEventListener('click', () => this.showGroupModal());
    document.getElementById('btn-close-modal').addEventListener('click', () => {
      document.getElementById('modal-new-group').style.display = 'none';
    });
    document.getElementById('btn-cancel-group').addEventListener('click', () => {
      document.getElementById('modal-new-group').style.display = 'none';
    });
    document.getElementById('btn-create-group').addEventListener('click', () => this.createGroup());
    document.getElementById('btn-cancel-reply').addEventListener('click', () => this.cancelReply());
  }

  // ============================================
  // ПОИСК
  // ============================================
  bindSearch() {
    const searchInput = document.getElementById('search-input');
    let searchTimeout;

    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const query = searchInput.value.trim();

      if (!query) {
        document.getElementById('search-results').style.display = 'none';
        document.getElementById('chat-list').style.display = 'block';
        return;
      }

      searchTimeout = setTimeout(() => {
        this.socket.emit('messages:search', { query });
      }, 300);
    });

    document.getElementById('btn-close-search').addEventListener('click', () => {
      document.getElementById('search-results').style.display = 'none';
      document.getElementById('chat-list').style.display = 'block';
      searchInput.value = '';
    });
  }

  renderSearchResults(results, query) {
    const container = document.getElementById('search-results-list');
    const resultsPanel = document.getElementById('search-results');
    const chatList = document.getElementById('chat-list');

    container.innerHTML = '';
    resultsPanel.style.display = 'block';
    chatList.style.display = 'none';

    if (results.length === 0) {
      container.innerHTML = `
        <div class="search-no-results">
          <i class="fas fa-search"></i>
          <p>Ничего не найдено</p>
        </div>
      `;
      return;
    }

    results.forEach(msg => {
      const item = document.createElement('div');
      item.className = 'search-result-item';

      const time = new Date(msg.timestamp).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });

      // Подсвечиваем найденный текст
      const highlightedText = msg.content.replace(
        new RegExp(`(${this.escapeRegex(query)})`, 'gi'),
        '<mark>$1</mark>'
      );

      item.innerHTML = `
        <div class="search-result-room">${msg.roomName}</div>
        <div class="search-result-sender">${msg.sender.displayName}</div>
        <div class="search-result-text">${highlightedText}</div>
        <div class="search-result-time">${time}</div>
      `;

      item.addEventListener('click', () => {
        this.switchRoom(msg.roomId);
        resultsPanel.style.display = 'none';
        chatList.style.display = 'block';
        document.getElementById('search-input').value = '';
      });

      container.appendChild(item);
    });
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ============================================
  // ГОЛОСОВЫЕ СООБЩЕНИЯ
  // ============================================
  bindVoiceRecording() {
    const voiceBtn = document.getElementById('btn-voice');
    const cancelBtn = document.getElementById('btn-cancel-voice');
    const sendBtn = document.getElementById('btn-send-voice');

    voiceBtn.addEventListener('click', () => this.startRecording());
    cancelBtn.addEventListener('click', () => this.cancelRecording());
    sendBtn.addEventListener('click', () => this.stopAndSendRecording());
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.recordingSeconds = 0;

      this.mediaRecorder.ondataavailable = (e) => {
        this.audioChunks.push(e.data);
      };

      this.mediaRecorder.start();
      this.isRecording = true;

      // Показываем UI записи
      document.getElementById('voice-recording').style.display = 'flex';
      document.querySelector('.message-input-wrapper').style.display = 'none';
      document.getElementById('btn-voice').style.display = 'none';

      // Таймер
      this.recordingTimer = setInterval(() => {
        this.recordingSeconds++;
        const min = Math.floor(this.recordingSeconds / 60);
        const sec = this.recordingSeconds % 60;
        document.getElementById('recording-time').textContent =
          `${min}:${sec.toString().padStart(2, '0')}`;
      }, 1000);

    } catch (err) {
      console.error('Ошибка записи:', err);
      this.showNotification('Нет доступа к микрофону. Разрешите в настройках браузера.', 'error');
    }
  }

  cancelRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
    this.isRecording = false;
    clearInterval(this.recordingTimer);

    document.getElementById('voice-recording').style.display = 'none';
    document.querySelector('.message-input-wrapper').style.display = 'block';
    document.getElementById('btn-voice').style.display = 'flex';
  }

  stopAndSendRecording() {
    if (!this.mediaRecorder || !this.isRecording) return;

    const duration = this.recordingSeconds;

    this.mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

      // Загружаем на сервер
      const formData = new FormData();
      formData.append('file', audioBlob, `voice-${Date.now()}.webm`);

      try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const fileInfo = await response.json();

        this.socket.emit('message:send', {
          type: 'voice',
          content: '🎤 Голосовое сообщение',
          room: this.currentRoom,
          sendSound: this.selectedSound,
          file: fileInfo,
          duration: duration
        });
      } catch (err) {
        console.error('Ошибка загрузки голосового:', err);
        this.showNotification('Ошибка отправки голосового', 'error');
      }
    };

    this.mediaRecorder.stop();
    this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
    this.isRecording = false;
    clearInterval(this.recordingTimer);

    document.getElementById('voice-recording').style.display = 'none';
    document.querySelector('.message-input-wrapper').style.display = 'block';
    document.getElementById('btn-voice').style.display = 'flex';
  }

  // ============================================
  // ОТПРАВКА
  // ============================================
  sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;

    this.socket.emit('message:send', {
      type: 'text',
      content,
      room: this.currentRoom,
      sendSound: this.selectedSound,
      replyTo: this.replyingTo
    });

    input.value = '';
    input.style.height = 'auto';
    this.cancelReply();
    this.socket.emit('typing:stop', { room: this.currentRoom });
  }

  deleteMessage(messageId) {
    if (!confirm('Удалить сообщение?')) return;
    this.socket.emit('message:delete', { messageId, room: this.currentRoom });
  }

  clearChat() {
    if (!confirm('Очистить всю историю чата?')) return;
    this.socket.emit('chat:clear', { room: this.currentRoom });
  }

  deleteRoom() {
    if (this.currentRoom === 'general') {
      this.showNotification('Общий чат нельзя удалить', 'error');
      return;
    }
    if (!confirm('Удалить эту группу?')) return;
    this.socket.emit('room:delete', { roomId: this.currentRoom });
  }

  // ============================================
  // РЕНДЕР СООБЩЕНИЙ
  // ============================================
  renderMessage(message) {
    const container = document.getElementById('messages-list');

    if (message.type === 'system') {
      const div = document.createElement('div');
      div.className = 'system-message';
      div.textContent = message.content;
      container.appendChild(div);
      return;
    }

    const isOwn = message.sender.username === this.user?.username;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isOwn ? 'own' : ''}`;
    msgDiv.dataset.messageId = message.id;

    const avatarColor = message.sender.avatarColor || '#6c5ce7';
    const initial = message.sender.displayName?.charAt(0).toUpperCase() || '?';

    const avatarHTML = isOwn ? '' : `
      <div class="avatar-colored" style="width:40px;height:40px;background:${avatarColor};font-size:16px;cursor:pointer;"
           onclick="app.viewProfile('${message.sender.username}')">
        ${initial}
      </div>
    `;

    // Звук
    let soundBadgeHTML = '';
    if (message.sendSound && message.sendSound !== 'default' && message.sendSound !== 'none') {
      const si = this.soundMap[message.sendSound];
      soundBadgeHTML = `
        <div class="message-sound-badge" onclick="app.playSound('${message.sendSound}')" title="Нажми чтобы послушать">
          <i class="fas fa-music"></i> ${si.emoji} ${si.name}
        </div>
      `;
    }

    // Голосовое сообщение
    let voiceHTML = '';
    if (message.type === 'voice' && message.file) {
      const dur = message.duration || 0;
      const min = Math.floor(dur / 60);
      const sec = dur % 60;
      const bars = this.generateWaveform();
      voiceHTML = `
        <div class="voice-message">
          <button class="voice-play-btn" onclick="app.playVoice(this, '${message.file.url}')">
            <i class="fas fa-play"></i>
          </button>
          <div class="voice-waveform">${bars}</div>
          <span class="voice-duration">${min}:${sec.toString().padStart(2, '0')}</span>
        </div>
      `;
    }

    // Файл
    let fileHTML = '';
    if (message.file && message.type !== 'voice') {
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
            <a href="${message.file.url}" download class="btn-icon btn-small"><i class="fas fa-download"></i></a>
          </div>
        `;
      }
    }

    // Ответ
    let replyHTML = '';
    if (message.replyTo) {
      replyHTML = `
        <div class="reply-preview" style="margin-bottom:6px;padding:6px 10px;">
          <div class="reply-content"><i class="fas fa-reply"></i>
            <span>${message.replyTo.content?.substring(0, 50)}...</span>
          </div>
        </div>
      `;
    }

    const reactionsHTML = this.renderReactions(message.id, message.reactions);

    const time = new Date(message.timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit', minute: '2-digit'
    });

    // Галочки прочитано (только свои)
    let readStatusHTML = '';
    if (isOwn && message.type !== 'system') {
      const isRead = message.readBy && message.readBy.length > 0;
      readStatusHTML = `
        <span class="message-read-status ${isRead ? 'read' : 'unread'}">
          <i class="fas fa-${isRead ? 'check-double' : 'check'}"></i>
        </span>
      `;
    }

    const deleteBtn = isOwn ? `
      <button class="btn-delete-msg" onclick="app.deleteMessage('${message.id}')" title="Удалить">
        <i class="fas fa-trash"></i>
      </button>
    ` : '';

    msgDiv.innerHTML = `
      ${avatarHTML}
      <div class="message-bubble">
        ${!isOwn ? `<div class="message-sender" onclick="app.viewProfile('${message.sender.username}')" style="cursor:pointer;">${message.sender.displayName}</div>` : ''}
        ${soundBadgeHTML}
        ${replyHTML}
        ${message.content && message.type !== 'voice' ? `<div class="message-text">${this.escapeHTML(message.content)}</div>` : ''}
        ${voiceHTML}
        ${fileHTML}
        ${reactionsHTML}
        <div class="message-footer">
          <span class="message-time">${time}</span>
          ${readStatusHTML}
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

  generateWaveform() {
    let bars = '';
    for (let i = 0; i < 30; i++) {
      const h = Math.random() * 20 + 5;
      bars += `<div class="voice-bar" style="height:${h}px;"></div>`;
    }
    return bars;
  }

  playVoice(btn, url) {
    const audio = new Audio(url);
    const icon = btn.querySelector('i');

    if (btn.dataset.playing === 'true') {
      btn.dataset.playing = 'false';
      icon.className = 'fas fa-play';
      if (btn._audio) btn._audio.pause();
      return;
    }

    btn.dataset.playing = 'true';
    icon.className = 'fas fa-pause';
    btn._audio = audio;

    audio.play();
    audio.onended = () => {
      btn.dataset.playing = 'false';
      icon.className = 'fas fa-play';
    };
  }

  renderReactions(messageId, reactions) {
    if (!reactions || Object.keys(reactions).length === 0) return '';
    let html = '<div class="message-reactions">';
    for (const [emoji, users] of Object.entries(reactions)) {
      const isOwn = users.includes(this.user?.username);
      html += `<div class="reaction ${isOwn ? 'own' : ''}" onclick="app.react('${messageId}', '${emoji}')">${emoji} <span class="reaction-count">${users.length}</span></div>`;
    }
    return html + '</div>';
  }

  updateMessageReactions(messageId, reactions) {
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!el) return;
    const existing = el.querySelector('.message-reactions');
    const newHTML = this.renderReactions(messageId, reactions);
    if (existing) { existing.outerHTML = newHTML; }
    else {
      const footer = el.querySelector('.message-footer');
      footer.insertAdjacentHTML('beforebegin', newHTML);
    }
  }

  react(messageId, emoji) {
    this.socket.emit('message:react', { messageId, emoji, room: this.currentRoom });
  }

  // ============================================
  // СПИСОК ЧАТОВ
  // ============================================
  renderChatList() {
    const container = document.getElementById('chat-list');
    container.innerHTML = '';

    this.rooms.forEach((room) => {
      const item = document.createElement('div');
      const unread = this.unreadCounts[room.id] || 0;
      item.className = `chat-item ${room.id === this.currentRoom ? 'active' : ''} ${unread > 0 ? 'has-unread' : ''}`;

      const initial = room.name.replace(/[^\w\u0400-\u04FF]/g, '').charAt(0).toUpperCase() || '💬';
      const onlineCount = this.getOnlineCountForRoom(room);

      const unreadBadge = unread > 0 ? `<div class="unread-badge">${unread > 99 ? '99+' : unread}</div>` : '';

      item.innerHTML = `
        <div class="avatar-small">${initial}</div>
        <div class="chat-item-info">
          <div class="chat-item-name">${room.name}</div>
          <div class="chat-item-last">${room.type === 'direct' ? 'Личные сообщения' : `👥 ${onlineCount} в сети`}</div>
        </div>
        ${unreadBadge}
      `;

      item.addEventListener('click', () => {
        if (this.currentRoom === room.id) return;
        this.switchRoom(room.id);
      });

      container.appendChild(item);
    });
  }

  getOnlineCountForRoom(room) {
    const online = this.onlineUsers.map(u => u.username);
    return room.members.filter(m => online.includes(m)).length;
  }

  switchRoom(roomId) {
    if (this.isJoiningRoom) return;
    this.currentRoom = roomId;
    this.isJoiningRoom = true;

    const room = this.rooms.get(roomId);
    this.updateChatHeader(room);
    document.getElementById('messages-list').innerHTML = '';
    this.socket.emit('room:join', { roomId });
    this.markAsRead(roomId);
    this.renderChatList();

    setTimeout(() => { this.isJoiningRoom = false; }, 3000);
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
      const other = room.members.find(m => m !== this.user?.username);
      const isOnline = this.onlineUsers.some(u => u.username === other);
      subtitle.textContent = isOnline ? '🟢 В сети' : '⚫ Не в сети';
    } else {
      const cnt = this.getOnlineCountForRoom(room);
      subtitle.textContent = `👥 ${cnt} из ${room.members.length} в сети`;
    }
  }

  // ============================================
  // СПИСОК ПОЛЬЗОВАТЕЛЕЙ
  // ============================================
  renderUsersList() {
    const container = document.getElementById('users-list');
    container.innerHTML = '';
    const header = document.querySelector('.panel-header h3');
    if (header) header.textContent = `👥 В сети (${this.onlineUsers.length})`;

    this.onlineUsers.forEach((user) => {
      const item = document.createElement('div');
      item.className = 'user-item';
      const initial = user.displayName.charAt(0).toUpperCase();
      const isMe = user.username === this.user?.username;
      const color = user.avatarColor || '#6c5ce7';

      item.innerHTML = `
        <div class="avatar-colored" style="width:40px;height:40px;background:${color};font-size:16px;position:relative;">
          ${initial}
          <div class="online-dot"></div>
        </div>
        <div class="user-item-info">
          <div class="user-item-name">${user.displayName} ${isMe ? '(вы)' : ''}</div>
          <div class="user-item-status">${user.statusText || '🟢 В сети'}</div>
        </div>
      `;

      if (!isMe) {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
          this.socket.emit('dm:start', { username: user.username });
        });
      }

      container.appendChild(item);
    });
  }

  // ============================================
  // ПРОФИЛИ
  // ============================================
  showMyProfile() {
    const modal = document.getElementById('modal-profile');
    document.getElementById('profile-displayname').value = this.user.displayName;
    document.getElementById('profile-status').value = this.user.statusText || '';
    document.getElementById('profile-bio').value = this.user.bio || '';

    const avatar = document.getElementById('profile-avatar-large');
    avatar.textContent = this.user.displayName.charAt(0).toUpperCase();
    avatar.style.background = this.user.avatarColor || '#6c5ce7';

    // Подсветить текущий цвет
    document.querySelectorAll('.color-dot').forEach(dot => {
      dot.classList.toggle('active', dot.style.background === this.user.avatarColor);
    });

    modal.style.display = 'flex';
  }

  setAvatarColor(color) {
    const avatar = document.getElementById('profile-avatar-large');
    avatar.style.background = color;
    this.user.avatarColor = color;

    document.querySelectorAll('.color-dot').forEach(dot => {
      dot.classList.toggle('active', dot.style.backgroundColor === color);
    });
  }

  saveProfile() {
    const displayName = document.getElementById('profile-displayname').value.trim();
    const statusText = document.getElementById('profile-status').value.trim();
    const bio = document.getElementById('profile-bio').value.trim();

    if (!displayName) {
      this.showNotification('Имя не может быть пустым', 'error');
      return;
    }

    this.socket.emit('profile:update', {
      displayName,
      statusText,
      bio,
      avatarColor: this.user.avatarColor
    });

    document.getElementById('modal-profile').style.display = 'none';
    this.showNotification('Профиль обновлён ✅');
  }

  viewProfile(username) {
    this.socket.emit('profile:get', { username });
  }

  showViewProfile(profile) {
    const modal = document.getElementById('modal-view-profile');
    const avatar = document.getElementById('view-profile-avatar');
    avatar.textContent = profile.displayName.charAt(0).toUpperCase();
    avatar.style.background = profile.avatarColor || '#6c5ce7';

    document.getElementById('view-profile-name').textContent = profile.displayName;
    document.getElementById('view-profile-username').textContent = `@${profile.username}`;
    document.getElementById('view-profile-bio').textContent = profile.bio || 'Нет описания';
    document.getElementById('view-profile-status').textContent = profile.statusText || profile.status;

    const joined = new Date(profile.joinedAt).toLocaleDateString('ru-RU');
    document.getElementById('view-profile-joined').textContent = `Присоединился: ${joined}`;

    const dmBtn = document.getElementById('btn-dm-from-profile');
    dmBtn.onclick = () => {
      this.socket.emit('dm:start', { username: profile.username });
      modal.style.display = 'none';
    };

    modal.style.display = 'flex';
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

    document.querySelectorAll('.btn-play').forEach(pb => {
      pb.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playSound(pb.dataset.sound);
      });
    });

    document.addEventListener('click', () => dropdown.classList.remove('show'));
  }

  showSoundNotification(soundType) {
    const si = this.soundMap[soundType];
    if (!si) return;
    const notif = document.getElementById('sound-notification');
    document.getElementById('sound-notif-text').textContent = `${si.emoji} ${si.name}!`;
    notif.style.display = 'block';
    setTimeout(() => { notif.style.display = 'none'; }, 3000);
  }

  showNotification(text) {
    const notif = document.getElementById('sound-notification');
    document.getElementById('sound-notif-text').textContent = text;
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
    document.addEventListener('click', () => picker.style.display = 'none');
    picker.addEventListener('click', (e) => e.stopPropagation());
  }

  buildEmojiGrid() {
    const grid = document.querySelector('.emoji-grid');
    if (!grid) return;
    this.emojis.forEach(emoji => {
      const span = document.createElement('span');
      span.textContent = emoji;
      span.addEventListener('click', () => {
        document.getElementById('message-input').value += emoji;
        document.getElementById('message-input').focus();
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
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const fileInfo = await res.json();
        this.socket.emit('message:send', {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          content: '', room: this.currentRoom,
          sendSound: this.selectedSound, file: fileInfo
        });
      } catch (err) {
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
    const mc = document.getElementById('members-select');
    mc.innerHTML = '';

    this.onlineUsers.forEach(user => {
      if (user.username === this.user?.username) return;
      const opt = document.createElement('label');
      opt.className = 'member-option';
      const color = user.avatarColor || '#6c5ce7';
      opt.innerHTML = `
        <input type="checkbox" value="${user.username}">
        <div class="avatar-colored" style="width:32px;height:32px;background:${color};font-size:13px;">${user.displayName.charAt(0).toUpperCase()}</div>
        <span>${user.displayName}</span>
      `;
      mc.appendChild(opt);
    });

    modal.style.display = 'flex';
  }

  createGroup() {
    const name = document.getElementById('group-name-input').value.trim();
    if (!name) { this.showNotification('Введите название группы', 'error'); return; }
    const cbs = document.querySelectorAll('#members-select input:checked');
    const members = Array.from(cbs).map(cb => cb.value);
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
    const c = document.getElementById('messages-container');
    setTimeout(() => { c.scrollTop = c.scrollHeight; }, 50);
  }

  escapeHTML(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  }
}

const app = new PulseMessenger();