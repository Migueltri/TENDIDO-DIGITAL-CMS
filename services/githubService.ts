import { AppSettings, Article, Author, ArchivedArticle } from '../types';
import { getArticles, getAuthors, getArchivedArticles, saveArticlesToLocal, saveAuthorsToLocal, saveArchivedArticlesToLocal } from './dataService';

const SETTINGS_KEY = 'td_app_settings';

export const getSettings = (): AppSettings => {
  const stored = localStorage.getItem(SETTINGS_KEY);
  const settings = stored ? JSON.parse(stored) : {};
  
  let filePath = settings.filePath || 'public/data/dataDB.json';
  
  // Limpiamos la condición ilógica que borraba los tokens modernos (github_pat_)
  if (
      settings.repoName === 'Tendido-Digital' || 
      settings.repoName === 'tendido-digital-oficial' ||
      settings.repoOwner === 'MiguelTro'
  ) {
      settings.repoName = 'tendido-digital-cms';
      settings.repoOwner = 'migueltri';
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  
  return {
    githubToken: settings.githubToken || '',
    repoOwner: settings.repoOwner || 'migueltri',
    repoName: settings.repoName || 'tendido-digital-cms',
    filePath: filePath,
    repoBranch: settings.repoBranch || 'main',
    vercelDeployHook: settings.vercelDeployHook || ''
  };
};

export const saveSettings = (settings: AppSettings) => {
  const cleanSettings = {
    ...settings,
    githubToken: settings.githubToken.trim(),
    repoOwner: settings.repoOwner.trim(),
    repoName: settings.repoName.trim(),
    filePath: settings.filePath.trim().replace(/^\//, ''),
    repoBranch: settings.repoBranch?.trim() || 'main',
    vercelDeployHook: settings.vercelDeployHook?.trim() || ''
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(cleanSettings));
};

interface GitHubFileResponse {
  sha: string;
  content: string;
  encoding: string;
  size: number;
}

interface DatabaseSchema {
  articles: Article[];
  authors: Author[];
  archivedArticles?: ArchivedArticle[];
  lastUpdated: string;
}

// --- UTILIDADES DE CODIFICACIÓN (Deben ir arriba) ---

const encodeBase64 = async (str: string): Promise<string> => {
    const bytes = new TextEncoder().encode(str);
    const blob = new Blob([bytes]);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const decodeBase64 = async (b64: string): Promise<string> => {
    const url = `data:application/json;base64,${b64}`;
    const response = await fetch(url);
    return await response.text();
};

// ---------------------------------------------------

const fetchRemoteDB = async (settings: AppSettings): Promise<{ sha: string, data: DatabaseSchema } | null> => {
    if (!settings.githubToken || !settings.repoOwner || !settings.repoName) return null;

    const url = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/${settings.filePath}?ref=${settings.repoBranch}&t=${Date.now()}`;
    
    const response = await fetch(url, {
        headers: { 
            'Authorization': `token ${settings.githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
        },
        cache: 'no-store'
    });

    if (response.status === 404) {
        const repoUrl = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}`;
        const repoRes = await fetch(repoUrl, {
            headers: { 
                'Authorization': `token ${settings.githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (repoRes.status === 404) {
            throw new Error('Repositorio o usuario no encontrado.');
        }
        return null; 
    }
    if (response.status === 401) throw new Error('Token inválido o sin permisos.');
    if (!response.ok) throw new Error(`Error Github (${response.status}): ${response.statusText}`);

    const json: GitHubFileResponse = await response.json();
    
    let rawContent = (json.content || '').replace(/\n/g, '');
    
    if (!rawContent && json.sha && json.size > 0) {
        const blobUrl = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/git/blobs/${json.sha}`;
        const blobRes = await fetch(blobUrl, {
            headers: { 
                'Authorization': `token ${settings.githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            cache: 'no-store'
        });
        if (blobRes.ok) {
            const blobJson = await blobRes.json();
            rawContent = (blobJson.content || '').replace(/\n/g, '');
        }
    }

    if (!rawContent) {
        return {
            sha: json.sha,
            data: { articles: [], authors: [], archivedArticles: [], lastUpdated: '' }
        };
    }

    try {
        const decoded = await decodeBase64(rawContent);
        if (!decoded || !decoded.trim()) {
             return {
                sha: json.sha,
                data: { articles: [], authors: [], archivedArticles: [], lastUpdated: '' }
            };
        }
        // Intentamos limpiar posibles caracteres invisibles al inicio/final del string
        const cleanJSON = decoded.trim().replace(/^\uFEFF/, '');
        return {
            sha: json.sha,
            data: JSON.parse(cleanJSON)
        };
    } catch (e: any) {
        console.error("Error detallado:", e);
        // Esto te dirá en la pantalla exactamente qué carácter sobra o falta
        throw new Error(`JSON no válido: ${e.message}`);
    }
};

// --- MOTOR DE FUSIÓN INTELIGENTE A PRUEBA DE CACHÉ ---
const mergeData = (localArts: Article[], remoteArts: Article[], localArch: ArchivedArticle[], remoteArch: ArchivedArticle[]) => {
    const mergedArts = [...localArts];
    const mergedArch = [...localArch];

    // 1. Procesar noticias remotas (GitHub)
    remoteArts.forEach(rArt => {
        const lArtIndex = mergedArts.findIndex(a => String(a.id) === String(rArt.id));
        const isArchivedLocally = mergedArch.some(a => String(a.id) === String(rArt.id));

        // Si la noticia está en nuestro historial local, significa que la acabamos de borrar. GANA LOCAL.
        if (isArchivedLocally) return; 

        if (lArtIndex === -1) {
            // Es una noticia nueva creada por un compañero. La añadimos.
            mergedArts.push(rArt); 
        } else {
            // Existe en ambos lados. Comparamos quién tiene la última modificación.
            const lTime = new Date(mergedArts[lArtIndex].lastModified || mergedArts[lArtIndex].date).getTime();
            const rTime = new Date(rArt.lastModified || rArt.date).getTime();
            if (rTime > lTime) {
                mergedArts[lArtIndex] = rArt; // Gana GitHub porque el compañero editó después
            }
        }
    });

    // 2. Procesar historial remoto
    remoteArch.forEach(rArch => {
        const isArchivedLocally = mergedArch.some(a => String(a.id) === String(rArch.id));
        if (!isArchivedLocally) {
            // Si un compañero la archivó, la sacamos de activas y la metemos al historial
            const activeIndex = mergedArts.findIndex(a => String(a.id) === String(rArch.id));
            if (activeIndex !== -1) mergedArts.splice(activeIndex, 1);
            mergedArch.push(rArch);
        }
    });

    return {
        articles: mergedArts.sort((a, b) => {
            const orderA = a.customOrder || 0;
            const orderB = b.customOrder || 0;
            if (orderA !== orderB) return orderB - orderA; // Ordena por prioridad (4, 3, 2, 1, 0)
            return new Date(b.date).getTime() - new Date(a.date).getTime(); // Si tienen la misma, ordena por fecha
        }),
        archive: mergedArch.sort((a, b) => new Date(b.archivedAt || 0).getTime() - new Date(a.archivedAt || 0).getTime())
    };
};

export const verifyConnection = async (): Promise<{ success: boolean; message: string }> => {
    const settings = getSettings();
    const token = settings.githubToken?.trim();
    const owner = settings.repoOwner?.trim();
    const repo = settings.repoName?.trim();

    if (!token || !owner || !repo) return { success: false, message: 'Faltan datos de configuración.' };
    
    try {
        const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
        const repoRes = await fetch(repoUrl, {
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        
        if (!repoRes.ok) return { success: false, message: `❌ Error al conectar: ${repoRes.statusText}` };

        const repoData = await repoRes.json();
        const updatedSettings = { ...settings, githubToken: token, repoOwner: owner, repoName: repo, repoBranch: repoData.default_branch || 'main' };
        saveSettings(updatedSettings);

        const db = await fetchRemoteDB(updatedSettings);
        if (db) {
            // FUSIÓN DE SEGURIDAD AL RECARGAR LA PÁGINA (Evita sobreescritura por caché)
            const localArts = getArticles();
            const localArch = getArchivedArticles();
            
            const merged = mergeData(
                localArts, db.data.articles || [],
                localArch, db.data.archivedArticles || []
            );

            saveArticlesToLocal(merged.articles);
            saveArchivedArticlesToLocal(merged.archive);
            if (db.data.authors) saveAuthorsToLocal(db.data.authors);
            
            return { success: true, message: `✅ Conectado y sincronizado. ${merged.articles.length} noticias activas.` };
        } else {
            return { success: true, message: `✅ Repositorio detectado. DB lista para crearse.` };
        }
    } catch (e: any) {
        return { success: false, message: `❌ Error de conexión: ${e.message}` };
    }
}

const executeWithRetry = async (operationName: string, operation: () => Promise<any>, maxRetries = 3): Promise<any> => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try { return await operation(); } 
        catch (error: any) {
            if (error.message && error.message.includes('409') && attempt < maxRetries - 1) {
                attempt++;
                await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
            } else throw error;
        }
    }
};

const pushToGitHub = async (settings: AppSettings, data: DatabaseSchema, sha: string, message: string) => {
    const jsonString = JSON.stringify(data);
    const contentEncoded = await encodeBase64(jsonString);

    const body = { message: message, content: contentEncoded, sha: sha || undefined, branch: settings.repoBranch };
    const putUrl = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/${settings.filePath}`;
    
    const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'Authorization': `token ${settings.githubToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!putRes.ok) {
        const errData = await putRes.json().catch(() => ({}));
        throw new Error(`${putRes.status} - MOTIVO: ${errData.message || 'Desconocido'}`);
    }
    return true;
};
  
export const uploadImageAndGetUrl = async (settings: any, base64Image: string, fileName: string): Promise<string> => {
    if (!base64Image || !base64Image.startsWith('data:image')) return base64Image;
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const extension = base64Image.split(';')[0].split('/')[1] || 'jpg';
    const uniqueName = `noticia-${Date.now()}-${Math.floor(Math.random() * 1000)}.${extension}`;
    const imagePath = `public/images/noticias/${uniqueName}`;

    const url = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/${imagePath}`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `token ${settings.githubToken}`, 'Content-Type': 'application/json' },
        // AQUÍ ESTÁ LA CLAVE: El [skip ci] tiene que estar al principio del mensaje
        body: JSON.stringify({ message: `[skip ci] 📸 Subida automática: ${uniqueName}`, content: cleanBase64, branch: settings.repoBranch })
    });

    if (!response.ok) throw new Error("Error al subir la imagen a la nube");
    return `/images/noticias/${uniqueName}`;
};

export const processArticleImages = async (article: Article, settings: any) => {
    if (article.imageUrl?.startsWith('data:image')) article.imageUrl = await uploadImageAndGetUrl(settings, article.imageUrl, 'portada.jpg');
    if (article.contentImages && article.contentImages.length > 0) {
        for (let img of article.contentImages) {
            if (img.url.startsWith('data:image')) img.url = await uploadImageAndGetUrl(settings, img.url, 'galeria.jpg');
        }
    }
    if (article.content && article.content.includes('data:image')) {
        const regex = /src="(data:image\/[^;]+;base64,[^"]+)"/g;
        let match;
        let nuevoContenido = article.content;
        while ((match = regex.exec(article.content)) !== null) {
            const base64Full = match[1];
            try {
                const urlSubida = await uploadImageAndGetUrl(settings, base64Full, 'contenido.jpg');
                nuevoContenido = nuevoContenido.replace(base64Full, urlSubida);
            } catch (e) { console.error("No se pudo extraer imagen del contenido", e); }
        }
        article.content = nuevoContenido;
    }
    return article;
};

export const syncWithGitHub = async (forcePush: boolean = false): Promise<{ success: boolean; message: string }> => {
    if (!forcePush) return { success: true, message: 'Sincronización automática ignorada.' };
    const settings = getSettings();
    if (!settings.githubToken) return { success: false, message: 'Modo Local.' };

    try {
        await executeWithRetry('syncMaster', async () => {
            const remoteInfo = await fetchRemoteDB(settings);
            const sha = remoteInfo ? remoteInfo.sha : '';

            // FUSIÓN INTELIGENTE PARA LA SUBIDA
            const localArts = getArticles();
            const localArch = getArchivedArticles();

            const merged = mergeData(
                localArts, remoteInfo?.data?.articles || [],
                localArch, remoteInfo?.data?.archivedArticles || []
            );

            const finalDB: DatabaseSchema = {
                articles: merged.articles,
                archivedArticles: merged.archive,
                authors: getAuthors(),
                lastUpdated: new Date().toISOString()
            };

            const publishedCount = finalDB.articles.filter(a => a.isPublished).length;
            await pushToGitHub(settings, finalDB, sha, `🚀 Fusión Web: ${publishedCount} noticias activas`);
            
            saveArticlesToLocal(finalDB.articles);
            saveArchivedArticlesToLocal(finalDB.archivedArticles || []);

            if (settings.vercelDeployHook) await fetch(settings.vercelDeployHook, { method: 'POST' }).catch(() => {});
        });

        return { success: true, message: '✅ Cambios sincronizados y fusionados correctamente.' };
    } catch (e: any) {
        return { success: false, message: `Error Sync: ${e.message}` };
    }
};
