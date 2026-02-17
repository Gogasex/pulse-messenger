// ============================================
// PULSE MESSENGER v2.0 ULTIMATE
// Полная версия со всеми фичами
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
    this.hoverTimeout = null;
    this.chatBackground = localStorage.getItem('pulse-bg') || 'none';
    this.currentTheme = localStorage.getItem('pulse-theme') || 'dark';

    this.soundMap = {
      default: { name: 'Обычный', emoji: '🔔' },
      birthday: { name: 'День рождения', emoji: '🎂' },
      funny: { name: 'Смешной', emoji: '😂' },
      urgent: { name: 'Срочно!', emoji: '🚨' },
      romantic: { name: 'Романтика', emoji: '❤️' },
      applause: { name: 'Аплодисменты', emoji: '👏' },
      victory: { name: 'Победа', emoji: '🏆' },
      magic: { name: 'Магия', emoji: '✨' },
      scary: { name: 'Страшный', emoji: '👻' },
      none: { name: 'Без звука', emoji: '🔇' }
    };

    this.backgrounds = [
      { id: 'none', name: 'Без фона', css: '' },
      { id: 'cosmos', name: 'Космос', css: 'linear-gradient(135deg, #0a0a2e 0%, #1a1a4e 50%, #0d0d3d 100%)' },
      { id: 'sunset', name: 'Закат', css: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b3d 50%, #1a0a1e 100%)' },
      { id: 'ocean', name: 'Океан', css: 'linear-gradient(135deg, #0a1a2e 0%, #0d2b3d 50%, #0a1a2e 100%)' },
      { id: 'forest', name: 'Лес', css: 'linear-gradient(135deg, #0a1e0a 0%, #1b2d1b 50%, #0a1e0a 100%)' },
      { id: 'fire', name: 'Огонь', css: 'linear-gradient(135deg, #2e0a0a 0%, #3d1b1b 50%, #2e0a0a 100%)' },
      { id: 'aurora', name: 'Сияние', css: 'linear-gradient(180deg, #0a0a2e 0%, #1a3a4e 30%, #0a2a3e 60%, #0a0a2e 100%)' },
      { id: 'midnight', name: 'Полночь', css: 'linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 50%, #0d0d1a 100%)' },
      { id: 'purple', name: 'Фиолет', css: 'linear-gradient(135deg, #1a0a3e 0%, #2d1b4e 50%, #1a0a3e 100%)' },
      { id: 'matrix', name: 'Матрица', css: 'linear-gradient(180deg, #000a00 0%, #001a00 50%, #000a00 100%)' }
    ];

    this.avatarEmojis = [
      '😎','🦊','🐱','🐶','🦁','🐸','🦄','🐼',
      '🐨','🐯','🦇','🦉','🐙','🦋','🐺','🐰',
      '🤖','👾','🎮','⚡','🔥','💎','🌟','🎯',
      '🎸','🎵','🏆','🚀','👑','💜','🌈','🦅'
    ];

    this.emojiCategories = {
      '😀 Смайлы': ['😀','😂','🤣','😊','😍','🥰','😘','😎','🤔','😏','😢','😭','😡','🤯','🥳','🤩','😴','🤮','🥶','🥵','😇','🤠','🥸','😈','👹','🤡','💀','👻','👽','🤑','😤','🫡'],
      '👋 Жесты': ['👍','👎','👋','🤝','💪','🙏','👏','🤞','✌️','🤟','🤘','👌','🫶','🫰','👊','✊','🤚','🖐️','✋','👆','👇','👈','👉','🖕','🫵'],
      '❤️ Символы': ['❤️','🔥','⭐','🎉','💎','🌟','✅','❌','⚡','💬','🔒','🔔','💯','♻️','⚠️','🏳️','🏴','💜','💙','💚','💛','🧡','🤍','🖤','💔','❣️'],
      '🎮 Развлечения': ['🎮','🎸','🎵','🎬','🎨','🎭','🎪','🎯','🎲','🎳','🏆','🥇','🥈','🥉','⚽','🏀','🎾','🏈','🎱'],
      '🍕 Еда': ['🍕','🍔','🍟','🌮','🌯','🍣','🍜','🍰','🍭','☕','🍺','🍷','🥤','🧁','🍩','🍪','🥐','🍿'],
      '🐱 Животные': ['🐱','🐶','🐸','🦊','🦄','🐼','🐨','🐯','🦁','🐙','🦋','🐺','🐰','🦅','🐳','🦈','🐢','🦎'],
      '🌍 Природа': ['🌍','🌈','☀️','🌙','⭐','❄️','🔥','💧','🌊','🌸','🌺','🍀','🌲','🏔️','🌋','🌅','🌄']
    };

    this.activityStatuses = [
      { emoji: '💼', text: 'На работе' },
      { emoji: '🎮', text: 'Играю' },
      { emoji: '🎵', text: 'Слушаю музыку' },
      { emoji: '📚', text: 'Учусь' },
      { emoji: '🏋️', text: 'Тренируюсь' },
      { emoji: '😴', text: 'Сплю' },
      { emoji: '🍕', text: 'Ем' },
      { emoji: '🎬', text: 'Смотрю фильм' },
      { emoji: '🚗', text: 'В дороге' },
      { emoji: '🏠', text: 'Дома' }
    ];

    this.audioContext = null;
    this.init();
  }

  // ============================================
  // ИНИЦИАЛИЗАЦИЯ
  // ============================================
  init() {
    this.applyTheme(this.currentTheme);
    this.bindLoginEvents();
    this.bindChatEvents();
    this.bindSoundSelector();
    this.bindEmojiPicker();
    this.bindFileUpload();
    this.bindVoiceRecording();
    this.bindSearch();
    this.buildEmojiGrid();
    this.requestNotificationPermission();
    this.applyChatBackground();
    this.checkInviteLink();
  }

  // ============================================
  // ТЕМЫ
  // ============================================
  applyTheme(theme) {
    this.currentTheme = theme;
    localStorage.setItem('pulse-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }

  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
    if (this.socket) {
      this.socket.emit('profile:update', { theme: newTheme });
    }
  }

  // ============================================
  // ПРИГЛАШЕНИЯ
  // ============================================
  checkInviteLink() {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) {
      this._pendingInvite = invite;
    }
  }

  joinByInvite(code, password) {
    if (!this.socket) return;
    this.socket.emit('room:join-invite', { inviteCode: code, password });
  }

  // ============================================
  // УВЕДОМЛЕНИЯ
  // ============================================
  requestNotificationPermission() {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') this.notificationsEnabled = true;
      else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => { this.notificationsEnabled = p === 'granted'; });
      }
    }
  }

  showBrowserNotification(title, body) {
    if (!this.notificationsEnabled || document.hasFocus()) return;
    if (this.user?.doNotDisturb) return;
    try {
      const n = new Notification(title, { body, tag: 'pulse-msg', renotify: true });
      n.onclick = () => { window.focus(); n.close(); };
      setTimeout(() => n.close(), 5000);
    } catch (e) {}
  }

  // ============================================
  // АУДИО
  // ============================================
  getAudioContext() {
    if (!this.audioContext) this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return this.audioContext;
  }

  playSound(type) {
    if (type === 'none') return;
    try {
      const ctx = this.getAudioContext();
      const sounds = {
        default: () => this.playTone(ctx, [800], [0.1]),
        birthday: () => this.playMelody(ctx, [523,523,587,523,698,659], [.2,.2,.4,.4,.4,.8]),
        funny: () => this.playTone(ctx, [300,600,200,800], [.1,.1,.1,.15], 'square'),
        urgent: () => this.playTone(ctx, [880,0,880,0,880], [.15,.05,.15,.05,.3], 'sawtooth'),
        romantic: () => this.playMelody(ctx, [523,659,784,1047], [.3,.3,.3,.6]),
        applause: () => this.playNoise(ctx, 1),
        victory: () => this.playMelody(ctx, [523,659,784,1047,784,1047], [.15,.15,.15,.15,.15,.4]),
        magic: () => this.playMelody(ctx, [1047,988,880,784,880,1047], [.1,.1,.1,.1,.2,.3]),
        scary: () => this.playTone(ctx, [100,90,80,70], [.3,.3,.3,.5], 'sawtooth')
      };
      (sounds[type] || sounds.default)();
    } catch (e) {}
  }

  playTone(ctx, freqs, durs, type = 'sine') {
    let t = ctx.currentTime;
    freqs.forEach((f, i) => {
      if (!f) { t += durs[i]; return; }
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + durs[i]);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + durs[i]); t += durs[i];
    });
  }

  playMelody(ctx, notes, durs) {
    let t = ctx.currentTime;
    notes.forEach((n, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = n;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + durs[i] * 0.9);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + durs[i]); t += durs[i];
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
  // ФОН ЧАТА
  // ============================================
  applyChatBackground() {
    const c = document.getElementById('messages-container');
    if (!c) return;
    const bg = this.backgrounds.find(b => b.id === this.chatBackground);
    c.style.background = bg?.css || '';
  }

  setChatBackground(id) {
    this.chatBackground = id;
    localStorage.setItem('pulse-bg', id);
    this.applyChatBackground();
  }

  // ============================================
  // ВХОД
  // ============================================
  bindLoginEvents() {
    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const u = document.getElementById('username-input').value.trim();
      const d = document.getElementById('displayname-input').value.trim();
      if (!u) return;
      this.connect(u, d || u);
    });
  }

  // ============================================
  // ПОДКЛЮЧЕНИЕ К СЕРВЕРУ
  // ============================================
  connect(username, displayName) {
    this.socket = io(window.location.origin);

    this.socket.on('connect', () => {
      this.socket.emit('user:join', { username, displayName });
    });

    this.socket.on('user:joined', (data) => {
      this.user = data.user;
      this.onlineUsers = data.onlineUsers || [];
      this.unreadCounts = data.unreadCounts || {};
      if (data.user.theme) this.applyTheme(data.user.theme);
      this.showMainScreen();
      this.updateMyProfile();
      data.rooms.forEach(r => this.rooms.set(r.id, r));
      this.renderChatList();
      this.renderUsersList();
      data.messages.forEach(m => this.renderMessage(m));
      this.scrollToBottom();
      this.markAsRead('general');
      this.applyChatBackground();

      // Проверяем приглашение
      if (this._pendingInvite) {
        this.joinByInvite(this._pendingInvite);
        this._pendingInvite = null;
      }
    });

    this.socket.on('message:new', (msg) => {
      if (msg.room === this.currentRoom) {
        this.renderMessage(msg);
        this.scrollToBottom();
        if (msg.sender.username !== this.user?.username) this.markAsRead(msg.room);
      }
      if (msg.sender.username !== this.user?.username && msg.type !== 'system') {
        if (msg.sendSound && msg.sendSound !== 'default' && msg.sendSound !== 'none') {
          this.playSound(msg.sendSound);
          this.showSoundNotification(msg.sendSound);
        } else if (msg.sendSound !== 'none') {
          this.playSound('default');
        }
        this.showBrowserNotification(msg.sender.displayName, msg.type === 'voice' ? '🎤 Голосовое' : (msg.content || '📎 Файл'));
      }
      this.renderChatList();
    });

    this.socket.on('unread:update', (data) => {
      if (data.room !== this.currentRoom) {
        this.unreadCounts[data.room] = data.count;
        this.renderChatList();
      }
    });

    this.socket.on('messages:were-read', (data) => {
      if (data.room === this.currentRoom) {
        document.querySelectorAll('.message.own .message-read-status.unread').forEach(el => {
          el.classList.remove('unread'); el.classList.add('read');
          el.innerHTML = '<i class="fas fa-check-double"></i>';
        });
      }
    });

    this.socket.on('message:deleted', (data) => {
      if (data.room === this.currentRoom) {
        const el = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (el) { el.style.animation = 'fadeOut 0.3s'; setTimeout(() => el.remove(), 300); }
      }
    });

    this.socket.on('message:edited', (data) => {
      if (data.room === this.currentRoom) {
        const el = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (el) {
          const t = el.querySelector('.message-text');
          if (t) t.innerHTML = this.formatText(data.newContent) + ' <span class="edited-tag">(ред.)</span>';
        }
      }
    });

    this.socket.on('message:pinned', (data) => {
      if (data.room === this.currentRoom) this.showPinnedMessage(data);
    });

    this.socket.on('chat:cleared', (data) => {
      if (data.room === this.currentRoom) {
        document.getElementById('messages-list').innerHTML = '';
        this.hidePinnedMessage();
      }
    });

    this.socket.on('room:deleted', (data) => {
      this.rooms.delete(data.roomId);
      if (this.currentRoom === data.roomId) this.switchRoom('general');
      this.renderChatList();
      this.showNotification(`Группа "${data.roomName}" удалена`);
    });

    this.socket.on('room:created', (room) => {
      this.rooms.set(room.id, room);
      this.renderChatList();
    });

    this.socket.on('room:updated', (room) => {
      this.rooms.set(room.id, room);
      this.renderChatList();
      if (this.currentRoom === room.id) this.updateChatHeader(room);
    });

    this.socket.on('users:update', (users) => {
      this.onlineUsers = users;
      this.renderUsersList();
      this.updateChatSubtitle();
    });

    this.socket.on('typing:update', (data) => {
      if (data.room === this.currentRoom) {
        const ind = document.getElementById('typing-indicator');
        const txt = document.getElementById('typing-text');
        if (data.isTyping) { txt.textContent = `${data.username} печатает...`; ind.style.display = 'flex'; }
        else ind.style.display = 'none';
      }
    });

    this.socket.on('message:reacted', (data) => {
      if (data.room === this.currentRoom) this.updateMessageReactions(data.messageId, data.reactions);
    });

    this.socket.on('room:joined', (data) => {
      if (!this.isJoiningRoom) return;
      this.rooms.set(data.room.id, data.room);
      document.getElementById('messages-list').innerHTML = '';
      data.messages.forEach(m => this.renderMessage(m));
      this.scrollToBottom();
      this.isJoiningRoom = false;
      if (data.room.pinnedMessage) this.loadPinnedMessage(data.room.pinnedMessage);
      else this.hidePinnedMessage();
    });

    this.socket.on('dm:opened', (data) => {
      this.rooms.set(data.room.id, data.room);
      this.currentRoom = data.room.id;
      this.updateChatHeader(data.room);
      document.getElementById('messages-list').innerHTML = '';
      data.messages.forEach(m => this.renderMessage(m));
      this.scrollToBottom();
      this.renderChatList();
    });

    this.socket.on('messages:search-results', (data) => this.renderSearchResults(data.results, data.query));
    this.socket.on('profile:updated', (u) => { this.user = u; this.updateMyProfile(); });
    this.socket.on('profile:data', (p) => this.showProfilePopup(p));
    this.socket.on('error:message', (d) => this.showNotification(d.text));
    this.socket.on('user:blocked', (d) => this.showNotification(`${d.username} заблокирован`));
    this.socket.on('user:unblocked', (d) => this.showNotification(`${d.username} разблокирован`));
    this.socket.on('stats:data', (d) => this.showStatsModal(d));

    // Игры
    this.socket.on('game:tictactoe:updated', (game) => this.updateTicTacToe(game));
    this.socket.on('game:rps:result', (game) => this.showRPSResult(game));
    this.socket.on('game:rps:waiting', () => this.showNotification('Ожидаем ход соперника...'));
    this.socket.on('poll:updated', (data) => this.updatePoll(data));

    this.socket.on('disconnect', () => console.log('🔴 Отключено'));
  }

  markAsRead(room) {
    if (!this.socket) return;
    this.unreadCounts[room] = 0;
    this.socket.emit('messages:read', { room });
    this.renderChatList();
  }

  showMainScreen() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
  }

  updateMyProfile() {
    document.getElementById('my-name').textContent = this.user.displayName;
    document.getElementById('my-status').textContent = this.user.statusText || this.user.activityStatus || 'В сети';
    const av = document.getElementById('my-avatar');
    this.setAvatarElement(av, this.user);
  }

  setAvatarElement(el, user, size) {
    if (user.avatar && user.avatar.startsWith('http')) {
      el.style.background = `url(${user.avatar}) center/cover`;
      el.innerHTML = '';
    } else if (user.avatar) {
      el.style.background = user.avatarColor || '#6c5ce7';
      el.innerHTML = user.avatar;
    } else {
      el.style.background = user.avatarColor || '#6c5ce7';
      el.innerHTML = (user.displayName || '?').charAt(0).toUpperCase();
    }
  }

  // ============================================
  // ФОРМАТИРОВАНИЕ ТЕКСТА
  // ============================================
  formatText(text) {
    if (!text) return '';
    let html = this.escapeHTML(text);
    // **жирный**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // *курсив*
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // `код`
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    // ~~зачёркнутый~~
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    // __подчёркнутый__
    html = html.replace(/__(.+?)__/g, '<u>$1</u>');
    // Ссылки
    html = html.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="msg-link">$1</a>');
    return html;
  }

  // ============================================
  // ЗАКРЕПЛЁННЫЕ
  // ============================================
  showPinnedMessage(data) {
    const bar = document.getElementById('pinned-bar');
    if (!bar) return;
    if (data.pinned) {
      bar.style.display = 'flex';
      document.getElementById('pinned-text').textContent = data.content?.substring(0, 80) || 'Закреплено';
      document.getElementById('pinned-sender').textContent = data.sender?.displayName || '';
    } else this.hidePinnedMessage();
  }

  hidePinnedMessage() {
    const bar = document.getElementById('pinned-bar');
    if (bar) bar.style.display = 'none';
  }

  loadPinnedMessage(msgId) {
    const el = document.querySelector(`[data-message-id="${msgId}"]`);
    if (el) {
      const t = el.querySelector('.message-text')?.textContent || 'Закреплено';
      const s = el.querySelector('.message-sender')?.textContent || '';
      this.showPinnedMessage({ pinned: true, content: t, sender: { displayName: s } });
    }
  }

  // ============================================
  // СОБЫТИЯ ЧАТА
  // ============================================
  bindChatEvents() {
    const input = document.getElementById('message-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    });
    document.getElementById('btn-send').addEventListener('click', () => this.sendMessage());
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      this.emitTyping();
    });

    document.getElementById('btn-new-group').addEventListener('click', () => this.showGroupModal());
    document.getElementById('btn-close-modal').addEventListener('click', () => document.getElementById('modal-new-group').style.display = 'none');
    document.getElementById('btn-cancel-group').addEventListener('click', () => document.getElementById('modal-new-group').style.display = 'none');
    document.getElementById('btn-create-group').addEventListener('click', () => this.createGroup());
    document.getElementById('btn-cancel-reply').addEventListener('click', () => this.cancelReply());

    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); document.getElementById('search-input').focus(); }
      if (e.ctrlKey && e.key === 'b') { e.preventDefault(); this.insertFormat('**'); }
      if (e.ctrlKey && e.key === 'i') { e.preventDefault(); this.insertFormat('*'); }
      if (e.key === 'Escape') {
        document.getElementById('emoji-picker').style.display = 'none';
        document.getElementById('sound-dropdown').classList.remove('show');
        this.cancelReply();
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        const sr = document.getElementById('search-results');
        if (sr?.style.display !== 'none') {
          sr.style.display = 'none';
          document.getElementById('chat-list').style.display = 'block';
          document.getElementById('search-input').value = '';
        }
      }
    });
  }

  insertFormat(marker) {
    const input = document.getElementById('message-input');
    const start = input.selectionStart, end = input.selectionEnd;
    const selected = input.value.substring(start, end);
    input.value = input.value.substring(0, start) + marker + selected + marker + input.value.substring(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + marker.length + selected.length + marker.length;
  }

  // ============================================
  // ПОИСК
  // ============================================
  bindSearch() {
    const si = document.getElementById('search-input');
    let t;
    si.addEventListener('input', () => {
      clearTimeout(t);
      const q = si.value.trim();
      if (!q) {
        document.getElementById('search-results').style.display = 'none';
        document.getElementById('chat-list').style.display = 'block';
        return;
      }
      t = setTimeout(() => this.socket.emit('messages:search', { query: q }), 300);
    });
    document.getElementById('btn-close-search').addEventListener('click', () => {
      document.getElementById('search-results').style.display = 'none';
      document.getElementById('chat-list').style.display = 'block';
      si.value = '';
    });
  }

  renderSearchResults(results, query) {
    const c = document.getElementById('search-results-list');
    const p = document.getElementById('search-results');
    c.innerHTML = '';
    p.style.display = 'block';
    document.getElementById('chat-list').style.display = 'none';
    if (!results.length) {
      c.innerHTML = '<div class="search-no-results"><i class="fas fa-search"></i><p>Ничего не найдено</p></div>';
      return;
    }
    results.forEach(msg => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      const time = new Date(msg.timestamp).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      const hl = this.escapeHTML(msg.content).replace(new RegExp(`(${this.escapeRegex(query)})`, 'gi'), '<mark>$1</mark>');
      item.innerHTML = `<div class="search-result-room">${msg.roomName}</div><div class="search-result-sender">${msg.sender.displayName}</div><div class="search-result-text">${hl}</div><div class="search-result-time">${time}</div>`;
      item.addEventListener('click', () => {
        this.switchRoom(msg.roomId);
        p.style.display = 'none';
        document.getElementById('chat-list').style.display = 'block';
        document.getElementById('search-input').value = '';
      });
      c.appendChild(item);
    });
  }

  escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // ============================================
  // ГОЛОСОВЫЕ
  // ============================================
  bindVoiceRecording() {
    document.getElementById('btn-voice').addEventListener('click', () => this.startRecording());
    document.getElementById('btn-cancel-voice').addEventListener('click', () => this.cancelRecording());
    document.getElementById('btn-send-voice').addEventListener('click', () => this.stopAndSendRecording());
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = []; this.recordingSeconds = 0;
      this.mediaRecorder.ondataavailable = (e) => this.audioChunks.push(e.data);
      this.mediaRecorder.start();
      this.isRecording = true;
      document.getElementById('voice-recording').style.display = 'flex';
      document.querySelector('.message-input-wrapper').style.display = 'none';
      document.getElementById('btn-voice').style.display = 'none';
      this.recordingTimer = setInterval(() => {
        this.recordingSeconds++;
        const m = Math.floor(this.recordingSeconds / 60), s = this.recordingSeconds % 60;
        document.getElementById('recording-time').textContent = `${m}:${s.toString().padStart(2, '0')}`;
      }, 1000);
    } catch (e) { this.showNotification('Нет доступа к микрофону'); }
  }

  cancelRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
    this.isRecording = false; clearInterval(this.recordingTimer);
    document.getElementById('voice-recording').style.display = 'none';
    document.querySelector('.message-input-wrapper').style.display = 'block';
    document.getElementById('btn-voice').style.display = 'flex';
  }

  stopAndSendRecording() {
    if (!this.mediaRecorder || !this.isRecording) return;
    const dur = this.recordingSeconds;
    this.mediaRecorder.onstop = async () => {
      const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const fd = new FormData(); fd.append('file', blob, `voice-${Date.now()}.webm`);
      try {
        const r = await fetch('/upload', { method: 'POST', body: fd });
        const fi = await r.json();
        this.socket.emit('message:send', { type: 'voice', content: '🎤 Голосовое', room: this.currentRoom, sendSound: this.selectedSound, file: fi, duration: dur });
      } catch (e) { this.showNotification('Ошибка отправки'); }
    };
    this.mediaRecorder.stop();
    this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
    this.isRecording = false; clearInterval(this.recordingTimer);
    document.getElementById('voice-recording').style.display = 'none';
    document.querySelector('.message-input-wrapper').style.display = 'block';
    document.getElementById('btn-voice').style.display = 'flex';
  }

    // ============================================
  // ОТПРАВКА / РЕДАКТИРОВАНИЕ / УДАЛЕНИЕ
  // ============================================
  sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;

    const msgData = {
      type: 'text', content, room: this.currentRoom,
      sendSound: this.selectedSound, replyTo: this.replyingTo
    };

    // Исчезающие сообщения
    const expSelect = document.getElementById('expire-select');
    if (expSelect && expSelect.value !== '0') {
      msgData.expiresIn = parseInt(expSelect.value);
    }

    this.socket.emit('message:send', msgData);
    input.value = ''; input.style.height = 'auto';
    this.cancelReply();
    this.socket.emit('typing:stop', { room: this.currentRoom });
  }

  editMessage(messageId) {
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!el) return;
    const t = el.querySelector('.message-text');
    if (!t) return;
    const old = t.textContent.replace(' (ред.)', '');
    const nw = prompt('Редактировать:', old);
    if (nw === null || nw.trim() === '' || nw === old) return;
    this.socket.emit('message:edit', { messageId, newContent: nw.trim() });
  }

  pinMessage(id) { this.socket.emit('message:pin', { messageId: id, room: this.currentRoom }); }

  copyMessage(id) {
    const el = document.querySelector(`[data-message-id="${id}"]`);
    if (!el) return;
    const t = el.querySelector('.message-text')?.textContent || '';
    navigator.clipboard.writeText(t).then(() => this.showNotification('Скопировано ✅'));
  }

  forwardMessage(id) { this.showForwardModal(id); }

  showForwardModal(messageId) {
    let modal = document.getElementById('modal-forward');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-forward'; modal.className = 'modal';
      modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3><i class="fas fa-share"></i> Переслать</h3><button class="btn-icon" onclick="document.getElementById('modal-forward').style.display='none'"><i class="fas fa-times"></i></button></div><div class="modal-body"><div id="forward-rooms-list" class="forward-rooms-list"></div></div></div>`;
      document.body.appendChild(modal);
    }
    const list = document.getElementById('forward-rooms-list');
    list.innerHTML = '';
    this.rooms.forEach(room => {
      if (room.id === this.currentRoom) return;
      const item = document.createElement('div');
      item.className = 'chat-item'; item.style.cursor = 'pointer';
      item.innerHTML = `<div class="avatar-small">${(room.name[0] || '💬').toUpperCase()}</div><div class="chat-item-info"><div class="chat-item-name">${room.name}</div></div>`;
      item.addEventListener('click', () => {
        this.socket.emit('message:forward', { messageId, targetRoom: room.id });
        modal.style.display = 'none';
        this.showNotification('Переслано ✅');
      });
      list.appendChild(item);
    });
    modal.style.display = 'flex';
  }

  deleteMessage(id) {
    if (!confirm('Удалить сообщение?')) return;
    this.socket.emit('message:delete', { messageId: id, room: this.currentRoom });
  }

  clearChat() {
    if (!confirm('Очистить историю?')) return;
    this.socket.emit('chat:clear', { room: this.currentRoom });
  }

  deleteRoom() {
    if (this.currentRoom === 'general') { this.showNotification('Нельзя удалить общий чат'); return; }
    if (!confirm('Удалить группу?')) return;
    this.socket.emit('room:delete', { roomId: this.currentRoom });
  }

  // ============================================
  // РЕНДЕР СООБЩЕНИЙ
  // ============================================
  renderMessage(msg) {
    const container = document.getElementById('messages-list');
    const id = msg.messageId || msg.id;

    if (msg.type === 'system') {
      const d = document.createElement('div');
      d.className = 'system-message'; d.textContent = msg.content;
      container.appendChild(d); return;
    }

    if (msg.type === 'poll') { this.renderPollMessage(msg, container); return; }
    if (msg.type === 'game') { this.renderGameMessage(msg, container); return; }

    const isOwn = msg.sender.username === this.user?.username;
    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'own' : ''}`;
    div.dataset.messageId = id;

    const color = msg.sender.avatarColor || '#6c5ce7';
    const avatarContent = msg.sender.avatar?.startsWith('http') ? '' : (msg.sender.avatar || msg.sender.displayName?.charAt(0).toUpperCase() || '?');
    const avatarStyle = msg.sender.avatar?.startsWith('http') ? `background:url(${msg.sender.avatar}) center/cover;` : `background:${color};`;

    const avatarHTML = isOwn ? '' : `
      <div class="avatar-colored" style="width:40px;height:40px;${avatarStyle}font-size:16px;cursor:pointer;"
        onmouseenter="app.onAvatarHover('${msg.sender.username}',event)" onmouseleave="app.onAvatarLeave()"
        onclick="app.startDM('${msg.sender.username}')">${avatarContent}</div>`;

    let soundHTML = '';
    if (msg.sendSound && msg.sendSound !== 'default' && msg.sendSound !== 'none') {
      const s = this.soundMap[msg.sendSound];
      soundHTML = `<div class="message-sound-badge" onclick="app.playSound('${msg.sendSound}')""><i class="fas fa-music"></i> ${s?.emoji} ${s?.name}</div>`;
    }

    let forwardHTML = '';
    if (msg.forwarded) {
      forwardHTML = `<div class="forwarded-tag"><i class="fas fa-share"></i> Переслано от ${msg.forwardedFrom || 'пользователя'}</div>`;
    }

    let voiceHTML = '';
    if (msg.type === 'voice' && msg.file) {
      const dur = msg.duration || 0;
      const m = Math.floor(dur / 60), s = dur % 60;
      voiceHTML = `<div class="voice-message"><button class="voice-play-btn" onclick="app.playVoice(this,'${msg.file.url}')"><i class="fas fa-play"></i></button><div class="voice-waveform">${this.generateWaveform()}</div><span class="voice-duration">${m}:${s.toString().padStart(2,'0')}</span></div>`;
    }

    let fileHTML = '';
    if (msg.file && msg.type !== 'voice') {
      if (msg.file.mimetype?.startsWith('image/')) {
        fileHTML = `<img src="${msg.file.url}" class="message-image" onclick="window.open('${msg.file.url}','_blank')">`;
      } else {
        fileHTML = `<div class="message-file"><i class="fas fa-file"></i><div class="message-file-info"><div class="message-file-name">${msg.file.originalName}</div><div class="message-file-size">${this.formatSize(msg.file.size)}</div></div><a href="${msg.file.url}" download class="btn-icon btn-small"><i class="fas fa-download"></i></a></div>`;
      }
    }

    let replyHTML = '';
    if (msg.replyTo) {
      replyHTML = `<div class="reply-preview" style="margin-bottom:6px;padding:6px 10px;"><div class="reply-content"><i class="fas fa-reply"></i><span>${(msg.replyTo.content || '').substring(0, 50)}</span></div></div>`;
    }

    const reactionsHTML = this.renderReactions(id, msg.reactions);
    const time = new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
    const edited = msg.edited ? ' <span class="edited-tag">(ред.)</span>' : '';
    const expiring = msg.expiresAt ? ' <i class="fas fa-clock expire-icon" title="Исчезающее"></i>' : '';

    let readHTML = '';
    if (isOwn && msg.type !== 'system') {
      const read = msg.readBy?.length > 0;
      readHTML = `<span class="message-read-status ${read ? 'read' : 'unread'}"><i class="fas fa-${read ? 'check-double' : 'check'}"></i></span>`;
    }

    let actionsHTML;
    if (isOwn) {
      actionsHTML = `
        <button class="btn-msg-action" onclick="app.editMessage('${id}')" title="Редактировать"><i class="fas fa-pen"></i></button>
        <button class="btn-msg-action" onclick="app.copyMessage('${id}')" title="Копировать"><i class="fas fa-copy"></i></button>
        <button class="btn-msg-action" onclick="app.pinMessage('${id}')" title="Закрепить"><i class="fas fa-thumbtack"></i></button>
        <button class="btn-msg-action" onclick="app.forwardMessage('${id}')" title="Переслать"><i class="fas fa-share"></i></button>
        <button class="btn-msg-action btn-delete-msg" onclick="app.deleteMessage('${id}')" title="Удалить"><i class="fas fa-trash"></i></button>`;
    } else {
      actionsHTML = `
        <button class="btn-msg-action" onclick="app.copyMessage('${id}')" title="Копировать"><i class="fas fa-copy"></i></button>
        <button class="btn-msg-action" onclick="app.pinMessage('${id}')" title="Закрепить"><i class="fas fa-thumbtack"></i></button>
        <button class="btn-msg-action" onclick="app.forwardMessage('${id}')" title="Переслать"><i class="fas fa-share"></i></button>
        <button class="btn-msg-action" onclick="app.setReply('${id}','${this.escapeAttr(msg.content)}')" title="Ответить"><i class="fas fa-reply"></i></button>`;
    }

    const contentHTML = msg.content && msg.type !== 'voice' ? `<div class="message-text">${this.formatText(msg.content)}${edited}</div>` : '';

    div.innerHTML = `${avatarHTML}
      <div class="message-bubble">
        ${!isOwn ? `<div class="message-sender" style="cursor:pointer" onclick="app.startDM('${msg.sender.username}')">${msg.sender.displayName}</div>` : ''}
        ${forwardHTML}${soundHTML}${replyHTML}${contentHTML}${voiceHTML}${fileHTML}${reactionsHTML}
        <div class="message-footer"><span class="message-time">${time}${expiring}</span>${readHTML}</div>
        <div class="message-actions">${actionsHTML}</div>
        <div class="reaction-picker">
          <span onclick="app.react('${id}','❤️')">❤️</span><span onclick="app.react('${id}','😂')">😂</span>
          <span onclick="app.react('${id}','👍')">👍</span><span onclick="app.react('${id}','😮')">😮</span>
          <span onclick="app.react('${id}','😢')">😢</span><span onclick="app.react('${id}','🔥')">🔥</span>
          <span onclick="app.react('${id}','💀')">💀</span><span onclick="app.react('${id}','🗿')">🗿</span>
        </div>
      </div>`;
    container.appendChild(div);
  }

  escapeAttr(s) { return (s || '').replace(/'/g, "\\'").replace(/\n/g, ' ').substring(0, 50); }

  generateWaveform() {
    let b = '';
    for (let i = 0; i < 30; i++) b += `<div class="voice-bar" style="height:${Math.random()*20+5}px"></div>`;
    return b;
  }

  playVoice(btn, url) {
    const a = new Audio(url), ic = btn.querySelector('i');
    if (btn.dataset.playing === 'true') { btn.dataset.playing = 'false'; ic.className = 'fas fa-play'; if (btn._a) btn._a.pause(); return; }
    btn.dataset.playing = 'true'; ic.className = 'fas fa-pause'; btn._a = a; a.play();
    a.onended = () => { btn.dataset.playing = 'false'; ic.className = 'fas fa-play'; };
  }

  renderReactions(id, reactions) {
    if (!reactions || !Object.keys(reactions).length) return '';
    let h = '<div class="message-reactions">';
    for (const [e, users] of Object.entries(reactions)) {
      const own = users.includes(this.user?.username);
      h += `<div class="reaction ${own?'own':''}" onclick="app.react('${id}','${e}')">${e} <span class="reaction-count">${users.length}</span></div>`;
    }
    return h + '</div>';
  }

  updateMessageReactions(id, reactions) {
    const el = document.querySelector(`[data-message-id="${id}"]`);
    if (!el) return;
    const ex = el.querySelector('.message-reactions');
    const nw = this.renderReactions(id, reactions);
    if (ex) ex.outerHTML = nw;
    else { const f = el.querySelector('.message-footer'); f?.insertAdjacentHTML('beforebegin', nw); }
  }

  react(id, emoji) { this.socket.emit('message:react', { messageId: id, emoji, room: this.currentRoom }); }

  // ============================================
  // ОПРОСЫ
  // ============================================
  showPollModal() {
    let modal = document.getElementById('modal-poll');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-poll'; modal.className = 'modal';
      modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3><i class="fas fa-poll"></i> Создать опрос</h3><button class="btn-icon" onclick="document.getElementById('modal-poll').style.display='none'"><i class="fas fa-times"></i></button></div>
      <div class="modal-body">
        <div class="input-group"><i class="fas fa-question"></i><input type="text" id="poll-question" placeholder="Вопрос"></div>
        <div id="poll-options-list"><div class="input-group"><i class="fas fa-circle"></i><input type="text" class="poll-option-input" placeholder="Вариант 1"></div><div class="input-group"><i class="fas fa-circle"></i><input type="text" class="poll-option-input" placeholder="Вариант 2"></div></div>
        <button class="btn-secondary" onclick="app.addPollOption()" style="margin:8px 0;width:100%"><i class="fas fa-plus"></i> Добавить вариант</button>
        <label class="checkbox-label"><input type="checkbox" id="poll-multiple"> Несколько ответов</label>
        <label class="checkbox-label"><input type="checkbox" id="poll-anon"> Анонимное</label>
      </div>
      <div class="modal-footer"><button class="btn-secondary" onclick="document.getElementById('modal-poll').style.display='none'">Отмена</button><button class="btn-primary" onclick="app.createPoll()">Создать</button></div></div>`;
      document.body.appendChild(modal);
    }
    document.getElementById('poll-question').value = '';
    document.getElementById('poll-options-list').innerHTML = `<div class="input-group"><i class="fas fa-circle"></i><input type="text" class="poll-option-input" placeholder="Вариант 1"></div><div class="input-group"><i class="fas fa-circle"></i><input type="text" class="poll-option-input" placeholder="Вариант 2"></div>`;
    modal.style.display = 'flex';
  }

  addPollOption() {
    const list = document.getElementById('poll-options-list');
    const count = list.querySelectorAll('.poll-option-input').length + 1;
    const div = document.createElement('div');
    div.className = 'input-group';
    div.innerHTML = `<i class="fas fa-circle"></i><input type="text" class="poll-option-input" placeholder="Вариант ${count}">`;
    list.appendChild(div);
  }

  createPoll() {
    const q = document.getElementById('poll-question').value.trim();
    if (!q) { this.showNotification('Введите вопрос'); return; }
    const opts = Array.from(document.querySelectorAll('.poll-option-input')).map(i => i.value.trim()).filter(v => v);
    if (opts.length < 2) { this.showNotification('Минимум 2 варианта'); return; }
    this.socket.emit('poll:create', {
      question: q, options: opts, room: this.currentRoom,
      multipleChoice: document.getElementById('poll-multiple').checked,
      anonymous: document.getElementById('poll-anon').checked
    });
    document.getElementById('modal-poll').style.display = 'none';
  }

  renderPollMessage(msg, container) {
    const div = document.createElement('div');
    div.className = 'message'; div.dataset.messageId = msg.messageId || msg.id;
    const pd = msg.pollData; if (!pd) return;
    let optsHTML = '';
    const totalVotes = pd.options.reduce((sum, o) => sum + (o.votes?.length || 0), 0);
    pd.options.forEach((opt, i) => {
      const votes = opt.votes?.length || 0;
      const pct = totalVotes > 0 ? Math.round(votes / totalVotes * 100) : 0;
      const voted = opt.votes?.includes(this.user?.username);
      optsHTML += `<div class="poll-option ${voted?'voted':''}" onclick="app.votePoll('${pd.pollId}',${i})">
        <div class="poll-option-bar" style="width:${pct}%"></div>
        <span class="poll-option-text">${opt.text}</span>
        <span class="poll-option-pct">${pct}% (${votes})</span></div>`;
    });
    div.innerHTML = `<div class="poll-card" data-poll-id="${pd.pollId}">
      <div class="poll-header"><i class="fas fa-poll"></i> Опрос от ${msg.sender.displayName}</div>
      <div class="poll-question">${pd.question}</div>
      <div class="poll-options">${optsHTML}</div>
      <div class="poll-footer">${totalVotes} голосов</div></div>`;
    container.appendChild(div);
  }

  votePoll(pollId, optionIndex) {
    this.socket.emit('poll:vote', { pollId, optionIndex });
  }

  updatePoll(data) {
    const card = document.querySelector(`[data-poll-id="${data.pollId}"]`);
    if (!card) return;
    const optsContainer = card.querySelector('.poll-options');
    const totalVotes = data.options.reduce((sum, o) => sum + (o.votes?.length || 0), 0);
    let html = '';
    data.options.forEach((opt, i) => {
      const votes = opt.votes?.length || 0;
      const pct = totalVotes > 0 ? Math.round(votes / totalVotes * 100) : 0;
      const voted = opt.votes?.includes(this.user?.username);
      html += `<div class="poll-option ${voted?'voted':''}" onclick="app.votePoll('${data.pollId}',${i})">
        <div class="poll-option-bar" style="width:${pct}%"></div>
        <span class="poll-option-text">${opt.text}</span>
        <span class="poll-option-pct">${pct}% (${votes})</span></div>`;
    });
    optsContainer.innerHTML = html;
    card.querySelector('.poll-footer').textContent = `${totalVotes} голосов`;
  }

  // ============================================
  // МИНИ-ИГРЫ
  // ============================================
  showGamesMenu() {
    let modal = document.getElementById('modal-games');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-games'; modal.className = 'modal';
      modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3><i class="fas fa-gamepad"></i> Игры</h3><button class="btn-icon" onclick="document.getElementById('modal-games').style.display='none'"><i class="fas fa-times"></i></button></div>
      <div class="modal-body">
        <div class="games-list">
          <div class="game-card" onclick="app.startTicTacToe()"><i class="fas fa-th"></i><span>Крестики-нолики</span></div>
          <div class="game-card" onclick="app.startRPS()"><i class="fas fa-hand-rock"></i><span>Камень-Ножницы-Бумага</span></div>
          <div class="game-card" onclick="app.rollDice()"><i class="fas fa-dice"></i><span>Бросить кубик</span></div>
        </div>
      </div></div>`;
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
  }

  startTicTacToe() {
    document.getElementById('modal-games').style.display = 'none';
    const opponents = this.onlineUsers.filter(u => u.username !== this.user?.username);
    if (!opponents.length) { this.showNotification('Нет игроков онлайн'); return; }
    const name = prompt('Имя соперника:\n' + opponents.map(u => u.displayName + ' (' + u.username + ')').join('\n'));
    if (!name) return;
    const opp = opponents.find(u => u.username === name || u.displayName === name);
    if (!opp) { this.showNotification('Игрок не найден'); return; }
    this.socket.emit('game:tictactoe:start', { opponent: opp.username, room: this.currentRoom });
  }

  renderGameMessage(msg, container) {
    const div = document.createElement('div');
    div.className = 'message'; div.dataset.messageId = msg.messageId || msg.id;
    const gd = msg.gameData;
    if (!gd) { div.innerHTML = `<div class="system-message">${msg.content}</div>`; container.appendChild(div); return; }

    if (gd.type === 'tictactoe') {
      let boardHTML = '<div class="ttt-board">';
      for (let i = 0; i < 9; i++) {
        boardHTML += `<div class="ttt-cell" onclick="app.tttMove('${gd.id}',${i})">${gd.board[i] || ''}</div>`;
      }
      boardHTML += '</div>';
      const status = gd.winner ? (gd.winner === 'draw' ? 'Ничья!' : `Победил ${gd.winner}!`) : `Ход: ${gd.currentTurn}`;
      div.innerHTML = `<div class="game-card-msg" data-game-id="${gd.id}">
        <div class="game-header"><i class="fas fa-th"></i> Крестики-нолики</div>
        ${boardHTML}<div class="game-status">${status}</div></div>`;
    } else if (gd.type === 'rps') {
      div.innerHTML = `<div class="game-card-msg" data-game-id="${gd.id || gd.gameId}">
        <div class="game-header"><i class="fas fa-hand-rock"></i> Камень-Ножницы-Бумага</div>
        <div class="rps-choices">
          <button class="rps-btn" onclick="app.rpsChoose('${gd.id || gd.gameId}','rock')">🪨</button>
          <button class="rps-btn" onclick="app.rpsChoose('${gd.id || gd.gameId}','scissors')">✂️</button>
          <button class="rps-btn" onclick="app.rpsChoose('${gd.id || gd.gameId}','paper')">📄</button>
        </div>
        <div class="game-status">Выберите!</div></div>`;
    }
    container.appendChild(div);
  }

  tttMove(gameId, pos) { this.socket.emit('game:tictactoe:move', { gameId, position: pos }); }

  updateTicTacToe(game) {
    const card = document.querySelector(`[data-game-id="${game.id}"]`);
    if (!card) return;
    const cells = card.querySelectorAll('.ttt-cell');
    game.board.forEach((v, i) => { cells[i].textContent = v || ''; cells[i].className = `ttt-cell ${v ? 'filled' : ''}`; });
    const status = card.querySelector('.game-status');
    if (game.winner) {
      if (game.winner === 'draw') status.textContent = '🤝 Ничья!';
      else status.textContent = `🏆 Победил ${game.winner}!`;
    } else {
      status.textContent = `Ход: ${game.currentTurn}`;
    }
  }

  startRPS() {
    document.getElementById('modal-games').style.display = 'none';
    const opponents = this.onlineUsers.filter(u => u.username !== this.user?.username);
    if (!opponents.length) { this.showNotification('Нет игроков онлайн'); return; }
    const name = prompt('Имя соперника:\n' + opponents.map(u => u.displayName + ' (' + u.username + ')').join('\n'));
    if (!name) return;
    const opp = opponents.find(u => u.username === name || u.displayName === name);
    if (!opp) { this.showNotification('Игрок не найден'); return; }
    this.socket.emit('game:rps:start', { opponent: opp.username, room: this.currentRoom });
  }

  rpsChoose(gameId, choice) { this.socket.emit('game:rps:choose', { gameId, choice }); }

  showRPSResult(game) {
    const players = Object.keys(game.players);
    const choices = { rock: '🪨', scissors: '✂️', paper: '📄' };
    let result;
    if (game.winner === 'draw') result = '🤝 Ничья!';
    else result = `🏆 ${game.playerNames[game.winner] || game.winner} победил!`;
    this.showNotification(`${choices[game.players[players[0]]]} vs ${choices[game.players[players[1]]]} — ${result}`);
  }

  rollDice() {
    document.getElementById('modal-games')?.style.display === 'flex' && (document.getElementById('modal-games').style.display = 'none');
    this.socket.emit('game:dice', { room: this.currentRoom });
  }

  // ============================================
  // HOVER ПРОФИЛЬ
  // ============================================
  onAvatarHover(username, e) {
    clearTimeout(this.hoverTimeout);
    this.hoverTimeout = setTimeout(() => {
      this._hoverEvent = e;
      this.socket.emit('profile:get', { username });
    }, 500);
  }

  onAvatarLeave() {
    clearTimeout(this.hoverTimeout);
    setTimeout(() => {
      const p = document.getElementById('profile-hover-popup');
      if (p && !p.matches(':hover')) p.style.display = 'none';
    }, 300);
  }

  showProfilePopup(profile) {
    let p = document.getElementById('profile-hover-popup');
    if (!p) {
      p = document.createElement('div');
      p.id = 'profile-hover-popup'; p.className = 'profile-hover-popup';
      p.addEventListener('mouseleave', () => p.style.display = 'none');
      document.body.appendChild(p);
    }
    const avatarStyle = profile.avatar?.startsWith('http') ? `background:url(${profile.avatar}) center/cover;` : `background:${profile.avatarColor || '#6c5ce7'};`;
    const avatarContent = profile.avatar?.startsWith('http') ? '' : (profile.avatar || profile.displayName.charAt(0).toUpperCase());
    const lastSeen = profile.lastSeen ? new Date(profile.lastSeen).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
    const isOnline = this.onlineUsers.some(u => u.username === profile.username);

    p.innerHTML = `<div class="hover-profile-header">
      <div class="avatar-colored" style="width:50px;height:50px;${avatarStyle}font-size:22px">${avatarContent}</div>
      <div class="hover-profile-info"><div class="hover-profile-name">${profile.displayName}</div>
      <div class="hover-profile-username">@${profile.username}</div></div></div>
      ${profile.activityStatus ? `<div class="hover-profile-activity">${profile.activityStatus}</div>` : ''}
      ${profile.bio ? `<div class="hover-profile-bio">${profile.bio}</div>` : ''}
      ${profile.statusText ? `<div class="hover-profile-status">${profile.statusText}</div>` : ''}
      <div class="hover-profile-online">${isOnline ? '🟢 В сети' : `⚫ Был(а) ${lastSeen}`}</div>
      <div class="hover-profile-actions">
        <button class="btn-primary btn-small-full" onclick="app.startDM('${profile.username}');document.getElementById('profile-hover-popup').style.display='none'">
          <i class="fas fa-comment"></i> Написать</button></div>`;

    if (this._hoverEvent) {
      const r = this._hoverEvent.target.getBoundingClientRect();
      p.style.top = Math.min(r.top - 10, window.innerHeight - 280) + 'px';
      p.style.left = (r.right + 10 + 260 > window.innerWidth ? r.left - 260 : r.right + 10) + 'px';
    }
    p.style.display = 'block';
  }

  startDM(username) {
    if (username === this.user?.username) return;
    if (this.user?.blockedUsers?.includes(username)) { this.showNotification('Пользователь заблокирован'); return; }
    this.socket.emit('dm:start', { username });
  }

  // ============================================
  // СПИСОК ЧАТОВ
  // ============================================
  renderChatList() {
    const c = document.getElementById('chat-list');
    c.innerHTML = '';
    this.rooms.forEach(room => {
      const item = document.createElement('div');
      const unread = this.unreadCounts[room.id] || 0;
      item.className = `chat-item ${room.id === this.currentRoom ? 'active' : ''} ${unread > 0 ? 'has-unread' : ''}`;
      const initial = room.name.replace(/[^\w\u0400-\u04FF]/g, '').charAt(0).toUpperCase() || '💬';
      const online = this.getOnlineCountForRoom(room);
      const badge = unread > 0 ? `<div class="unread-badge">${unread > 99 ? '99+' : unread}</div>` : '';
      item.innerHTML = `<div class="avatar-small">${initial}</div>
        <div class="chat-item-info"><div class="chat-item-name">${room.name}</div>
        <div class="chat-item-last">${room.type === 'direct' ? 'Личные сообщения' : `👥 ${online} в сети`}</div></div>${badge}`;
      item.addEventListener('click', () => { if (this.currentRoom !== room.id) this.switchRoom(room.id); });
      c.appendChild(item);
    });
  }

  getOnlineCountForRoom(room) {
    const on = this.onlineUsers.map(u => u.username);
    return room.members.filter(m => on.includes(m)).length;
  }

  switchRoom(roomId) {
    if (this.isJoiningRoom) return;
    this.currentRoom = roomId; this.isJoiningRoom = true;
    this.updateChatHeader(this.rooms.get(roomId));
    document.getElementById('messages-list').innerHTML = '';
    this.socket.emit('room:join', { roomId });
    this.markAsRead(roomId);
    this.renderChatList();
    setTimeout(() => this.isJoiningRoom = false, 3000);
  }

  updateChatHeader(room) {
    if (!room) return;
    document.getElementById('chat-name').textContent = room.name;
    this.updateChatSubtitle();
  }

  updateChatSubtitle() {
    const room = this.rooms.get(this.currentRoom);
    if (!room) return;
    const sub = document.getElementById('chat-subtitle');
    if (room.type === 'direct') {
      const other = room.members.find(m => m !== this.user?.username);
      sub.textContent = this.onlineUsers.some(u => u.username === other) ? '🟢 В сети' : '⚫ Не в сети';
    } else {
      sub.textContent = `👥 ${this.getOnlineCountForRoom(room)} из ${room.members.length} в сети`;
    }
  }

  // ============================================
  // СПИСОК ПОЛЬЗОВАТЕЛЕЙ
  // ============================================
  renderUsersList() {
    const c = document.getElementById('users-list');
    c.innerHTML = '';
    document.querySelector('.panel-header h3').textContent = `👥 В сети (${this.onlineUsers.length})`;

    this.onlineUsers.forEach(user => {
      const item = document.createElement('div');
      item.className = 'user-item';
      const isMe = user.username === this.user?.username;
      const color = user.avatarColor || '#6c5ce7';
      const ac = user.avatar?.startsWith('http') ? '' : (user.avatar || user.displayName.charAt(0).toUpperCase());
      const as = user.avatar?.startsWith('http') ? `background:url(${user.avatar}) center/cover;` : `background:${color};`;

      item.innerHTML = `<div class="avatar-colored" style="width:40px;height:40px;${as}font-size:16px;position:relative">${ac}<div class="online-dot"></div></div>
        <div class="user-item-info"><div class="user-item-name">${user.displayName}${isMe?' (вы)':''}</div>
        <div class="user-item-status">${user.activityStatus || user.statusText || '🟢 В сети'}</div>
        ${user.bio ? `<div class="user-item-bio">${user.bio}</div>` : ''}</div>`;

      item.style.cursor = 'pointer';
      item.addEventListener('click', () => { if (isMe) this.showMyProfile(); else this.startDM(user.username); });
      item.addEventListener('mouseenter', (e) => {
        if (!isMe) this.hoverTimeout = setTimeout(() => { this._hoverEvent = e; this.showProfilePopup(user); }, 600);
      });
      item.addEventListener('mouseleave', () => {
        clearTimeout(this.hoverTimeout);
        setTimeout(() => { const pp = document.getElementById('profile-hover-popup'); if (pp && !pp.matches(':hover')) pp.style.display = 'none'; }, 300);
      });
      c.appendChild(item);
    });
  }

  // ============================================
  // ПРОФИЛЬ
  // ============================================
  showMyProfile() {
    const modal = document.getElementById('modal-profile');
    document.getElementById('profile-displayname').value = this.user.displayName;
    document.getElementById('profile-status').value = this.user.statusText || '';
    document.getElementById('profile-bio').value = this.user.bio || '';
    const av = document.getElementById('profile-avatar-large');
    this.setAvatarElement(av, this.user);
    this.buildAvatarEmojiGrid();
    this.buildBackgroundPicker();
    this.buildActivityPicker();
    document.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('active', d.style.backgroundColor === this.user.avatarColor));
    modal.style.display = 'flex';
  }

  buildAvatarEmojiGrid() {
    const g = document.getElementById('avatar-emoji-grid'); if (!g) return;
    g.innerHTML = '';
    this.avatarEmojis.forEach(e => {
      const s = document.createElement('span');
      s.className = `avatar-emoji-option ${this.user.avatar === e ? 'active' : ''}`;
      s.textContent = e;
      s.addEventListener('click', () => {
        this.user.avatar = e;
        const av = document.getElementById('profile-avatar-large');
        av.textContent = e; av.style.background = this.user.avatarColor || '#6c5ce7';
        document.querySelectorAll('.avatar-emoji-option').forEach(o => o.classList.remove('active'));
        s.classList.add('active');
      });
      g.appendChild(s);
    });
    const up = document.createElement('span');
    up.className = 'avatar-emoji-option avatar-upload-btn'; up.innerHTML = '📷'; up.title = 'Загрузить фото';
    up.addEventListener('click', () => document.getElementById('avatar-file-input').click());
    g.appendChild(up);

    // Кнопка сброса
    const reset = document.createElement('span');
    reset.className = 'avatar-emoji-option'; reset.innerHTML = '❌'; reset.title = 'Сбросить';
    reset.addEventListener('click', () => {
      this.user.avatar = null;
      const av = document.getElementById('profile-avatar-large');
      av.textContent = this.user.displayName.charAt(0).toUpperCase();
      av.style.background = this.user.avatarColor || '#6c5ce7';
      document.querySelectorAll('.avatar-emoji-option').forEach(o => o.classList.remove('active'));
    });
    g.appendChild(reset);
  }

  buildBackgroundPicker() {
    const c = document.getElementById('bg-picker-grid'); if (!c) return;
    c.innerHTML = '';
    this.backgrounds.forEach(bg => {
      const d = document.createElement('div');
      d.className = `bg-option ${this.chatBackground === bg.id ? 'active' : ''}`;
      d.style.background = bg.css || 'var(--bg-chat)';
      d.title = bg.name; d.innerHTML = `<span>${bg.name}</span>`;
      d.addEventListener('click', () => {
        this.setChatBackground(bg.id);
        document.querySelectorAll('.bg-option').forEach(o => o.classList.remove('active'));
        d.classList.add('active');
      });
      c.appendChild(d);
    });
  }

  buildActivityPicker() {
    const c = document.getElementById('activity-picker'); if (!c) return;
    c.innerHTML = '';
    this.activityStatuses.forEach(a => {
      const d = document.createElement('div');
      d.className = `activity-option ${this.user.activityStatus === `${a.emoji} ${a.text}` ? 'active' : ''}`;
      d.innerHTML = `${a.emoji} ${a.text}`;
      d.addEventListener('click', () => {
        this.user.activityStatus = `${a.emoji} ${a.text}`;
        document.querySelectorAll('.activity-option').forEach(o => o.classList.remove('active'));
        d.classList.add('active');
      });
      c.appendChild(d);
    });
    // Кнопка сброса
    const clear = document.createElement('div');
    clear.className = 'activity-option';
    clear.innerHTML = '❌ Убрать';
    clear.addEventListener('click', () => {
      this.user.activityStatus = '';
      document.querySelectorAll('.activity-option').forEach(o => o.classList.remove('active'));
    });
    c.appendChild(clear);
  }

  setAvatarColor(color) {
    this.user.avatarColor = color;
    const av = document.getElementById('profile-avatar-large');
    if (!this.user.avatar?.startsWith('http')) av.style.background = color;
    document.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('active', d.style.backgroundColor === color));
  }

  async uploadAvatar(file) {
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await fetch('/upload', { method: 'POST', body: fd });
      const fi = await r.json();
      this.user.avatar = fi.url;
      const av = document.getElementById('profile-avatar-large');
      av.style.background = `url(${fi.url}) center/cover`; av.textContent = '';
      document.querySelectorAll('.avatar-emoji-option').forEach(o => o.classList.remove('active'));
    } catch (e) { this.showNotification('Ошибка загрузки'); }
  }

  saveProfile() {
    const dn = document.getElementById('profile-displayname').value.trim();
    if (!dn) { this.showNotification('Имя не может быть пустым'); return; }
    this.socket.emit('profile:update', {
      displayName: dn,
      statusText: document.getElementById('profile-status').value.trim(),
      bio: document.getElementById('profile-bio').value.trim(),
      avatarColor: this.user.avatarColor,
      avatar: this.user.avatar,
      activityStatus: this.user.activityStatus,
      invisible: document.getElementById('profile-invisible')?.checked || false,
      doNotDisturb: document.getElementById('profile-dnd')?.checked || false,
      theme: this.currentTheme
    });
    document.getElementById('modal-profile').style.display = 'none';
    this.showNotification('Профиль обновлён ✅');
  }

  // ============================================
  // СТАТИСТИКА
  // ============================================
  showStats() { this.socket.emit('stats:get', { room: this.currentRoom }); }

  showStatsModal(data) {
    let modal = document.getElementById('modal-stats');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-stats'; modal.className = 'modal';
      document.body.appendChild(modal);
    }
    let topHTML = data.topSenders.map((s, i) => `<div class="stat-row"><span class="stat-rank">${i+1}.</span><span class="stat-name">${s.name}</span><span class="stat-count">${s.count} сообщ.</span></div>`).join('');
    modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3><i class="fas fa-chart-bar"></i> Статистика</h3><button class="btn-icon" onclick="document.getElementById('modal-stats').style.display='none'"><i class="fas fa-times"></i></button></div>
    <div class="modal-body"><div class="stats-grid"><div class="stat-card"><div class="stat-number">${data.totalMessages}</div><div class="stat-label">Сообщений</div></div>
    <div class="stat-card"><div class="stat-number">${data.totalMembers}</div><div class="stat-label">Участников</div></div></div>
    <h4 style="margin:16px 0 8px">🏆 Топ отправителей</h4>${topHTML}</div></div>`;
    modal.style.display = 'flex';
  }

  // ============================================
  // ГРУППЫ
  // ============================================
  showGroupModal() {
    const modal = document.getElementById('modal-new-group');
    const mc = document.getElementById('members-select');
    mc.innerHTML = '';
    this.onlineUsers.forEach(u => {
      if (u.username === this.user?.username) return;
      const opt = document.createElement('label');
      opt.className = 'member-option';
      opt.innerHTML = `<input type="checkbox" value="${u.username}"><div class="avatar-colored" style="width:32px;height:32px;background:${u.avatarColor||'#6c5ce7'};font-size:13px">${u.displayName.charAt(0).toUpperCase()}</div><span>${u.displayName}</span>`;
      mc.appendChild(opt);
    });
    modal.style.display = 'flex';
  }

  createGroup() {
    const name = document.getElementById('group-name-input').value.trim();
    if (!name) { this.showNotification('Введите название'); return; }
    const members = Array.from(document.querySelectorAll('#members-select input:checked')).map(c => c.value);
    const isSecret = document.getElementById('group-secret')?.checked || false;
    const password = isSecret ? document.getElementById('group-password')?.value : null;
    this.socket.emit('room:create', { name, type: 'group', members, isSecret, secretPassword: password, description: document.getElementById('group-desc')?.value || '' });
    document.getElementById('modal-new-group').style.display = 'none';
    document.getElementById('group-name-input').value = '';
  }

  getInviteLink() {
    const room = this.rooms.get(this.currentRoom);
    if (!room?.inviteCode) return;
    const link = `${window.location.origin}/invite/${room.inviteCode}`;
    navigator.clipboard.writeText(link).then(() => this.showNotification('Ссылка скопирована: ' + link));
  }

  // ============================================
  // МОДЕРАЦИЯ
  // ============================================
  banUser(username) {
    if (!confirm(`Заблокировать ${username}?`)) return;
    this.socket.emit('room:ban', { roomId: this.currentRoom, username });
  }

  muteUser(username, muted) {
    this.socket.emit('room:mute', { roomId: this.currentRoom, username, muted });
  }

  setRole(username, role) {
    this.socket.emit('room:set-role', { roomId: this.currentRoom, username, role });
  }

  blockUser(username) {
    if (!confirm(`Заблокировать ${username}?`)) return;
    this.socket.emit('user:block', { username });
  }

  // ============================================
  // ЗВУК / ЭМОДЗИ / ФАЙЛЫ
  // ============================================
  bindSoundSelector() {
    const btn = document.getElementById('btn-sound');
    const dd = document.getElementById('sound-dropdown');
    btn.addEventListener('click', (e) => { e.stopPropagation(); dd.classList.toggle('show'); });
    document.querySelectorAll('.sound-option').forEach(o => {
      o.addEventListener('click', (e) => {
        if (e.target.closest('.btn-play')) return;
        this.selectedSound = o.dataset.sound;
        document.querySelectorAll('.sound-option').forEach(x => x.classList.remove('active'));
        o.classList.add('active');
        btn.classList.toggle('has-sound', o.dataset.sound !== 'default');
        dd.classList.remove('show');
      });
    });
    document.querySelectorAll('.btn-play').forEach(p => p.addEventListener('click', (e) => { e.stopPropagation(); this.playSound(p.dataset.sound); }));
    document.addEventListener('click', () => dd.classList.remove('show'));
  }

  showSoundNotification(type) {
    const s = this.soundMap[type]; if (!s) return;
    const n = document.getElementById('sound-notification');
    document.getElementById('sound-notif-text').textContent = `${s.emoji} ${s.name}!`;
    n.style.display = 'block'; setTimeout(() => n.style.display = 'none', 3000);
  }

  showNotification(text) {
    const n = document.getElementById('sound-notification');
    document.getElementById('sound-notif-text').textContent = text;
    n.style.display = 'block'; setTimeout(() => n.style.display = 'none', 3000);
  }

  bindEmojiPicker() {
    const btn = document.getElementById('btn-emoji');
    const picker = document.getElementById('emoji-picker');
    btn.addEventListener('click', (e) => { e.stopPropagation(); picker.style.display = picker.style.display === 'none' ? 'block' : 'none'; });
    document.addEventListener('click', () => picker.style.display = 'none');
    picker.addEventListener('click', (e) => e.stopPropagation());
  }

  buildEmojiGrid() {
    const grid = document.querySelector('.emoji-grid'); if (!grid) return;
    grid.innerHTML = '';
    for (const [category, emojis] of Object.entries(this.emojiCategories)) {
      const catDiv = document.createElement('div');
      catDiv.className = 'emoji-category';
      catDiv.innerHTML = `<div class="emoji-cat-title">${category}</div>`;
      const emojiRow = document.createElement('div');
      emojiRow.className = 'emoji-cat-grid';
      emojis.forEach(e => {
        const s = document.createElement('span');
        s.textContent = e;
        s.addEventListener('click', () => {
          document.getElementById('message-input').value += e;
          document.getElementById('message-input').focus();
        });
        emojiRow.appendChild(s);
      });
      catDiv.appendChild(emojiRow);
      grid.appendChild(catDiv);
    }
  }

  bindFileUpload() {
    document.getElementById('btn-attach').addEventListener('click', () => document.getElementById('file-input').click());
    document.getElementById('file-input').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const fd = new FormData(); fd.append('file', f);
      try {
        const r = await fetch('/upload', { method: 'POST', body: fd });
        const fi = await r.json();
        this.socket.emit('message:send', { type: f.type.startsWith('image/') ? 'image' : 'file', content: '', room: this.currentRoom, sendSound: this.selectedSound, file: fi });
      } catch (e) { this.showNotification('Ошибка загрузки'); }
      e.target.value = '';
    });
    document.getElementById('avatar-file-input')?.addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (!f.type.startsWith('image/')) { this.showNotification('Выберите изображение'); return; }
      this.uploadAvatar(f); e.target.value = '';
    });
  }

  // ============================================
  // ОТВЕТ / ПЕЧАТЬ / УТИЛИТЫ
  // ============================================
  setReply(id, content) {
    this.replyingTo = { id, content: content || '' };
    document.getElementById('reply-preview').style.display = 'flex';
    document.getElementById('reply-text').textContent = (content || '').substring(0, 50);
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
    this.typingTimeout = setTimeout(() => this.socket.emit('typing:stop', { room: this.currentRoom }), 2000);
  }

  scrollToBottom() {
    const c = document.getElementById('messages-container');
    setTimeout(() => c.scrollTop = c.scrollHeight, 50);
  }

  escapeHTML(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

  formatSize(b) {
    if (b < 1024) return b + ' Б';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' КБ';
    return (b / 1048576).toFixed(1) + ' МБ';
  }
}

// ============================================
// ЗАПУСК
// ============================================
const app = new PulseMessenger();