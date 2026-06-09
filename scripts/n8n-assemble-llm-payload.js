const cvRes = $input.first().json
const offer = $('7 - Set Offer Context').first().json
const init = $('1 - Initialize Candidate API').first().json
const email = $('2 - Merge (Email + API response)').first().json

const cvText = String(cvRes.text || '')
const offerTitle = String(offer.offerTitle || '')
const offerDescription = String(offer.offerDescription || '')
const subject = String(email.subject || '')
const fromVal = email.from && email.from.value && email.from.value[0]
const fromLine = fromVal ? `${fromVal.name || ''} <${fromVal.address}>`.trim() : String(email.from || '')
const bodySnippet = String(email.text || email.textPlain || '').slice(0, 2500)

const internalMatch =
  typeof offer._offerMatchScore === 'number' && Number.isFinite(offer._offerMatchScore)
    ? offer._offerMatchScore
    : null
const CATALOG_MIN = 18
const offerFromCatalog = internalMatch != null && internalMatch >= CATALOG_MIN

const matchLine =
  internalMatch != null
    ? '\n[Métadonnée PCA — matching sujet email → ligne catalogue] Score interne n8n : ' +
      internalMatch +
      ' (seuil catalogue dans ce workflow : ' +
      CATALOG_MIN +
      '). ' +
      (offerFromCatalog
        ? 'Une offre catalogue a été retenue : le score doit surtout mesurer l’adéquation CV ↔ OFFRE CIBLE (titre + contexte), sans contradiction majeure avec le SUJET (OBJET) du mail.'
        : 'Aucune ligne catalogue suffisamment ferme : le titre OFFRE CIBLE reprend surtout le SUJET du candidat — le score doit surtout mesurer l’adéquation CV ↔ OBJET ; OFFRE CIBLE sert de rappel du même intitulé.')
    : ''

const llmUserMessage = `CONTEXTE EMAIL (message reçu):
Référence A — SUJET (OBJET du mail, intention du candidat) : ${subject}
De: ${fromLine}
Nom API: ${init.candidateName || init.fullName || ''}
Email API: ${init.email || ''}
Extrait corps:
${bodySnippet}

Référence B — OFFRE CIBLE (titre + contexte ; ligne catalogue PCA si matching sujet→catalogue OK, sinon ≈ reformulation du sujet) :
Titre: ${offerTitle}
Contexte: ${offerDescription || '(non renseigné)'}${matchLine}

TEXTE CV (décodé serveur PCA, tronqué) :
${cvText.slice(0, 14000)}

RÈGLE DE NOTATION — score (0-100) et décision (ACCEPTEE / REFUSEE / A REVOIR) :
Tu croises obligatoirement A (OBJET) et B (OFFRE CIBLE) avec le CV.
• Si une offre catalogue a été retenue (voir métadonnée PCA ci-dessus) : le score reflète surtout l’adéquation CV ↔ B ; pénalise fort si le CV est aligné sur un autre métier que B tout en contredisant A ou B.
• Si seul le sujet a été pris comme référence (pas de catalogue ferme) : le score reflète surtout l’adéquation CV ↔ A ; B rappelle le même libellé.
• Toujours pénaliser un décalage métier / stack évident (ex. CV 100 % data vs A/B full-stack, ou l’inverse). Valoriser preuves (projets, expérience, stack) alignées sur la référence prioritaire.
• Ne pas attribuer un score de « bon CV en général » sans lien avec A et B.

RÈGLE last_employer (flux n8n, comme le score — basé sur le TEXTE CV) : entreprise de l’expérience la PLUS RÉCENTE (dates les plus tardives ou en cours). Beaucoup de CV mettent le plus récent en haut : c’est alors la PREMIÈRE entrée de la section expériences, pas la dernière du document. Le nœud « 11 - Parse » recalcule last_employer depuis le texte CV si besoin.

Analyse ce dossier et renvoie uniquement le JSON demandé.`

const systemPrompt = `Tu es un expert RH PCA. Tu fusionnes l'email de candidature et le texte du CV.
Réponds UNIQUEMENT avec un objet JSON valide (sans markdown), avec exactement ces clés :
summary, skills, experience, strengths, risks, score (0-100), decision (une parmi ACCEPTEE, REFUSEE, A REVOIR, NON_LISIBLE), offer_context, school, school_type (PUBLIC, PRIVE ou null), phone, experience_count, experience_duration, experience_years_avg, last_employer, candidate_name
Contraintes de format :
- candidate_name : prénom et nom sur la ligne d'en-tête du CV (souvent 2 mots en MAJUSCULES). INTERDIT : titre de section (« À propos de moi », Formation, Projets, Compétences…), intitulé de poste seul, expéditeur email, « Nom API », nom de fichier.
- skills : string uniquement, compétences séparées par des virgules. Jamais tableau JSON ni accolades type liste.
- experience : string uniquement, paragraphe ou blocs séparés par des retours à la ligne, lisible pour un RH. Jamais JSON imbriqué dans ce champ.
- offer_context : 2 à 4 phrases en français, style fiche RH ; mentionner explicitement le SUJET (OBJET) du candidat, l’OFFRE CIBLE (titre) utilisée pour la note, et si le score suit surtout le catalogue ou surtout le sujet (selon la métadonnée PCA du message utilisateur).
- summary, strengths, risks : prose française.
- score : nombre 0-100 ; appliquer strictement la règle du message utilisateur (croiser A = SUJET et B = OFFRE CIBLE avec le CV, priorité catalogue ou priorité sujet selon la métadonnée). Pas d’évaluation générique.
- decision : cohérente avec ce score et ces références A/B (pas une note « en général »).
- experience_count : emplois ou stages EN entreprise uniquement — pas les projets scolaires sauf « Stage chez Société X ». Étudiant sans emploi réel : 0.
- experience_duration : durée totale cumulée des expériences pro (texte). Vide si experience_count = 0.
- experience_years_avg : moyenne en années par poste = (durée totale en années) / experience_count si experience_count > 0, sinon null.
- last_employer : employeur légal — jamais le titre d'un projet (« E-Commerce Website », « Shopping App »). Si experience_count = 0, chaîne vide. Sinon entreprise de l’expérience la PLUS RÉCENTE (même règle d’ordre que ci-dessus).`

return [
  {
    json: {
      llmUserMessage,
      systemPrompt,
      candidatureId: init.id,
      offerTitle,
      offerDescription,
    },
  },
]
