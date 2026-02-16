// Serveur Express pour le chat AI lemlist
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limite augmentée pour le contenu des pages
app.use(express.static(path.join(__dirname, '../public')));

// Initialisation du client Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Stockage en mémoire des conversations (pour le prototype)
const conversations = new Map();

// Limite de messages par session
const MESSAGE_LIMIT = 5;

/**
 * Endpoint principal pour le chat
 * POST /api/chat
 */
app.post('/api/chat', async (req, res) => {
  console.log('📨 Nouvelle requête chat reçue');

  try {
    const { message, pageContent, conversationId, messageCount } = req.body;

    // Validation des paramètres
    if (!message || !conversationId) {
      console.log('❌ Paramètres manquants');
      return res.status(400).json({
        error: 'Paramètres manquants: message et conversationId sont requis'
      });
    }

    // Vérification de la limite de messages
    const currentCount = messageCount || 0;
    if (currentCount >= MESSAGE_LIMIT) {
      console.log('⚠️ Limite de messages atteinte');
      return res.status(429).json({
        error: 'Limite de messages atteinte (5/5)',
        limitReached: true,
        messageCount: MESSAGE_LIMIT
      });
    }

    console.log(`💬 Message ${currentCount + 1}/${MESSAGE_LIMIT} pour conversation ${conversationId}`);

    // Récupération ou création de l'historique de conversation
    if (!conversations.has(conversationId)) {
      conversations.set(conversationId, []);
    }
    const conversationHistory = conversations.get(conversationId);

    // Construction du message utilisateur
    let userMessage = message;

    // Si c'est le premier message, on inclut le contexte de la page
    if (currentCount === 0 && pageContent) {
      console.log('📄 Premier message - inclusion du contexte de la page');
      userMessage = `Contexte de la page:\n${pageContent}\n\n---\n\nQuestion de l'utilisateur: ${message}`;
    }

    // Ajout du message à l'historique
    conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    // Appel à l'API Anthropic
    console.log('🤖 Appel à Claude...');
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `Tu es un assistant IA intégré aux pages lemlist. Tu aides les utilisateurs à comprendre le contenu de la page qu'ils consultent.

Règles:
- Sois concis et utile dans tes réponses
- Réponds en français
- Base tes réponses sur le contexte de la page fourni
- Si une question sort du contexte de la page, indique-le poliment
- Utilise un ton professionnel mais amical`,
      messages: conversationHistory
    });

    // Extraction de la réponse
    const reply = response.content[0].text;
    console.log('✅ Réponse reçue de Claude');

    // Ajout de la réponse à l'historique
    conversationHistory.push({
      role: 'assistant',
      content: reply
    });

    // Nouveau compteur de messages
    const newMessageCount = currentCount + 1;
    const limitReached = newMessageCount >= MESSAGE_LIMIT;

    if (limitReached) {
      console.log('⚠️ Limite atteinte après ce message');
    }

    // Envoi de la réponse
    res.json({
      reply,
      messageCount: newMessageCount,
      limitReached
    });

  } catch (error) {
    console.error('❌ Erreur serveur:', error);

    // Gestion des erreurs spécifiques Anthropic
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Clé API Anthropic invalide. Vérifiez votre fichier .env'
      });
    }

    if (error.status === 429) {
      return res.status(429).json({
        error: 'Trop de requêtes. Veuillez réessayer dans quelques instants.'
      });
    }

    res.status(500).json({
      error: 'Erreur serveur. Veuillez réessayer.'
    });
  }
});

/**
 * Endpoint pour réinitialiser une conversation
 * POST /api/reset
 */
app.post('/api/reset', (req, res) => {
  const { conversationId } = req.body;

  if (conversationId && conversations.has(conversationId)) {
    conversations.delete(conversationId);
    console.log(`🔄 Conversation ${conversationId} réinitialisée`);
  }

  res.json({ success: true });
});

/**
 * Health check
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.ANTHROPIC_API_KEY
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`
🚀 Serveur lemlist AI Chat démarré!
📍 URL: http://localhost:${PORT}
🔑 API Key configurée: ${process.env.ANTHROPIC_API_KEY ? 'Oui' : 'Non (vérifiez .env)'}
  `);
});
