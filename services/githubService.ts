
import { AppSettings, Article, Author, ArchivedArticle } from '../types';
import { getArticles, getAuthors, getArchivedArticles, saveArticlesToLocal, saveAuthorsToLocal, saveArchivedArticlesToLocal } from './dataService';

const SETTINGS_KEY = 'td_app_settings';
// ... (keep existing code until syncWithGitHub)


export const getSettings = (): AppSettings => {
  const stored = localStorage.getItem(SETTINGS_KEY);
  const settings = stored ? JSON.parse(stored) : {};
  
  let filePath = settings.filePath || 'public/data/db.json';
  if (filePath === 'public/dataDB.json') {
      filePath = 'public/data/db.json';
  }
  
  return {
    githubToken: settings.githubToken || '',
    repoOwner: settings.repoOwner || '',
    repoName: settings.repoName || '',
    filePath: filePath,
    repoBranch: settings.repoBranch || 'main'
  };
};

export const saveSettings = (settings: AppSettings) => {
  const cleanSettings = {
    ...settings,
    githubToken: settings.githubToken.trim(),
    repoOwner: settings.repoOwner.trim(),
    repoName: settings.repoName.trim(),
    filePath: settings.filePath.trim().replace(/^\//, ''),
    repoBranch: settings.repoBranch?.trim() || 'main'
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

const encodeBase64 = (str: string): string => {
    const bytes = new TextEncoder().encode(str);
    let binString = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binString += String.fromCharCode(bytes[i]);
    }
    return btoa(binString);
};

const decodeBase64 = (b64: string): string => {
    const binString = atob(b64);
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
        bytes[i] = binString.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
};

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
        // Check if the repo exists to distinguish between missing file and missing repo
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
        return null; // Repo exists, but file doesn't
    }
    if (response.status === 401) throw new Error('Token inválido o sin permisos.');
    if (!response.ok) throw new Error(`Error Github (${response.status}): ${response.statusText}`);

    const json: GitHubFileResponse = await response.json();
    
    let rawContent = (json.content || '').replace(/\n/g, '');
    
    // Si el archivo es mayor a 1MB, la API de contents no devuelve el contenido.
    // Tenemos que usar la API de Git Blobs usando el SHA.
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
        // Archivo vacío o sin contenido
        return {
            sha: json.sha,
            data: { articles: [], authors: [], archivedArticles: [], lastUpdated: '' }
        };
    }

    try {
        const decoded = decodeBase64(rawContent);
        if (!decoded.trim()) {
             return {
                sha: json.sha,
                data: { articles: [], authors: [], archivedArticles: [], lastUpdated: '' }
            };
        }
        return {
            sha: json.sha,
            data: JSON.parse(decoded)
        };
    } catch (e) {
        console.error("Error parsing remote DB:", e);
        // Si falla el parseo, asumimos corrupto o vacío y devolvemos estructura base para permitir sobreescritura (con cuidado)
        // O mejor, lanzamos error para no destruir datos.
        throw new Error("El archivo remoto db.json está corrupto o no es JSON válido.");
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
        // First, verify the repository exists and token is valid
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

        // Update settings with trimmed values and correct branch
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
            return { success: true, message: `✅ Conectado. ${db.data.articles?.length || 0} noticias online.` };
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
    const jsonString = JSON.stringify(data, null, 2);
    const contentEncoded = encodeBase64(jsonString);

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

    if (!putRes.ok) throw new Error(`Error ${putRes.status}: ${putRes.statusText}`);
    return true;
};

// --- SINCRONIZACIÓN MAESTRA (La lógica crítica) ---
export const syncWithGitHub = async (forcePush: boolean = false): Promise<{ success: boolean; message: string }> => {
    let settings = getSettings();
    if (!settings.githubToken) return { success: false, message: 'Modo Local (Sin configuración de GitHub).' };

    // Trim settings
    settings = {
        ...settings,
        githubToken: (settings.githubToken || '').trim(),
        repoOwner: (settings.repoOwner || '').trim(),
        repoName: (settings.repoName || '').trim(),
        repoBranch: (settings.repoBranch || 'main').trim()
    };

    try {
        await executeWithRetry('syncMaster', async () => {
            // Ensure we have the correct default branch if we haven't verified it yet
            if (!settings.repoBranch || settings.repoBranch === 'main') {
                try {
                    const repoUrl = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}`;
                    const repoRes = await fetch(repoUrl, {
                        headers: { 
                            'Authorization': `token ${settings.githubToken}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    if (repoRes.ok) {
                        const repoData = await repoRes.json();
                        if (repoData.default_branch) {
                            settings.repoBranch = repoData.default_branch;
                        }
                    }
                } catch (e) {
                    console.warn("Could not fetch default branch", e);
                }
            }

            const remoteInfo = await fetchRemoteDB(settings);
            
            let remoteDB: DatabaseSchema = remoteInfo ? remoteInfo.data : { articles: [], authors: [], archivedArticles: [], lastUpdated: '' };
            let sha = remoteInfo ? remoteInfo.sha : '';

            const localArticles = getArticles();
            const localArchive = getArchivedArticles();
            const localAuthors = getAuthors();

            let hasChanges = false;

            // --- MERGE INTELLIGENT: AUTHORS ---
            const mergedAuthorsMap = new Map<string, Author>();
            remoteDB.authors.forEach(a => mergedAuthorsMap.set(String(a.id), a));
            
            localAuthors.forEach(lA => {
                const rA = mergedAuthorsMap.get(String(lA.id));
                if (rA) {
                    const localTime = lA.lastModified ? new Date(lA.lastModified).getTime() : 0;
                    const remoteTime = rA.lastModified ? new Date(rA.lastModified).getTime() : 0;
                    if (localTime >= remoteTime) mergedAuthorsMap.set(String(lA.id), lA);
                } else {
                    mergedAuthorsMap.set(String(lA.id), lA);
                }
            });
            remoteDB.authors = Array.from(mergedAuthorsMap.values());

            // --- MERGE INTELLIGENT: ARTICLES ---
            const mergedArticlesMap = new Map<string, Article>();
            if (!remoteDB.articles) remoteDB.articles = [];
            
            // 1. Start with Remote Articles
            remoteDB.articles.forEach(a => mergedArticlesMap.set(String(a.id), a));

            // 2. Identify Remote Deletions (Zombie Protection)
            // If an article is in remoteDB.archivedArticles, it means it was deleted by someone else.
            // We must NOT let our local copy resurrect it.
            const remoteArchivedIds = new Set((remoteDB.archivedArticles || []).map(a => String(a.id)));

            // 3. Merge Local Articles
            localArticles.forEach(lA => {
                if (remoteArchivedIds.has(String(lA.id))) {
                    // ZOMBIE CHECK FIX: If it's in remote archive, we only drop it if the remote archive is NEWER than our local modification.
                    // If our local modification is newer, it means we restored it locally, so we should keep it.
                    const remoteArchivedItem = remoteDB.archivedArticles?.find(a => String(a.id) === String(lA.id));
                    const archivedTime = remoteArchivedItem?.archivedAt ? new Date(remoteArchivedItem.archivedAt).getTime() : 0;
                    const localTime = lA.lastModified ? new Date(lA.lastModified).getTime() : 0;
                    
                    if (localTime <= archivedTime) {
                        return; // Skip adding this local article, effectively deleting it locally when we save back
                    }
                }

                const rA = mergedArticlesMap.get(String(lA.id));
                if (rA) {
                    const localTime = lA.lastModified ? new Date(lA.lastModified).getTime() : 0;
                    const remoteTime = rA.lastModified ? new Date(rA.lastModified).getTime() : 0;
                    // Last Write Wins
                    if (localTime >= remoteTime) {
                        mergedArticlesMap.set(String(lA.id), lA);
                    }
                } else {
                    // New local article (not in remote active, and not in remote archive)
                    mergedArticlesMap.set(String(lA.id), lA);
                }
            });
            
            // --- MERGE INTELLIGENT: ARCHIVE ---
            const mergedArchiveMap = new Map<string, ArchivedArticle>();
            if (!remoteDB.archivedArticles) remoteDB.archivedArticles = [];
            remoteDB.archivedArticles.forEach(a => mergedArchiveMap.set(String(a.id), a));

            localArchive.forEach(lA => {
                mergedArchiveMap.set(String(lA.id), lA);
            });

            // LIMPIEZA CRUZADA (Consistencia Final)
            // Si algo está en el mapa de Archivo, NO puede estar en el mapa de Activos.
            mergedArchiveMap.forEach((archivedItem, id) => {
                if (mergedArticlesMap.has(id)) {
                    const activeItem = mergedArticlesMap.get(id);
                    
                    const activeTime = activeItem?.lastModified ? new Date(activeItem.lastModified).getTime() : 0;
                    const archivedTime = archivedItem.archivedAt ? new Date(archivedItem.archivedAt).getTime() : 0;

                    // Si la edición activa es POSTERIOR al archivado, significa que se restauró.
                    if (activeTime > archivedTime) {
                        mergedArchiveMap.delete(id); 
                    } else {
                        // Si el archivado es más reciente (o igual), borramos de activos.
                        mergedArticlesMap.delete(id);
                    }
                }
            });

            // Check if there are any changes before pushing
            const newArticles = Array.from(mergedArticlesMap.values());
            const newArchivedArticles = Array.from(mergedArchiveMap.values());
            const newAuthors = Array.from(mergedAuthorsMap.values());

            hasChanges = 
                JSON.stringify(remoteDB.articles) !== JSON.stringify(newArticles) ||
                JSON.stringify(remoteDB.archivedArticles) !== JSON.stringify(newArchivedArticles) ||
                JSON.stringify(remoteDB.authors) !== JSON.stringify(newAuthors);

            remoteDB.articles = newArticles;
            remoteDB.archivedArticles = newArchivedArticles;
            remoteDB.authors = newAuthors;
            
            // --- CRITICAL: UPDATE LOCAL STORAGE WITH MERGED DATA ---
            saveArticlesToLocal(remoteDB.articles);
            saveAuthorsToLocal(remoteDB.authors);
            saveArchivedArticlesToLocal(remoteDB.archivedArticles);

            if (hasChanges || !sha) {
                remoteDB.lastUpdated = new Date().toISOString();
                
                // Generar mensaje de commit detallado
                const publishedArticles = remoteDB.articles.filter(a => a.isPublished);
                const titles = publishedArticles.map(a => `- ${a.title}`).join('\n');
                const commitMessage = forcePush 
                    ? `🚀 Publicación Web: ${publishedArticles.length} noticias activas\n\nNoticias publicadas:\n${titles}`
                    : '🔄 Sync Automático: Guardado de seguridad';

                // Push to GitHub
                await pushToGitHub(settings, remoteDB, sha, commitMessage);
                
                if (settings.vercelDeployHook) {
                    try {
                        await fetch(settings.vercelDeployHook, { method: 'POST' });
                        console.log("Vercel deploy hook triggered.");
                    } catch (e) {
                        console.error("Error triggering Vercel deploy hook:", e);
                    }
                }
            } else {
                console.log("No hay cambios locales para subir. Sincronización completada.");
            }
        });

        return { success: true, message: '✅ Cambios subidos. Vercel está desplegando la web (tardará 1-2 minutos).' };

    } catch (e: any) {
        return { success: false, message: `Error Sync: ${e.message}` };
    }
};


