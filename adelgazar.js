import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupPath = 'public/backup.json';
const outputPath = './db_ligero.json';
const imagesDir = path.join(__dirname, 'public/images/noticias');

// 1. Verificar si existe el backup
if (!fs.existsSync(backupPath)) {
    console.error("❌ ERROR: No encuentro el archivo backup.json en la raíz.");
    process.exit(1);
}

// 2. Crear carpeta de imágenes si no existe
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
console.log(`🚀 Procesando ${data.articles.length} noticias...`);

data.articles = data.articles.map((article, index) => {
    if (article.image && article.image.startsWith('data:image')) {
        try {
            const extension = article.image.split(';')[0].split('/')[1] || 'jpg';
            const fileName = `noticia-${article.id || index}.${extension}`;
            const filePath = path.join(imagesDir, fileName);

            const base64Data = article.image.replace(/^data:image\/\w+;base64,/, "");
            fs.writeFileSync(filePath, base64Data, 'base64');

            // Cambiamos la imagen pesada por la ruta local
            article.image = `/images/noticias/${fileName}`;
        } catch (err) {
            console.error(`⚠️ Error con la imagen de la noticia ${index}:`, err.message);
        }
    }
    return article;
});

// 3. Guardar el archivo final
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

console.log("----------------------------------------------");
console.log("✅ ¡ÉXITO! Archivo 'db_ligero.json' creado.");
console.log(`📁 Imágenes guardadas en: ${imagesDir}`);
console.log("----------------------------------------------");