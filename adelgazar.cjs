const fs = require('fs');
const path = require('path');

const dbPath = './public/data/db.json';

try {
    if (!fs.existsSync(dbPath)) {
        console.error("❌ No existe db.json");
        process.exit(1);
    }

    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    // Función de limpieza ultra-segura
    const clean = (text) => {
        if (!text || typeof text !== 'string') return "";
        return text.replace(/style="[^"]*"/g, "").replace(/class="[^"]*"/g, "").replace(/<span[^>]*>/g, "").replace(/<\/span>/g, "").replace(//g, "").replace(/\s+/g, " ").trim();
    };

    console.log("🧼 Limpiando textos...");
    
    if (db.articles) {
        db.articles.forEach(a => {
            if (a.content) a.content = clean(a.content);
            if (a.fullContent) a.fullContent = clean(a.fullContent);
        });
    }

    if (db.archivedArticles) {
        db.archivedArticles.forEach(a => {
            if (a.content) a.content = clean(a.content);
        });
    }

    fs.writeFileSync(dbPath, JSON.stringify(db));
    const size = fs.statSync(dbPath).size / 1024;
    
    console.log(`✅ ¡CONSEGUIDO! Peso final: ${size.toFixed(2)} KB`);

} catch (e) {
    console.error("❌ Error:", e.message);
}