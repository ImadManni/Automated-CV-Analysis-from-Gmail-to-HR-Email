const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const assetsDir = path.join(root, 'assets')
const publicDir = path.join(root, 'public')
const publicAssetsDir = path.join(publicDir, 'assets')

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true })
if (!fs.existsSync(publicAssetsDir)) fs.mkdirSync(publicAssetsDir, { recursive: true })

let copied = 0

// 1) Copier PCA.png de la racine vers public/assets/PCA.png
const rootPca = path.join(root, 'PCA.png')
if (fs.existsSync(rootPca)) {
  fs.copyFileSync(rootPca, path.join(publicAssetsDir, 'PCA.png'))
  copied++
  console.log('Copié: PCA.png (racine -> public/assets/)')
}

// 2) Copier les images hero depuis la racine si présentes
const heroNames = ['PCA WORKSPACE 1.jpg', 'PCA WORKSPACE 2.jpg', 'PCA WORKSPACE.jpg']
for (const name of heroNames) {
  const src = path.join(root, name)
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(publicAssetsDir, name))
    copied++
    console.log('Copié:', name)
  }
}

// 3) Copier tout le dossier assets/ vers public/assets/
if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir)
  for (const file of files) {
    const src = path.join(assetsDir, file)
    const dest = path.join(publicAssetsDir, file)
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, dest)
      copied++
      console.log('Copié:', file)
    }
  }
}

console.log(copied ? `\n${copied} fichier(s) -> public/assets/` : 'Aucun fichier copié. Mettez PCA.png à la racine ou dans assets/.')
process.exit(0)
