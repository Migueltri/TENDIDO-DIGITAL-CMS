import { AppSettings, Article, Author, ArchivedArticle } from '../types';
import { getArticles, getAuthors, getArchivedArticles, saveArticlesToLocal, saveAuthorsToLocal, saveArchivedArticlesToLocal } from './dataService';

const SETTINGS_KEY = 'td_app_settings';

export const getSettings = (): AppSettings => {
  const stored = localStorage.getItem(SETTINGS_KEY);
  const settings = stored ? JSON.parse(stored) : {};
  
  // CORRECCIÓN: Eliminamos la condición ilógica y fijamos dataDB.json
  let filePath = settings.filePath || 'public/data/dataDB.json';
  
  if (
      settings.repoName === 'Tendido-Digital' || 
      settings.repoName === 'tendido-digital-oficial' ||
      settings.githubToken?.startsWith('github_pat_') ||
      settings.repoOwner === 'MiguelTro'
  ) {
      settings.repoName = 'tendido-digital-cms';
      settings.repoOwner = 'migueltri';
      settings.githubToken = ''; 
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

export const verifyConnection = async (): Promise<{ success: boolean; message: string }> => {
    const settings = getSettings();
    const token = settings.githubToken?.trim();
    const owner = settings.repoOwner?.trim();
    const repo = settings.repoName?.trim();

    if (!token || !owner || !repo) {
       return { success: false, message: 'Faltan datos de configuración.' };
    }
    try {
        const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
        const repoRes = await fetch(repoUrl, {
            headers: { 
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (repoRes.status === 404) {
            return { success: false, message: '❌ Repositorio o usuario no encontrado. Verifica el Usuario y Repositorio.' };
        }
        if (repoRes.status === 401) {
            return { success: false, message: '❌ Token inválido o sin permisos.' };
        }
        if (!repoRes.ok) {
            return { success: false, message: `❌ Error al conectar: ${repoRes.statusText}` };
        }

        const repoData = await repoRes.json();
        const defaultBranch = repoData.default_branch || 'main';

        const updatedSettings = {
            ...settings,
            githubToken: token,
            repoOwner: owner,
            repoName: repo,
            repoBranch: defaultBranch
        };
        saveSettings(updatedSettings);

        const db = await fetchRemoteDB(updatedSettings);
        if (db) {
            // DESCARGA REAL: Guardar los datos de GitHub en la interfaz de la App
            if (db.data.articles) saveArticlesToLocal(db.data.articles);
            if (db.data.authors) saveAuthorsToLocal(db.data.authors);
            if (db.data.archivedArticles) saveArchivedArticlesToLocal(db.data.archivedArticles);
            
            return { success: true, message: `✅ Conectado y sincronizado. ${db.data.articles?.length || 0} noticias online.` };
        } else {
            return { success: true, message: `✅ Repositorio detectado. Archivo de base de datos listo para crearse.` };
        }
    } catch (e: any) {
        console.warn("GitHub connection warning:", e);
        return { success: false, message: `❌ Error de conexión: ${e.message}` };
    }
}

const executeWithRetry = async (
    operationName: string, 
    operation: () => Promise<any>, 
    maxRetries = 3
): Promise<any> => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await operation();
        } catch (error: any) {
            const isConflict = error.message && error.message.includes('409');
            if (isConflict && attempt < maxRetries - 1) {
                console.warn(`Retry ${operationName} (${attempt + 1})...`);
                attempt++;
                await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
            } else {
                throw error;
            }
        }
    }
};

const pushToGitHub = async (settings: AppSettings, data: DatabaseSchema, sha: string, message: string) => {
    const jsonString = JSON.stringify(data);
    const contentEncoded = await encodeBase64(jsonString);

    const body = {
        message: message,
        content: contentEncoded,
        sha: sha || undefined,
        branch: settings.repoBranch 
    };

    const putUrl = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/${settings.filePath}`;
    const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: { 
            'Authorization': `token ${settings.githubToken}`,
            'Content-Type': 'application/json'
        },
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
        headers: {
            'Authorization': `token ${settings.githubToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `📸 Auto-upload: ${uniqueName}`,
            content: cleanBase64,
            branch: settings.repoBranch
        })
    });

    if (!response.ok) throw new Error("Error al subir la imagen a la nube");
    return `/images/noticias/${uniqueName}`;
};

export const processArticleImages = async (article: Article, settings: any) => {
    // 1. Procesar imagen principal
    if (article.imageUrl?.startsWith('data:image')) {
        article.imageUrl = await uploadImageAndGetUrl(settings, article.imageUrl, 'portada.jpg');
    }

    // 2. Procesar galería de imágenes
    if (article.contentImages && article.contentImages.length > 0) {
        for (let img of article.contentImages) {
            if (img.url.startsWith('data:image')) {
                img.url = await uploadImageAndGetUrl(settings, img.url, 'galeria.jpg');
            }
        }
    }

    // 3. EXTRA: Procesar imágenes pegadas en el EDITOR (Cuerpo de la noticia)
    // Esto evita que el JSON pese 20MB por una foto pegada en el texto
    if (article.content && article.content.includes('data:image')) {
        const regex = /src="(data:image\/[^;]+;base64,[^"]+)"/g;
        let match;
        let nuevoContenido = article.content;

        while ((match = regex.exec(article.content)) !== null) {
            const base64Full = match[1];
            try {
                // Subimos la imagen del cuerpo del texto
                const urlSubida = await uploadImageAndGetUrl(settings, base64Full, 'contenido.jpg');
                // Reemplazamos el código gigante por la ruta corta
                nuevoContenido = nuevoContenido.replace(base64Full, urlSubida);
            } catch (e) {
                console.error("No se pudo extraer imagen del contenido", e);
            }
        }
        article.content = nuevoContenido;
    }
    
    return article;
};

export const syncWithGitHub = async (forcePush: boolean = false): Promise<{ success: boolean; message: string }> => {
    // Si no es un guardado forzado (manual), abortamos la operación.
    if (!forcePush) {
        return { success: true, message: 'Sincronización automática ignorada por seguridad.' };
    }

    const settings = getSettings();
    if (!settings.githubToken) return { success: false, message: 'Modo Local.' };

    try {
        await executeWithRetry('syncMaster', async () => {
            // 1. DESCARGAMOS LA VERSIÓN REAL Y ACTUALIZADA DE GITHUB
            const remoteInfo = await fetchRemoteDB(settings);
            
            // 2. OBTENEMOS NUESTRA VERSIÓN LOCAL (Lo que acabamos de guardar/borrar en nuestro PC)
            const localArticles = getArticles();
            const localArchive = getArchivedArticles();
            const localAuthors = getAuthors();

            let sha = remoteInfo ? remoteInfo.sha : '';
            
            // Objeto final que subiremos
            let finalDB: DatabaseSchema = {
                articles: [],
                archivedArticles: [],
                authors: localAuthors, // Los autores no suelen tener conflictos de edición simultánea
                lastUpdated: new Date().toISOString()
            };

            // --- FUSIÓN INTELIGENTE DE NOTICIAS ---
            
            if (remoteInfo && remoteInfo.data && remoteInfo.data.articles) {
                const remoteArticles = remoteInfo.data.articles;
                const remoteArchive = remoteInfo.data.archivedArticles || [];

                // A. Mezclar Noticias Activas
                // Mantenemos todas las noticias de GitHub EXCEPTO las que hemos borrado localmente o editado
                const mergedArticles = remoteArticles.filter(remoteArticle => {
                    // Si la noticia remota está en nuestro historial local, significa que LA HEMOS BORRADO
                    const wasArchivedLocally = localArchive.some(a => String(a.id) === String(remoteArticle.id));
                    return !wasArchivedLocally;
                }).map(remoteArticle => {
                    // Si hemos editado una noticia localmente, usamos nuestra versión, si no, la de GitHub
                    const localEdit = localArticles.find(a => String(a.id) === String(remoteArticle.id));
                    return localEdit || remoteArticle;
                });

                // Añadimos las noticias NUEVAS que hayamos creado localmente y que no estén en GitHub
                const newLocalArticles = localArticles.filter(localA => 
                    !remoteArticles.some(remoteA => String(remoteA.id) === String(localA.id))
                );

                finalDB.articles = [...newLocalArticles, ...mergedArticles].sort((a, b) => 
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );

                // B. Mezclar Historial de Archivadas
                // Sumamos el historial de GitHub con nuestro nuevo historial local sin duplicados
                const mergedArchive = [...localArchive];
                remoteArchive.forEach(remoteArchivedItem => {
                    if (!mergedArchive.some(localArchivedItem => String(localArchivedItem.id) === String(remoteArchivedItem.id))) {
                        mergedArchive.push(remoteArchivedItem);
                    }
                });
                finalDB.archivedArticles = mergedArchive;

            } else {
                // Si GitHub estaba vacío o es la primera vez, subimos lo local a lo bruto
                finalDB.articles = localArticles;
                finalDB.archivedArticles = localArchive;
            }

            // 3. SUBIMOS EL ARCHIVO FUSIONADO
            const publishedArticles = finalDB.articles.filter(a => a.isPublished);
            const commitMessage = `🚀 Fusión Web: ${publishedArticles.length} noticias activas`;

            await pushToGitHub(settings, finalDB, sha, commitMessage);
            
            // 4. ACTUALIZAMOS NUESTRA MEMORIA LOCAL CON LA FUSIÓN PARA VER LO MISMO QUE LOS COMPAÑEROS
            saveArticlesToLocal(finalDB.articles);
            saveArchivedArticlesToLocal(finalDB.archivedArticles || []);

            if (settings.vercelDeployHook) {
                await fetch(settings.vercelDeployHook, { method: 'POST' }).catch(() => {});
            }
        });

        return { success: true, message: '✅ Cambios sincronizados y fusionados correctamente.' };
    } catch (e: any) {
        return { success: false, message: `Error Sync: ${e.message}` };
    }
};
