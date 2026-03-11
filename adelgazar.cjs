const fs = require('fs');
const path = require('path');

const backupPath = './public/data/db.json'; 
const outputPath = './public/data/db.json';
const imagesDir = path.join(__dirname, 'public/images/noticias');

if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
let imgCount = 0;

// Función para extraer base64 de cualquier string
const extractBase64 = (text, id) => {
    if (typeof text !== 'string' || !text.includes('data:image')) return text;
    
    // Buscamos patrones de base64
    const regex = /data:image\/[^;]+;base64,[^"'\s)]+/g;
    return text.replace(regex, (match) => {
        const extension = match.split(';')[0].split('/')[1] || 'jpg';
        const fileName = `extra-img-${Date.now()}-${imgCount++}.${extension}`;
        const filePath = path.join(imagesDir, fileName);
        
        const base64Data = match.replace(/^data:image\/\w+;base64,/, "");
        fs.writeFileSync(filePath, base64Data, 'base64');
        
        return `/images/noticias/${fileName}`;
    });
};

console.log("🧼 Iniciando limpieza profunda de 26MB de texto...");

data.articles = data.articles.map((article, index) => {
    // 1. Limpiar Portada
    article.imageUrl = extractBase64(article.imageUrl, `art-${index}`);
    
    // 2. Limpiar Contenido (Texto del editor)
    article.content = extractBase64(article.content, `cont-${index}`);
    article.fullContent = extractBase64(article.fullContent, `full-${index}`);
    
    // 3. Limpiar Galería
    if (article.contentImages && Array.isArray(article.contentImages)) {
        article.contentImages = article.contentImages.map(img => ({
            ...img,
            url: extractBase64(img.url, `gal-${index}`)
        }));
    }
    return article;
});

fs.writeFileSync(outputPath, JSON.stringify(data));

console.log(`-----------------------------------`);
console.log(`✅ ¡LIMPIEZA COMPLETADA!`);
console.log(`📸 Imágenes nuevas extraídas: ${imgCount}`);
console.log(`💾 Archivo guardado en public/data/db.json`);
console.log(`⚖️ Peso actual: ${Math.round(fs.statSync(outputPath).size / 1024)} KB`);