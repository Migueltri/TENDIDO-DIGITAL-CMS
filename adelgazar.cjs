const fs = require('fs');
const path = require('path');

// 1. ORIGEN: El archivo que pesa 40MB
const backupPath = './db_ligero.json'; 
const imagesDir = path.join(__dirname, 'public/images/noticias');

if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
let contador = 0;

data.articles = data.articles.map((article, index) => {
    // Probamos con imageUrl que es lo que vi en tu captura
    let field = article.imageUrl ? 'imageUrl' : (article.image ? 'image' : null);
    
    if (field && article[field] && article[field].startsWith('data:image')) {
        const extension = article[field].split(';')[0].split('/')[1] || 'jpg';
        const fileName = `noticia-${Date.now()}-${index}.${extension}`;
        const filePath = path.join(imagesDir, fileName);

        const base64Data = article[field].replace(/^data:image\/\w+;base64,/, "");
        fs.writeFileSync(filePath, base64Data, 'base64');

        article[field] = `/images/noticias/${fileName}`;
        contador++;
    }
    return article;
});

// 2. DESTINO: El archivo que DEBE PESAR POCO
fs.writeFileSync('./public/data/db.json', JSON.stringify(data));

console.log(`✅ PROCESO COMPLETADO`);
console.log(`📸 Imágenes extraídas: ${contador}`);
console.log(`💾 El archivo ligero se ha guardado en public/data/db.json`);