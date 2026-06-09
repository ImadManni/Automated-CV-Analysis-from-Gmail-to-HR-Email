import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(
  'C:/Users/DELL/.cursor/projects/c-Users-DELL-Desktop-screens-Automated-CV-Analysis-from-Gmail-to-HR-Email-IMADPCA/assets'
);
const dst = path.resolve('C:/Users/DELL/Desktop/screens/Imad_Manni_PFE_2026/images');

const map = [
  ['Screenshot_2026-06-08_110112', '00-page-accueil.png'],
  ['Screenshot_2026-04-15_092159', '01-tableau-bord-indicateurs-rh.png'],
  ['Screenshot_2026-04-15_092254', '02-matrice-entretiens-suivi-rh.png'],
  ['Screenshot_2026-04-15_092405', '03-campagnes-recrutement.png'],
  ['Screenshot_2026-04-15_092230', '04-graphiques-assistant-ia.png'],
  ['Screenshot_2026-04-15_092657', '05-planification-entretien-bu.png'],
  ['Screenshot_2026-04-15_092634', '06-email-entretien-n8n.png'],
  ['Screenshot_2026-04-15_092432', '07-offres-campagne.png'],
  ['Screenshot_2026-04-15_092552', '08-fiche-candidat-profil.png'],
  ['Screenshot_2026-04-15_092530', '09-detail-candidature.png'],
  ['Screenshot_2026-04-15_092342', '10-entretiens-planifies.png'],
  ['Screenshot_2026-06-08_112408', 'swagger-api-auth.png'],
  ['Screenshot_2026-06-08_112451', 'swagger-api-candidatures.png'],
  ['Screenshot_2026-06-08_112531', 'swagger-api-rag-campagnes.png'],
];

fs.mkdirSync(dst, { recursive: true });
const assets = fs.readdirSync(src);
const copied = [];

for (const [needle, outName] of map) {
  const match = assets.find((f) => f.includes(needle));
  if (!match) {
    console.error('Missing:', needle);
    continue;
  }
  fs.copyFileSync(path.join(src, match), path.join(dst, outName));
  copied.push(outName);
  console.log('OK', outName);
}

console.log('Copied', copied.length, 'files to', dst);
