/** OpenAPI 3.0 spec pour l’API Candidatures PCA */
export const spec = {
  openapi: '3.0.0',
  info: {
    title: 'API Candidatures PCA',
    description: 'API pour le dashboard PCA — reçoit les candidatures depuis n8n et les sert au frontend.\n\n**Auth (connexion)** — POST /api/auth/signup, POST /api/auth/login, GET /api/auth/google, GET /api/auth/github (renvoient un JWT). Callbacks: /api/auth/google/callback, /api/auth/github/callback.\n\n**Protégé JWT** — GET /api/candidatures (header Authorization: Bearer <token>). GET /api/auth/me (qui est connecté, après login ou OAuth).\n\n**Sans auth** — POST /api/candidatures (n8n), POST /api/rag/chat (auth optionnelle).',
    version: '1.0.0',
  },
  servers: [{ url: 'http://localhost:3005', description: 'API locale' }],
  tags: [
    { name: 'Auth', description: 'Inscription, connexion et OAuth (Google, GitHub) — renvoient un JWT' },
    { name: 'Candidatures', description: 'GET protégé par JWT ; POST public (n8n)' },
    { name: 'RAG', description: 'Chat assistant (auth optionnelle)' },
    { name: 'Campagnes', description: 'Campagnes et offres (Remotive + PostgreSQL)' },
  ],
  paths: {
    '/api/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Inscription',
        description: 'Crée un compte (email + mot de passe). Retourne un JWT pour Authorization: Bearer sur GET /api/candidatures.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 6 },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Compte créé', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, user: { type: 'object' } } } } } },
          400: { description: 'Email déjà utilisé ou champs manquants' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Connexion',
        description: 'Connexion email + mot de passe. Retourne un JWT à utiliser dans Authorization: Bearer pour GET /api/candidatures.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Token JWT', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, user: { type: 'object' } } } } } },
          401: { description: 'Email ou mot de passe incorrect' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Utilisateur connecté',
        description: 'Retourne l’utilisateur actuellement authentifié (JWT requis). Utilisable après connexion par login, signup ou OAuth (Google/GitHub). Utilisez Authorize pour coller votre token.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Profil de l’utilisateur connecté',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        name: { type: 'string', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Non authentifié — token manquant ou invalide' },
        },
      },
    },
    '/api/auth/google': {
      get: {
        tags: ['Auth'],
        summary: 'Connexion Google OAuth',
        description: 'Redirige vers Google puis vers le front avec ?token=JWT. À ouvrir dans le navigateur.',
        responses: { 302: { description: 'Redirection vers Google puis front avec token' } },
      },
    },
    '/api/auth/google/callback': {
      get: {
        tags: ['Auth'],
        summary: 'Callback Google (interne)',
        description: 'Appelé par Google après consentement. Ne pas appeler à la main.',
        parameters: [{ name: 'code', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 302: { description: 'Redirection vers le front avec ?token=...' } },
      },
    },
    '/api/auth/github': {
      get: {
        tags: ['Auth'],
        summary: 'Connexion GitHub OAuth',
        description: 'Redirige vers GitHub puis vers le front avec ?token=JWT. À ouvrir dans le navigateur.',
        responses: { 302: { description: 'Redirection vers GitHub puis front avec token' } },
      },
    },
    '/api/auth/github/callback': {
      get: {
        tags: ['Auth'],
        summary: 'Callback GitHub (interne)',
        description: 'Appelé par GitHub après consentement. Ne pas appeler à la main.',
        parameters: [{ name: 'code', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 302: { description: 'Redirection vers le front avec ?token=...' } },
      },
    },
    '/api/candidatures': {
      get: {
        tags: ['Candidatures'],
        summary: 'Liste des candidatures',
        description: 'Retourne toutes les candidatures. JWT requis : Authorization: Bearer <token> (login, signup ou OAuth).',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Liste des candidatures',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    candidatures: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Candidature' },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Non authentifié — token manquant ou invalide' },
        },
      },
      post: {
        tags: ['Candidatures'],
        summary: 'Ajouter une candidature',
        description: 'Appelé par n8n après analyse du CV. Pas d’auth requise. Ajoute une candidature et la retourne.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CandidatureInput' },
            },
          },
        },
        responses: {
          201: {
            description: 'Candidature créée',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Candidature' },
              },
            },
          },
        },
      },
    },
    '/api/candidatures/{id}': {
      patch: {
        tags: ['Candidatures'],
        summary: 'Mettre à jour la décision d’une candidature (action RH)',
        description:
          'Utilisé par la plateforme RH pour changer la décision globale (ACCEPTÉE, REFUSÉE, À REVOIR, NON_LISIBLE) et éventuellement le score. Déclenche aussi un webhook n8n (si N8N_DECISION_WEBHOOK_URL est configuré) pour notifier le candidat par email.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'ID numérique de la candidature',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  decision: {
                    type: 'string',
                    description: 'Nouvelle décision globale',
                    enum: ['ACCEPTÉE', 'REFUSÉE', 'À REVOIR', 'NON_LISIBLE'],
                  },
                  score: {
                    type: 'number',
                    description: 'Score éventuel associé à la décision',
                    nullable: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Candidature mise à jour',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Candidature' },
              },
            },
          },
          400: { description: 'ID invalide ou body invalide' },
          404: { description: 'Candidature non trouvée' },
        },
      },
    },
    '/api/test/candidatures': {
      get: {
        tags: ['Candidatures'],
        summary: 'Mock: liste des candidatures (debug)',
        description: 'Retourne la liste des candidatures (même format que GET /api/candidatures) sans auth, pour vérifier rapidement les données en base lors des tests n8n.',
        responses: {
          200: {
            description: 'Liste des candidatures (mock)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    candidatures: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Candidature' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Candidatures'],
        summary: 'Mock: ajouter une candidature (test n8n)',
        description: 'Endpoint de test sans auth. Même body que POST /api/candidatures (email, fullName, source). Retourne un objet mock avec candidateId et uploadUrl pour tester le workflow n8n.',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'test@test.com' },
                  fullName: { type: 'string', example: 'Test User' },
                  source: { type: 'string', example: 'email' },
                },
              },
            },
          },
        },
        security: [],
        responses: {
          201: {
            description: 'Candidature mock créée',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    candidateId: { type: 'string' },
                    uploadUrl: { type: 'string' },
                    email: { type: 'string' },
                    candidateName: { type: 'string' },
                    _mock: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/test/analyze': {
      post: {
        tags: ['Candidatures'],
        summary: 'Test : créer candidature + analyser CV (OpenAI)',
        description: 'En un seul appel : crée une candidature test (comme POST /api/test/candidatures) puis lance l’analyse OpenAI avec le texte du CV envoyé dans body.text. Idéal pour tester l’analyse sans MinIO/PDF. Body obligatoire : { "text": "contenu du CV..." } (min 50 caractères).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', minLength: 50, description: 'Texte brut du CV à analyser' },
                  email: { type: 'string', example: 'test@example.com' },
                  fullName: { type: 'string', example: 'Jean Dupont' },
                  subject: { type: 'string', example: 'Candidature Data Engineer' },
                  offerContext: { type: 'string', description: 'Contexte de l\'offre (titre + description) : l\'analyse et le score sont basés sur cette offre' },
                  offerTitle: { type: 'string', example: 'Data Engineer' },
                  offerDescription: { type: 'string', description: 'Profil recherché pour l\'offre (utilisé avec offerTitle si offerContext absent)' },
                },
              },
            },
          },
        },
        security: [],
        responses: {
          201: {
            description: 'Candidature créée et analyse retournée',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    candidature: { type: 'object', properties: { id: { type: 'integer' }, candidateId: { type: 'string' }, candidateName: { type: 'string' }, email: { type: 'string' }, subject: { type: 'string' } } },
                    analysis: { type: 'object', properties: { summary: { type: 'string' }, skills: { type: 'string' }, experience: { type: 'string' }, strengths: { type: 'string' }, risks: { type: 'string' }, score: { type: 'number' }, decision: { type: 'string' } } },
                  },
                },
              },
            },
          },
          400: { description: 'Body "text" manquant ou trop court' },
          503: { description: 'OPENAI_API_KEY non configuré' },
        },
      },
    },
    '/api/candidatures/{id}/analyze': {
      post: {
        tags: ['Candidatures'],
        summary: 'Analyser un CV avec OpenAI',
        description: 'Récupère la candidature par id, extrait le texte du CV (MinIO ou body.text), appelle OpenAI pour analyse (résumé FR, compétences, score, décision), met à jour la candidature en base. Utilisé par n8n après upload du CV. Body optionnel : { "text": "..." } pour fournir le texte du CV directement.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'ID de la candidature' },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Texte brut du CV (si absent, récupéré depuis MinIO)' },
                  offerContext: { type: 'string', description: 'Contexte offre : titre + description (analyse basée sur cette offre)' },
                  offerTitle: { type: 'string' },
                  offerDescription: { type: 'string' },
                },
              },
            },
          },
        },
        security: [],
        responses: {
          200: {
            description: 'Analyse effectuée, candidature mise à jour',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    candidateId: { type: 'string' },
                    analysis: {
                      type: 'object',
                      properties: {
                        summary: { type: 'string' },
                        skills: { type: 'string' },
                        experience: { type: 'string' },
                        strengths: { type: 'string' },
                        risks: { type: 'string' },
                        score: { type: 'number' },
                        decision: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          404: { description: 'Candidature non trouvée' },
          400: { description: 'CV texte manquant ou trop court' },
          503: { description: 'OPENAI_API_KEY non configuré' },
        },
      },
    },
    '/api/campaigns': {
      get: {
        tags: ['Campagnes'],
        summary: 'Lister les campagnes',
        description:
          'Retourne les campagnes de recrutement visibles dans la page Campagnes (ex. REMOTIVE-SW). Les données proviennent de Remotive (remote jobs) et sont synchronisées dans PostgreSQL (table campaigns).',
        responses: {
          200: {
            description: 'Liste des campagnes',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    campaigns: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Campaign' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/campaigns/{id}': {
      get: {
        tags: ['Campagnes'],
        summary: 'Détail d’une campagne',
        description:
          'Retourne le détail d’une campagne par id (ex. "remotive-software-dev"). Si PostgreSQL est activé, la campagne correspond à une ligne dans la table campaigns avec code=REMOTIVE-SW.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Identifiant de la campagne (string)',
          },
        ],
        responses: {
          200: {
            description: 'Campagne trouvée',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    campaign: { $ref: '#/components/schemas/Campaign' },
                  },
                },
              },
            },
          },
          404: { description: 'Campagne non trouvée' },
        },
      },
    },
    '/api/campaigns/{id}/offers': {
      get: {
        tags: ['Campagnes'],
        summary: 'Lister les offres d’une campagne',
        description:
          'Retourne les offres associées à une campagne (ex. Offres remote (Software Dev – Remotive)). Les offres proviennent de Remotive et sont synchronisées dans PostgreSQL (table offers).',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Identifiant de la campagne (string)',
          },
        ],
        responses: {
          200: {
            description: 'Liste des offres',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    offers: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Offer' },
                    },
                  },
                },
              },
            },
          },
          404: { description: 'Campagne non trouvée' },
        },
      },
    },
    '/api/offers/catalog': {
      get: {
        tags: ['Campagnes'],
        summary: 'Catalogue de toutes les offres',
        description:
          'Retourne toutes les offres de toutes les campagnes en un seul appel (liste aplatie). Utilisé par n8n (« Fetch Offers Catalog ») pour le contexte LLM. Sans authentification.',
        security: [],
        responses: {
          200: {
            description: 'Liste plate des offres avec rattachement campagne',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    offers: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CatalogOffer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/rag/chat': {
      post: {
        tags: ['RAG'],
        summary: 'Chat RAG',
        description: 'Assistant questions/réponses. Auth optionnelle : si header Authorization: Bearer présent, le résumé des candidatures est inclus dans le contexte.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: { message: { type: 'string' } },
              },
            },
          },
        },
        security: [],
        responses: {
          200: {
            description: 'Réponse texte',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { answer: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token renvoyé par /api/auth/login, /api/auth/signup, ou OAuth (Google/GitHub)',
      },
    },
    schemas: {
      Campaign: {
        type: 'object',
        properties: {
          id: { type: 'integer', nullable: true, description: 'Identifiant interne de la campagne (si issue de PostgreSQL)' },
          name: { type: 'string', description: 'Nom affiché de la campagne' },
          code: { type: 'string', description: 'Code unique de la campagne (ex. REMOTIVE-SW)' },
          status: { type: 'string', description: 'Statut (active, closed...)' },
          start_date: { type: 'string', nullable: true, format: 'date-time' },
          end_date: { type: 'string', nullable: true, format: 'date-time' },
          results_count: { type: 'integer', nullable: true, description: 'Nombre d’offres associées (si disponible)' },
        },
      },
      Offer: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Identifiant de l’offre (Remotive ou DB)' },
          title: { type: 'string', description: 'Titre de l’offre' },
          reference: { type: 'string', description: 'Référence unique par campagne' },
          location: { type: 'string', nullable: true },
          company: { type: 'string', nullable: true },
          status: { type: 'string', description: 'Statut (active, closed...)' },
          redirect_url: { type: 'string', nullable: true, description: 'Lien pour voir l’offre sur le site externe' },
          created: { type: 'string', nullable: true, description: 'Date de publication (si fournie par Remotive)' },
        },
      },
      CatalogOffer: {
        allOf: [
          { $ref: '#/components/schemas/Offer' },
          {
            type: 'object',
            properties: {
              campaignId: { type: 'string', description: 'Identifiant de la campagne source' },
              campaignName: { type: 'string' },
              campaignCode: { type: 'string' },
            },
          },
        ],
      },
      Candidature: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          candidateName: { type: 'string' },
          email: { type: 'string' },
          subject: { type: 'string' },
          date: { type: 'string' },
          decision: { type: 'string', enum: ['ACCEPTÉE', 'REFUSÉE', 'À REVOIR', 'NON_LISIBLE'] },
          score: { type: 'number', nullable: true },
          skills: { type: 'string', nullable: true },
          experience: { type: 'string', nullable: true },
          rawSummary: { type: 'string', nullable: true },
        },
      },
      CandidatureInput: {
        type: 'object',
        properties: {
          candidateName: { type: 'string' },
          email: { type: 'string' },
          subject: { type: 'string' },
          date: { type: 'string' },
          decision: { type: 'string' },
          score: { type: 'number' },
          skills: { type: 'string' },
          experience: { type: 'string' },
          rawSummary: { type: 'string' },
        },
      },
    },
  },
}
