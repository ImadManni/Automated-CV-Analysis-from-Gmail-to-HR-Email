/**
 * Injecte scripts/n8n-parse-llm-json.js dans le nœud « 11 - Parse LLM JSON » d’un export n8n.
 * Usage : node scripts/patch-n8n-parse-node.mjs n8n-workflow-imap-openai-in-n8n4.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const workflowFile = process.argv[2] || 'n8n-workflow-imap-openai-in-n8n4.json'
const workflowPath = path.isAbsolute(workflowFile) ? workflowFile : path.join(root, workflowFile)
const jsPath = path.join(root, 'scripts', 'n8n-parse-llm-json.js')

const js = fs.readFileSync(jsPath, 'utf8')
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'))
const node = workflow.nodes.find((n) => n.name === '11 - Parse LLM JSON')
if (!node) {
  console.error('Node "11 - Parse LLM JSON" not found')
  process.exit(1)
}
node.parameters.jsCode = js
fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2) + '\n')
console.log('Updated', workflowPath)
