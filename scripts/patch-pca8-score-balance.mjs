import fs from 'fs'
import path from 'path'

const root = process.cwd()
const file = fs
  .readdirSync(root)
  .find((n) => n.endsWith('PCA (8).json'))

if (!file) {
  throw new Error('PCA (8).json not found in project root')
}

const fullPath = path.join(root, file)
let raw = fs.readFileSync(fullPath, 'utf8')

const promptNeedle = /const isMobileRole = \/mobile\|react native\|spring boot\|android\|ios\/\.test\(familyScope\);/
const promptBlock =
  "const isPromptRole = /(prompt|llm|rag|agentic|ai agents|evaluation|guardrails)/.test(familyScope); if (isPromptRole) { const promptCoreHit = [/llm|rag|prompt|ai agents|agentic|claude|openai/, /node|javascript|typescript|python|react/, /api|automation|n8n|webhook|docker|azure|gcp/].reduce((n, re) => n + (re.test(profile) ? 1 : 0), 0); const promptProof = /project|projet|experience|stage|intern|automation|api|rag|llm|agent/.test(expText + ' ' + profile); if (promptCoreHit >= 2) adjusted = Math.max(adjusted, 62); if (promptCoreHit >= 3 && promptProof) adjusted = Math.max(adjusted, 70); if (promptCoreHit <= 1) adjusted = Math.min(adjusted, 60); } const isMobileRole = /mobile|react native|spring boot|android|ios/.test(familyScope);"

let count1 = 0
raw = raw.replace(promptNeedle, () => {
  count1 += 1
  return promptBlock
})

const tailNeedle = /adjusted = Math\.min\(adjusted, 90\); return Math\.max\(0, Math\.min\(100, adjusted\)\);/
const tailBlock =
  'if (base >= 75 && hasGlobalProfileSignal && adjusted < 58) adjusted = 58; if (base <= 45 && !hasGlobalProfileSignal && adjusted > 70) adjusted = 65; adjusted = Math.min(adjusted, 90); return Math.max(0, Math.min(100, adjusted));'
let count2 = 0
raw = raw.replace(tailNeedle, () => {
  count2 += 1
  return tailBlock
})

if (count1 === 0 && !raw.includes('const isPromptRole = /(prompt|llm|rag|agentic|ai agents|evaluation|guardrails)/.test(familyScope);')) {
  throw new Error('Prompt-role insertion failed')
}
if (count2 === 0 && !raw.includes('if (base >= 75 && hasGlobalProfileSignal && adjusted < 58) adjusted = 58;')) {
  throw new Error('Stability-tail insertion failed')
}

fs.writeFileSync(fullPath, raw, 'utf8')
