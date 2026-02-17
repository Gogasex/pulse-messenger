// ============================================
// PULSE MESSENGER — Клиентская логика
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

    // Звуки отправки (уникальная фишка!)
    this.soundMap = {
      default:  { name: 'Обычный',        emoji: '🔔', color: '#6c5ce7' },
      birthday: { name: 'День рождения',  emoji: '🎂', color: '#fdcb6e' },
      funny:    { name: 'Смешной',        emoji: '😂', color: '#00b894' },
      urgent:   { name: 'Срочно!',        emoji: '🚨', color: '#ff7675' },
      romantic: { name: 'Романтика',      emoji: '❤️', color: '#e17055' },
      applause: { name: 'Аплодисменты',   emoji: '👏', color: '#00cec9' },
      none:     { name: 'Без звука',      emoji: '🔇', color: '#636e72' }
    };

    // Эмодзи для пикера
    this.emojis = [
      '😀','😂','🤣','😊','😍','🥰','😘','😎',
      '🤔','😏','😢','😭','😡','🤯','🥳','🤩',
      '👍','👎','👋','🤝','💪','🙏','❤️','🔥',
      '⭐','🎉','🎂','🎈','🎁','🏆','💎','🌟',
      '✅','❌','⚡','💬','📱','🎵','🎸','🎮',
      '🍕','🍔','☕','🍺','🌮','🍰','🍭','🫡',
      '👀','💀','🗿','🐸','🦄','🐱','🐶','🦊'
    ];

    // Генерация простых звуков через Web Audio API
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
  // АУДИО — Генерация звуков (без файлов!)
  // ============================================
  getAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  playSound(soundType) {
    if (soundType === 'none') return;

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
  }

  playTone(ctx, frequencies, durations, type = 'sine') {
    let startTime = ctx.currentTime;
    frequencies.forEach((freq, i) => {
      if (freq === 0) {
        startTime += durations[i];
        return;
      }
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
  // СОБЫТИЯ ВХОДА
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
  // ПОДКЛЮЧЕНИЕ К СЕРВЕРУ
  // ============================================
  connect(username, displayName) {
    this.socket = io(window.location.origin);

    this.socket.on('connect', () => {
      console.log('🟢 Подключено к серверу');

      this.socket.emit('user:join', {
        username,
        displayName
      });
    });

    // Успешный вход
    this.socket.on('user:joined', (data) => {
      this.user = data.user;
      this.showMainScreen();
      this.updateMyProfile();

      // Загрузка комнат
      data.rooms.forEach(room => {
        this.rooms.set(room.id, room);
      });
      this.renderChatList();

      // Загрузка сообщений
      data.messages.forEach(msg => this.renderMessage(msg));
      this.scrollToBottom();
    });

    // Новое сообщение
    this.socket.on('message:new', (message) => {
      this.renderMessage(message);
      this.scrollToBottom();

      // 🔊 ВОСПРОИЗВОДИМ ЗВУК ОТПРАВКИ!
      if (message.sender.id !== this.socket.id && message.sendSound && message.sendSound !== 'default') {
        this.playSound(message.sendSound);
        this.showSoundNotification(message.sendSound);
      } else if (message.sender.id !== this.socket.id) {
        this.playSound('default');
      }
    });

    // Обновление пользователей
    this.socket.on('users:update', (users) => {
      this.onlineUsers = users;
      this.renderUsersList();
    });

    // Печатает...
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
      this.updateMessageReactions(data.messageId, data.reactions);
    });

    // Новая комната
    this.socket.on('room:created', (room) => {
      this.rooms.set(room.id, room);
      this.renderChatList();
    });

    // Присоединение к комнате
    this.socket.on('room:joined', (data) => {
      this.rooms.set(data.room.id, data.room);
      this.switchRoom(data.room.id);
      data.messages.forEach(msg => this.renderMessage(msg));
    });

    // ЛС открыто
    this.socket.on('dm:opened', (data) => {
      this.rooms.set(data.room.id, data.room);
      this.renderChatList();
      this.switchRoom(data.room.id);
      data.messages.forEach(msg => this.renderMessage(msg));
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

    // Отправка по Enter
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Клик отправить
    sendBtn.addEventListener('click', () => this.sendMessage());

    // Автовысота textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';

      // Индикатор печати
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
  // ОТПРАВКА СООБЩЕНИЯ
  // ============================================
  sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();

    if (!content && !this.pendingFile) return;

    const messageData = {
      type: this.pendingFile ? 'file' : 'text',
      content: content,
      room: this.currentRoom,
      sendSound: this.selectedSound, // ✨ ЗВУК ОТПРАВКИ!
      replyTo: this.replyingTo,
      file: this.pendingFile || null
    };

    this.socket.emit('message:send', messageData);

    // Очистка
    input.value = '';
    input.style.height = 'auto';
    this.pendingFile = null;
    this.cancelReply();

    // Стоп печатание
    this.socket.emit('typing:stop', { room: this.currentRoom });
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

    const isOwn = message.sender.id === this.socket?.id;

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isOwn ? 'own' : ''}`;
    msgDiv.dataset.messageId = message.id;

    // Аватар (только для чужих)
    const avatarHTML = isOwn ? '' : `
      <div class="avatar-small">
        ${message.sender.displayName?.charAt(0).toUpperCase() || '?'}
      </div>
    `;

    // Бейдж звука
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

    // Файл / изображение
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

    // Реакции
    const reactionsHTML = this.renderReactions(message.id, message.reactions);

    // Время
    const time = new Date(message.timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });

    msgDiv.innerHTML = `
      ${avatarHTML}
      <div class="message-bubble">
        ${!isOwn ? `<div class="message-sender">${message.sender.displayName}</div>` : ''}
        ${soundBadgeHTML}
        ${replyHTML}
        ${message.content ? `<div class="message-text">${this.escapeHTML(message.content)}</div>` : ''}
        ${fileHTML}
        ${reactionsHTML}
        <div class="message-time">${time}</div>

        <!-- Быстрые реакции -->
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
          ${emoji}
          <span class="reaction-count">${users.length}</span>
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
      const timeEl = bubble.querySelector('.message-time');
      timeEl.insertAdjacentHTML('beforebegin', newReactionsHTML);
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
  // СПИСОК ЧАТОВ
  // ============================================
  renderChatList() {
    const container = document.getElementById('chat-list');
    container.innerHTML = '';

    this.rooms.forEach((room) => {
      const item = document.createElement('div');
      item.className = `chat-item ${room.id === this.currentRoom ? 'active' : ''}`;

      const icon = room.type === 'direct' ? 'fa-user' : 'fa-users';
      const initial = room.name.replace(/[^\w\u0400-\u04FF]/g, '').charAt(0).toUpperCase() || '?';

      item.innerHTML = `
        <div class="avatar-small">${initial}</div>
        <div class="chat-item-info">
          <div class="chat-item-name">${room.name}</div>
          <div class="chat-item-last">${room.type === 'direct' ? 'Личные сообщения' : `${room.members.length} участников`}</div>
        </div>
      `;

      item.addEventListener('click', () => {
        this.switchRoom(room.id);
      });

      container.appendChild(item);
    });
  }

  switchRoom(roomId) {
    this.currentRoom = roomId;
    const room = this.rooms.get(roomId);

    // Обновляем заголовок
    document.getElementById('chat-name').textContent = room?.name || 'Чат';
    document.getElementById('chat-subtitle').textContent =
      room?.type === 'direct' ? 'Личные сообщения' : `${room?.members?.length || 0} участников`;

    // Очищаем и загружаем сообщения
    document.getElementById('messages-list').innerHTML = '';

    // Присоединяемся к комнате
    this.socket.emit('room:join', { roomId });

    // Обновляем список чатов
    this.renderChatList();
  }

  // ============================================
  // СПИСОК ПОЛЬЗОВАТЕЛЕЙ
  // ============================================
  renderUsersList() {
    const container = document.getElementById('users-list');
    container.innerHTML = '';

    this.onlineUsers.forEach((user) => {
      const item = document.createElement('div');
      item.className = 'user-item';

      const initial = user.displayName.charAt(0).toUpperCase();

      item.innerHTML = `
        <div class="avatar-small" style="position: relative;">
          ${initial}
          <div class="online-dot"></div>
        </div>
        <div class="user-item-info">
          <div class="user-item-name">${user.displayName}</div>
          <div class="user-item-status">${user.statusText || 'В сети'}</div>
        </div>
      `;

      // Клик — открыть ЛС
      if (user.username !== this.user?.username) {
        item.addEventListener('click', () => {
          this.socket.emit('dm:start', { username: user.username });
        });
        item.title = `Написать ${user.displayName}`;
      }

      container.appendChild(item);
    });
  }

  // ============================================
  // 🔊 ЗВУК ОТПРАВКИ
  // ============================================
  bindSoundSelector() {
    const btn = document.getElementById('btn-sound');
    const dropdown = document.getElementById('sound-dropdown');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    // Выбор звука
    document.querySelectorAll('.sound-option').forEach(option => {
      option.addEventListener('click', (e) => {
        if (e.target.closest('.btn-play')) return; // Не закрывать при прослушивании

        const sound = option.dataset.sound;
        this.selectedSound = sound;

        // Обновляем UI
        document.querySelectorAll('.sound-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');

        // Кнопка меняет вид
        if (sound !== 'default') {
          btn.classList.add('has-sound');
        } else {
          btn.classList.remove('has-sound');
        }

        dropdown.classList.remove('show');
      });
    });

    // Кнопки прослушивания
    document.querySelectorAll('.btn-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sound = btn.dataset.sound;
        this.playSound(sound);
      });
    });

    // Закрытие по клику снаружи
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

    setTimeout(() => {
      notif.style.display = 'none';
    }, 3000);
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

    picker.addEventListener('click', (e) => {
      e.stopPropagation();
    });
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
        const response = await fetch('/upload', {
          method: 'POST',
          body: formData
        });

        const fileInfo = await response.json();

        // Отправляем сообщение с файлом
        this.socket.emit('message:send', {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          content: '',
          room: this.currentRoom,
          sendSound: this.selectedSound,
          file: fileInfo
        });

      } catch (err) {
        console.error('Ошибка загрузки:', err);
        alert('Ошибка загрузки файла');
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
    if (!name) return alert('Введите название группы');

    const checkboxes = document.querySelectorAll('#members-select input:checked');
    const members = Array.from(checkboxes).map(cb => cb.value);

    this.socket.emit('room:create', {
      name,
      type: 'group',
      members
    });

    document.getElementById('modal-new-group').style.display = 'none';
    document.getElementById('group-name-input').value = '';
  }

  // ============================================
  // ОТВЕТ НА СООБЩЕНИЕ
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
  // ПЕЧАТАЕТ...
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
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 50);
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
// ЗАПУСК!
// ============================================
const app = new PulseMessenger();