const fs = require('fs');

const root = process.cwd();
const file = fs
  .readdirSync(root)
  .find((n) => n.startsWith('PCA - IMAP') && n.includes('PCA (7).json'));

if (!file) throw new Error('Workflow file not found');

const path = `${root}/${file}`;
const wf = JSON.parse(fs.readFileSync(path, 'utf8'));
const node = wf.nodes.find((n) => n.name === '12 - Save analysis (PCA API)');
if (!node) throw new Error('Node 12 not found');

const from =
  "school: $json.school, school_type: $json.school_type, phone: $json.phone, experience_count: $json.experience_count, experience_duration: $json.experience_duration, experience_years_avg: $json.experience_years_avg, last_employer: $json.last_employer, candidate_name:";
const to =
  "school: (() => { const s = String($json.school || '').trim(); const city = '(casablanca|mohammedia|rabat|sale|sal[eé]|fes|f[eè]s|meknes|m[èe]knes|agadir|marrakech|tanger|tetouan|t[ée]touan|oujda|kenitra|k[eé]nitra|safi|el jadida|nador|beni mellal|b[eé]ni mellal|temara|t[ée]mara|khemisset|khouribga|guelmim|laayoune|laayoun|dakhla)'; return s.replace(/\\b(cycle|fili[eè]re|g[ée]nie|licence|master|bachelor|bac|classe pr[eé]paratoire|cpge)\\b.*$/i, '').replace(/\\b\\d{1,2}\\s*[\\/.-]\\s*(19|20)\\d{2}\\b/g, '').replace(/\\b(19|20)\\d{2}\\s*[\\/.-]\\s*\\d{1,2}\\b/g, '').replace(/\\b(19|20)\\d{2}\\s*[-–]\\s*(19|20)\\d{2}\\b/g, '').replace(new RegExp('\\\\s*[,\\\\-–—|]\\\\s*' + city + '\\\\s*$', 'i'), '').replace(new RegExp('\\\\s*\\\\(\\\\s*' + city + '\\\\s*\\\\)\\\\s*$', 'i'), '').replace(new RegExp(city + '\\\\s*$', 'i'), '').replace(/\\s{2,}/g, ' ').replace(/\\s*[-–|,()]+\\s*$/g, '').trim() || null; })(), school_type: $json.school_type, phone: $json.phone, experience_count: $json.experience_count, experience_duration: $json.experience_duration, experience_years_avg: $json.experience_years_avg, last_employer: (() => { const s = String($json.last_employer || '').trim(); const city = '(casablanca|mohammedia|rabat|sale|sal[eé]|fes|f[eè]s|meknes|m[èe]knes|agadir|marrakech|tanger|tetouan|t[ée]touan|oujda|kenitra|k[eé]nitra|safi|el jadida|nador|beni mellal|b[eé]ni mellal|temara|t[ée]mara|khemisset|khouribga|guelmim|laayoune|laayoun|dakhla)'; return s.replace(new RegExp('\\\\s*[,\\\\-–—|]\\\\s*' + city + '\\\\s*$', 'i'), '').replace(new RegExp('\\\\s*\\\\(\\\\s*' + city + '\\\\s*\\\\)\\\\s*$', 'i'), '').replace(new RegExp(city + '\\\\s*$', 'i'), '').replace(/\\s{2,}/g, ' ').replace(/\\s*[-–|,()]+\\s*$/g, '').trim() || null; })(), candidate_name:";

if (!node.parameters.jsonBody.includes(from)) {
  throw new Error('Target segment not found in jsonBody');
}

node.parameters.jsonBody = node.parameters.jsonBody.replace(from, to);
fs.writeFileSync(path, JSON.stringify(wf, null, 2), 'utf8');
