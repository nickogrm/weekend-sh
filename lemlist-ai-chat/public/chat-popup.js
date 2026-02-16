/**
 * Chat Popup - lemlist AI Chat
 * Script principal pour le popup de chat avec Claude
 */

(function() {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  const CONFIG = {
    apiEndpoint: '/api/chat',
    resetEndpoint: '/api/reset',
    messageLimit: 5,
  };

  // ============================================
  // État de l'application
  // ============================================
  let state = {
    isOpen: false,
    isLoading: false,
    messageCount: 0,
    conversationId: generateConversationId(),
    messages: [],
    pageContent: null,
  };

  // ============================================
  // Utilitaires
  // ============================================

  /**
   * Génère un ID unique pour la conversation
   */
  function generateConversationId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Extrait le contenu textuel de la page
   */
  function extractPageContent() {
    // Clone le body pour éviter de modifier l'original
    const bodyClone = document.body.cloneNode(true);

    // Supprime les éléments qu'on ne veut pas inclure
    const elementsToRemove = bodyClone.querySelectorAll(
      'script, style, nav, footer, .chat-popup, .chat-trigger-btn, noscript, iframe'
    );
    elementsToRemove.forEach(el => el.remove());

    // Récupère le texte
    let text = bodyClone.innerText || bodyClone.textContent;

    // Nettoie le texte (supprime les espaces multiples et lignes vides)
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    // Limite la taille pour éviter les tokens excessifs
    const maxLength = 8000;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '... [contenu tronqué]';
    }

    console.log('📄 Contenu de la page extrait:', text.length, 'caractères');
    return text;
  }

  /**
   * Échappe les caractères HTML
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Convertit le markdown basique en HTML
   */
  function parseMarkdown(text) {
    return text
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code inline
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Line breaks
      .replace(/\n/g, '<br>');
  }

  // ============================================
  // Création du DOM
  // ============================================

  /**
   * Crée le bouton CTA
   */
  function createTriggerButton() {
    const btn = document.createElement('button');
    btn.className = 'chat-trigger-btn';
    btn.setAttribute('aria-label', 'Ouvrir le chat');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
      </svg>
    `;
    btn.addEventListener('click', toggleChat);
    document.body.appendChild(btn);
    return btn;
  }

  /**
   * Crée le popup de chat
   */
  function createChatPopup() {
    const popup = document.createElement('div');
    popup.className = 'chat-popup';
    popup.innerHTML = `
      <!-- Header -->
      <div class="chat-header">
        <div class="chat-header-title">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          <span>Chat avec Claude</span>
        </div>
        <button class="chat-close-btn" aria-label="Fermer le chat">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <!-- Messages -->
      <div class="chat-messages" id="chatMessages">
        <div class="chat-welcome">
          <div class="chat-welcome-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
          </div>
          <h3>Bonjour ! 👋</h3>
          <p>Je suis Claude, votre assistant IA. Posez-moi des questions sur le contenu de cette page.</p>
        </div>
      </div>

      <!-- Input Area -->
      <div class="chat-input-area">
        <div class="chat-input-container">
          <textarea
            class="chat-input"
            id="chatInput"
            placeholder="Posez votre question..."
            rows="1"
          ></textarea>
          <button class="chat-send-btn" id="chatSendBtn" aria-label="Envoyer">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
        <div class="chat-counter" id="chatCounter">
          ${CONFIG.messageLimit} messages restants
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    // Event listeners
    popup.querySelector('.chat-close-btn').addEventListener('click', toggleChat);
    popup.querySelector('#chatSendBtn').addEventListener('click', sendMessage);

    const input = popup.querySelector('#chatInput');
    input.addEventListener('keypress', handleKeyPress);
    input.addEventListener('input', autoResizeTextarea);

    return popup;
  }

  // ============================================
  // Gestion du chat
  // ============================================

  /**
   * Ouvre/ferme le chat
   */
  function toggleChat() {
    state.isOpen = !state.isOpen;

    const popup = document.querySelector('.chat-popup');
    const btn = document.querySelector('.chat-trigger-btn');

    if (state.isOpen) {
      popup.classList.add('open');
      btn.classList.add('chat-open');

      // Extrait le contenu de la page si pas encore fait
      if (!state.pageContent) {
        state.pageContent = extractPageContent();
      }

      // Focus sur l'input
      setTimeout(() => {
        document.querySelector('#chatInput').focus();
      }, 300);

      console.log('💬 Chat ouvert');
    } else {
      popup.classList.remove('open');
      btn.classList.remove('chat-open');
      console.log('💬 Chat fermé');
    }
  }

  /**
   * Gère l'appui sur Entrée
   */
  function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  /**
   * Redimensionne automatiquement le textarea
   */
  function autoResizeTextarea(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
  }

  /**
   * Ajoute un message à l'affichage
   */
  function addMessage(content, type = 'user') {
    const messagesContainer = document.querySelector('#chatMessages');
    const welcome = messagesContainer.querySelector('.chat-welcome');

    // Supprime le message de bienvenue s'il existe
    if (welcome) {
      welcome.remove();
    }

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${type}`;

    if (type === 'assistant') {
      messageEl.innerHTML = parseMarkdown(escapeHtml(content));
    } else {
      messageEl.textContent = content;
    }

    messagesContainer.appendChild(messageEl);

    // Scroll vers le bas
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageEl;
  }

  /**
   * Affiche l'indicateur de frappe
   */
  function showTypingIndicator() {
    const messagesContainer = document.querySelector('#chatMessages');

    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.id = 'typingIndicator';
    typing.innerHTML = '<span></span><span></span><span></span>';

    messagesContainer.appendChild(typing);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Cache l'indicateur de frappe
   */
  function hideTypingIndicator() {
    const typing = document.querySelector('#typingIndicator');
    if (typing) {
      typing.remove();
    }
  }

  /**
   * Met à jour le compteur de messages
   */
  function updateCounter() {
    const counter = document.querySelector('#chatCounter');
    const remaining = CONFIG.messageLimit - state.messageCount;

    counter.textContent = `${remaining} message${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}`;

    if (remaining <= 2 && remaining > 0) {
      counter.className = 'chat-counter warning';
    } else if (remaining === 0) {
      counter.className = 'chat-counter limit-reached';
      counter.textContent = 'Limite atteinte (0 message restant)';
    } else {
      counter.className = 'chat-counter';
    }
  }

  /**
   * Désactive/active l'input
   */
  function setInputEnabled(enabled) {
    const input = document.querySelector('#chatInput');
    const btn = document.querySelector('#chatSendBtn');

    input.disabled = !enabled;
    btn.disabled = !enabled;

    if (!enabled && state.messageCount >= CONFIG.messageLimit) {
      input.placeholder = 'Limite de messages atteinte';
    }
  }

  /**
   * Envoie un message
   */
  async function sendMessage() {
    const input = document.querySelector('#chatInput');
    const message = input.value.trim();

    // Validation
    if (!message || state.isLoading) return;
    if (state.messageCount >= CONFIG.messageLimit) {
      addMessage('Vous avez atteint la limite de 5 messages. Rafraîchissez la page pour recommencer.', 'system error');
      return;
    }

    // Réinitialise l'input
    input.value = '';
    input.style.height = 'auto';

    // Ajoute le message utilisateur
    addMessage(message, 'user');

    // État loading
    state.isLoading = true;
    setInputEnabled(false);
    showTypingIndicator();

    console.log('📤 Envoi du message:', message.substring(0, 50) + '...');

    try {
      const response = await fetch(CONFIG.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          pageContent: state.messageCount === 0 ? state.pageContent : null,
          conversationId: state.conversationId,
          messageCount: state.messageCount,
        }),
      });

      const data = await response.json();

      hideTypingIndicator();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur serveur');
      }

      // Ajoute la réponse
      addMessage(data.reply, 'assistant');

      // Met à jour le compteur
      state.messageCount = data.messageCount;
      state.messages.push({ role: 'user', content: message });
      state.messages.push({ role: 'assistant', content: data.reply });

      updateCounter();

      console.log('📥 Réponse reçue, messages:', state.messageCount + '/' + CONFIG.messageLimit);

      // Vérifie la limite
      if (data.limitReached) {
        setInputEnabled(false);
        addMessage('Vous avez atteint la limite de 5 messages pour cette session.', 'system');
      } else {
        setInputEnabled(true);
        input.focus();
      }

    } catch (error) {
      console.error('❌ Erreur:', error);
      hideTypingIndicator();
      addMessage(`Erreur: ${error.message}`, 'system error');
      setInputEnabled(true);
    }

    state.isLoading = false;
  }

  /**
   * Réinitialise la conversation
   */
  async function resetConversation() {
    try {
      await fetch(CONFIG.resetEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: state.conversationId }),
      });
    } catch (e) {
      console.warn('Erreur reset:', e);
    }

    // Réinitialise l'état
    state.messageCount = 0;
    state.conversationId = generateConversationId();
    state.messages = [];

    // Réinitialise l'UI
    const messagesContainer = document.querySelector('#chatMessages');
    messagesContainer.innerHTML = `
      <div class="chat-welcome">
        <div class="chat-welcome-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
        </div>
        <h3>Bonjour ! 👋</h3>
        <p>Je suis Claude, votre assistant IA. Posez-moi des questions sur le contenu de cette page.</p>
      </div>
    `;

    updateCounter();
    setInputEnabled(true);
    document.querySelector('#chatInput').focus();

    console.log('🔄 Conversation réinitialisée');
  }

  // ============================================
  // Initialisation
  // ============================================

  function init() {
    console.log('🚀 Initialisation du chat lemlist AI...');

    // Crée les éléments du DOM
    createTriggerButton();
    createChatPopup();

    // Expose la fonction de reset pour debug
    window.resetLemlistChat = resetConversation;

    console.log('✅ Chat initialisé avec succès!');
    console.log('💡 Tip: Utilisez window.resetLemlistChat() pour réinitialiser la conversation');
  }

  // Lance l'initialisation quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
