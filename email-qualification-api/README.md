# Email Qualification API

API REST pour qualifier les adresses email et identifier les leads B2B privés vs personal/education/government.

## Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev

# Run tests
npm test

# Build
npm run build

# Production
npm start
```

## Docker

```bash
# Build and run
docker-compose up -d

# Development mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## API Usage

### Qualify an email

```bash
curl -X POST http://localhost:3000/v1/qualify-email \
  -H "Content-Type: application/json" \
  -H "X-API-Key: eq_test_00000000000000000000000000000000" \
  -d '{"email": "john@company.com"}'
```

### Response

```json
{
  "verdict": "private_b2b",
  "is_business_email": true,
  "is_private_b2b": true,
  "confidence": 0.85,
  "flags": [],
  "reasons": ["Domain not in personal/disposable/edu/gov lists"],
  "domain": {
    "raw": "company.com",
    "registrable": "company.com",
    "tld": "com"
  },
  "provider_match": null,
  "metadata": {
    "request_id": "req_abc12345",
    "timestamp": "2024-03-15T10:00:00.000Z",
    "latency_ms": 15,
    "cache_hit": false,
    "mx_checked": false,
    "mx_records_count": null,
    "list_versions": { ... }
  }
}
```

## Documentation

- [Full Specification](docs/SPECIFICATION.md)
- [OpenAPI Schema](openapi.yaml)

---

# CHECKLIST: Prêt Production

## Sécurité

- [ ] Remplacer `API_KEY_SALT` par une valeur sécurisée (32+ caractères aléatoires)
- [ ] Configurer `CORS_ORIGINS` avec les domaines autorisés (pas de wildcard)
- [ ] Activer HTTPS (via reverse proxy / load balancer)
- [ ] Configurer les API keys de production (pas les clés de dev)
- [ ] Vérifier les rate limits appropriés par tier
- [ ] Activer les headers de sécurité (helmet est déjà configuré)
- [ ] Auditer les dépendances (`npm audit`)

## Infrastructure

- [ ] Redis configuré avec persistence (AOF activé)
- [ ] Health checks configurés pour orchestrateur (K8s, ECS, etc.)
- [ ] Logs structurés vers système centralisé (Datadog, ELK, etc.)
- [ ] Métriques exportées (Prometheus endpoint ou agent)
- [ ] Alerting configuré (latence p95, error rate, rate limits)
- [ ] Backup strategy pour Redis
- [ ] Auto-scaling configuré (CPU > 70%, Memory > 80%)

## Performance

- [ ] Cache Redis connecté et fonctionnel
- [ ] Listes chargées au démarrage (warmup)
- [ ] Timeouts DNS configurés (2s par défaut)
- [ ] Circuit breaker MX testé
- [ ] Benchmark p95 < 100ms (sans MX), < 500ms (avec MX)

## Données

- [ ] Listes à jour (personal, disposable, education, government)
- [ ] Mécanisme de mise à jour des listes configuré
- [ ] Versioning des listes activé
- [ ] Stratégie de rollback testée

## Monitoring

- [ ] Dashboard latence / throughput
- [ ] Dashboard verdicts par type
- [ ] Alertes sur anomalies (spike de disposable, drop de B2B)
- [ ] Logs d'audit pour compliance

## Tests

- [ ] Tests unitaires passent (>90% coverage)
- [ ] Tests d'intégration passent
- [ ] Tests de charge effectués
- [ ] Tests de non-régression avec dataset réel

---

# CHECKLIST: Intégration Formulaire

## Frontend

```javascript
// 1. Initialiser le client
const qualifier = new EmailQualifier('eq_live_xxx', {
  baseUrl: 'https://api.emailqualify.io',
  timeout: 5000
});

// 2. Intégrer au formulaire
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = form.querySelector('[name="email"]').value;

  try {
    const result = await qualifier.qualify(email, {
      formId: 'contact-sales',
      campaign: getUtmCampaign()
    });

    if (!result.is_private_b2b) {
      showError('Please use your professional email');
      return;
    }

    // Continue submission
    form.submit();

  } catch (err) {
    // Fail open on API errors
    console.warn('Email qualification failed:', err);
    form.submit();
  }
});
```

## Recommandations UX

- [ ] Afficher un loader pendant la validation
- [ ] Message d'erreur clair pour emails personnels
- [ ] Ne pas bloquer si l'API est down (fail open)
- [ ] Timeout client de 5 secondes max
- [ ] Retry automatique 1 fois sur erreur réseau

## Backend (si validation côté serveur)

```javascript
// Express/Node example
app.post('/api/leads', async (req, res) => {
  const { email } = req.body;

  const qualification = await fetch('https://api.emailqualify.io/v1/qualify-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.EMAIL_QUALIFY_API_KEY
    },
    body: JSON.stringify({
      email,
      context: {
        form_id: 'contact-sales',
        ip: req.ip
      },
      options: {
        enable_mx_check: true,
        strict_mode: false
      }
    })
  }).then(r => r.json());

  // Store for analytics
  await analytics.track('Email Qualified', {
    verdict: qualification.verdict,
    confidence: qualification.confidence,
    domain: qualification.domain.registrable
  });

  if (!qualification.is_private_b2b && qualification.confidence > 0.8) {
    return res.status(400).json({
      error: 'Please use a professional email address'
    });
  }

  // Continue processing lead...
});
```

---

# Recommandations pour Itérer

## Court terme (1-2 semaines)

1. **Monitoring des faux positifs**
   - Logger tous les verdicts avec domain
   - Créer un dashboard des "unknown" par domaine
   - Review manuel des top 100 domaines "unknown"

2. **Enrichir les listes**
   - Intégrer la liste complète SWOT pour l'éducation
   - Ajouter plus de domaines gov par pays
   - Intégrer une liste disposable plus complète

3. **Feedback loop**
   - Endpoint pour reporter faux positifs/négatifs
   - Queue de review pour améliorer les listes

## Moyen terme (1-2 mois)

1. **Intelligence MX**
   - Détecter plus de providers (Zoho, custom, etc.)
   - Heuristique pour domaines parked/unused
   - Score basé sur âge du domaine (WHOIS)

2. **Machine Learning (optionnel)**
   - Classifier les domaines "unknown" automatiquement
   - Détecter patterns de nouvelles startups vs spam

3. **API Features**
   - Endpoint de validation syntax uniquement (rapide)
   - Bulk validation optimisée
   - Webhooks pour résultats asynchrones

## Long terme

1. **Couverture internationale**
   - Listes gov complètes pour tous pays
   - Listes edu complètes (non-US)
   - Support IDN amélioré

2. **Compliance**
   - Mode GDPR strict (zero storage)
   - Audit logs exportables
   - Data residency options

3. **Intégrations**
   - SDK officiel JS/Python/Go
   - Plugins CRM (Salesforce, HubSpot)
   - Zapier/Make integration

---

## Project Structure

```
email-qualification-api/
├── src/
│   ├── config/
│   │   └── env.ts           # Environment configuration
│   ├── middleware/
│   │   ├── auth.ts          # API key authentication
│   │   └── rateLimit.ts     # Rate limiting
│   ├── routes/
│   │   ├── qualify.ts       # Main qualification endpoint
│   │   └── health.ts        # Health check endpoints
│   ├── services/
│   │   ├── domainParser.ts  # Email/domain parsing (PSL)
│   │   ├── listMatcher.ts   # List matching logic
│   │   ├── mxLookup.ts      # DNS MX lookup
│   │   └── scoring.ts       # Confidence scoring
│   ├── types/
│   │   └── index.ts         # TypeScript types
│   └── server.ts            # Fastify server setup
├── tests/
│   ├── testData.ts          # Test email dataset
│   ├── domainParser.test.ts
│   ├── listMatcher.test.ts
│   ├── scoring.test.ts
│   └── integration.test.ts
├── docs/
│   └── SPECIFICATION.md     # Full product spec
├── openapi.yaml             # OpenAPI 3.0 schema
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## License

Proprietary - All rights reserved
