import LZString from 'lz-string';
import { Article, ArchivedArticle, Author, Category } from '../types';

const INITIAL_AUTHORS: Author[] = [
  { id: '1', name: 'Eduardo Elvira', role: 'Director', imageUrl: '/images/eduardo.jpg', systemRole: 'ADMIN' },
  { id: '2', name: 'Nerea F.Elena', role: 'Redacción', imageUrl: '/images/nerea.jpg', systemRole: 'EDITOR' },
  { id: '3', name: 'Manolo Herrera', role: 'Redacción', imageUrl: '/images/manolo.jpg', systemRole: 'EDITOR' },
  { id: '4', name: 'Rubén Sánchez', role: 'Redacción', imageUrl: '/images/ruben.jpg', systemRole: 'EDITOR' },
  { id: '5', name: 'Iris Rodríguez', role: 'Redacción', imageUrl: '/images/iris.jpg', systemRole: 'EDITOR' },
  { id: '6', name: 'Antonio Tortosa', role: 'Redacción', imageUrl: '/images/antonio.jpg', systemRole: 'EDITOR' },
  { id: '7', name: 'Inés Sáez', role: 'Redacción', imageUrl: '/images/ines.jpg', systemRole: 'EDITOR' },
  { id: '8', name: 'Enrique Salazar', role: 'Redacción', imageUrl: '/images/enrique.jpg', systemRole: 'EDITOR' },
];

export const INITIAL_ARTICLES: Article[] = [
  { 
    id: '1009',
    title: `El escritor Rubén Amón ensalza la dimensión taurina de El Puerto en la presentación de “Morante, punto y aparte”`,
    summary: "El teniente de alcalde de Gran Ciudad, Javier Bello, ha acompañado a la Academia de Bellas Artes Santa Cecilia en un acto que refuerza la agenda cultural de la ciudad.",
    content: `<p>El Auditorio Municipal Monasterio San Miguel, de El Puerto de Santa Maria, ha acogido la presentación de “Morante, punto y aparte”, la última obra del periodista y escritor Rubén Amón...</p>`,
    imageUrl: "/images/WhatsApp Image 2026-02-15 at 19.13.43.jpg",
    imageCaption: 'Presentación del libro en el Auditorio',
    photoCredit: 'Manolo Herrera',
    category: Category.ACTUALIDAD,
    authorId: '3', 
    date: new Date("2026-02-16T10:00:00").toISOString(),
    isPublished: true,
    contentImages: []
   },
  {
    id: '235',
    title: 'Sábado en el Carnaval del Toro de Ciudad Rodrigo',
    summary: 'Cuatro orejas y varios novillos aplaudidos en el arrastre en una tarde marcada por el viento, la huella taurina y el debut con entrega de Moisés Fraile.',
    content: '<p>En este sábado de carnaval, Ciudad Rodrigo vivió una tarde con una novillada de Talavante sensacional...</p>',
    imageUrl: '/images/ciud.jpg',
    imageCaption: 'Plaza Mayor durante el festejo',
    photoCredit: 'Tendido Digital',
    contentImages: [],
    category: Category.CRONICAS,
    authorId: '2', 
    date: new Date("2026-02-15T18:00:00").toISOString(),
    isPublished: true,
    bullfightLocation: 'Plaza Mayor de Ciudad Rodrigo',
    bullfightCattle: 'Novillos de las ganaderías de Talavante y un eral de El Pilar.',
    bullfightSummary: 'En este sábado de carnaval, Ciudad Rodrigo vivió una tarde con una novillada de Talavante sensacional, ofreciendo cada uno de ellos un juego más que notable.',
    bullfightResults: [
        { bullfighter: 'Diego Urdiales', result: 'una oreja' },
        { bullfighter: 'Alejandro Talavante', result: 'ovación' },
        { bullfighter: 'Pablo Aguado', result: 'una oreja' },
        { bullfighter: 'El Mene', result: 'una oreja' },
        { bullfighter: 'Moisés Fraile', result: 'ovación' }
    ]
  },
];

// CACHÉ EN MEMORIA (Velocidad instantánea para la UI)
let memoryCache = {
    articles: INITIAL_ARTICLES as Article[],
    archive: [] as ArchivedArticle[],
    authors: INITIAL_AUTHORS as Author[]
};

export let isDataReady = false;
let dataReadyListeners: (() => void)[] = [];

export const subscribeToData = (cb: () => void) => {
    if (isDataReady) cb();
    dataReadyListeners.push(cb);
    return () => { dataReadyListeners = dataReadyListeners.filter(l => l !== cb); };
};

const notifyListeners = () => dataReadyListeners.forEach(cb => cb());

// --- NÚCLEO DE RENDIMIENTO: INDEXEDDB EN SEGUNDO PLANO ---
const DB_NAME = 'TendidoDigitalDB';
const STORE_NAME = 'cms_store';

const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const setIDB = async (key: string, val: any) => {
    try {
        const db = await initDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(val, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch(e) { console.error(e); }
};

const getIDB = async (key: string): Promise<any> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } catch(e) { return null; }
};

// MIGRACIÓN AUTOMÁTICA: Salva los datos del formato lento antiguo al nuevo
const migrateFromLocalStorage = async () => {
    if (localStorage.getItem('td_migrated_to_idb_v2')) return;
    try {
        const migrateKey = async (lsKey: string, idbKey: string) => {
            const stored = localStorage.getItem(lsKey);
            if (stored) {
                try {
                    const decompressed = LZString.decompressFromUTF16(stored) || stored;
                    const parsed = JSON.parse(decompressed);
                    await setIDB(idbKey, parsed);
                } catch (e) {}
            }
        };
        await migrateKey('td_articles_v4', 'articles');
        await migrateKey('td_authors_v10', 'authors');
        await migrateKey('td_archive_v4', 'archive');
        localStorage.setItem('td_migrated_to_idb_v2', 'true');
    } catch (e) { console.error("Fallo de migración", e); }
};

const initializeData = async () => {
    await migrateFromLocalStorage();
    const [savedArticles, savedArchive, savedAuthors] = await Promise.all([
        getIDB('articles'), getIDB('archive'), getIDB('authors')
    ]);
    
    if (savedArticles) memoryCache.articles = savedArticles;
    if (savedArchive) memoryCache.archive = savedArchive;
    if (savedAuthors) memoryCache.authors = savedAuthors;

    isDataReady = true;
    notifyListeners();
};

initializeData();

// --- AUTO-SYNC ---
let autoSaveTimer: any = null;
let syncCallback: (() => Promise<void>) | null = null;
export const setSyncCallback = (callback: () => Promise<void>) => { syncCallback = callback; };
export const stopAutoSync = () => { if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; } };
export const triggerCloudSync = () => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    try { if (syncCallback) await syncCallback(); } catch (error) { console.error(error); }
  }, 2000);
};

// --- OPERACIONES INSTANTÁNEAS (0ms Bloqueo) ---
export const getAuthors = (): Author[] => memoryCache.authors;
export const getArticles = (): Article[] => memoryCache.articles;
export const getArchivedArticles = (): ArchivedArticle[] => memoryCache.archive;
export const getArticleById = (id: string): Article | undefined => memoryCache.articles.find((a) => String(a.id) === String(id));

export const saveAuthorsToLocal = (authors: Author[]): void => {
    memoryCache.authors = authors;
    setIDB('authors', authors);
};

export const saveArticlesToLocal = (articles: Article[]): void => {
    memoryCache.articles = articles;
    setIDB('articles', articles); 
};

export const saveArchivedArticlesToLocal = (archived: ArchivedArticle[]): void => {
    memoryCache.archive = archived; 
    setIDB('archive', archived);
};

export const saveAuthor = (author: Author, skipSync = false): void => {
  const authors = [...getAuthors()];
  const existingIndex = authors.findIndex((a) => String(a.id) === String(author.id));
  const authorToSave = { ...author, lastModified: new Date().toISOString() };
  if (existingIndex >= 0) authors[existingIndex] = authorToSave;
  else authors.push(authorToSave);
  
  saveAuthorsToLocal(authors);
  notifyListeners();
  if (!skipSync) triggerCloudSync();
};

export const deleteAuthor = (id: string): void => {
  const authors = getAuthors().filter((a) => String(a.id) !== String(id));
  saveAuthorsToLocal(authors);
  notifyListeners();
  triggerCloudSync();
};

export const saveArticle = (article: Article, skipSync = false): void => {
  const articles = [...getArticles()];
  const existingIndex = articles.findIndex((a) => String(a.id) === String(article.id));
  const articleToSave = { ...article, lastModified: new Date().toISOString() };
  if (existingIndex >= 0) articles[existingIndex] = articleToSave;
  else articles.unshift(articleToSave); 
  
  saveArticlesToLocal(articles);
  notifyListeners(); 
  if (!skipSync) triggerCloudSync();
};

export const deleteArticle = (id: string, userId: string = 'system'): void => {
  const articles = getArticles();
  const articleToArchive = articles.find((a) => String(a.id) === String(id));
  
  if (articleToArchive) {
      const archived: ArchivedArticle = { ...articleToArchive, archivedAt: new Date().toISOString(), archivedBy: userId };
      const archive = [...getArchivedArticles()];
      const existingArchiveIndex = archive.findIndex(a => String(a.id) === String(id));
      if (existingArchiveIndex >= 0) archive[existingArchiveIndex] = archived;
      else archive.unshift(archived);
      
      saveArchivedArticlesToLocal(archive);
      const newArticles = articles.filter((a) => String(a.id) !== String(id));
      saveArticlesToLocal(newArticles);
      
      notifyListeners();
      triggerCloudSync();
  }
};

export const restoreArticle = (id: string, skipSync = false): boolean => {
    const archive = getArchivedArticles();
    const articleToRestore = archive.find(a => String(a.id) === String(id));

    if (articleToRestore) {
        const activeArticle: Article = {
            id: String(articleToRestore.id), title: articleToRestore.title, summary: articleToRestore.summary,
            content: articleToRestore.content, imageUrl: articleToRestore.imageUrl, imageCaption: articleToRestore.imageCaption || '', 
            photoCredit: articleToRestore.photoCredit || '', contentImages: articleToRestore.contentImages || [],
            category: articleToRestore.category, authorId: String(articleToRestore.authorId), date: articleToRestore.date,
            isPublished: false, bullfightLocation: articleToRestore.bullfightLocation || '', bullfightCattle: articleToRestore.bullfightCattle || '',
            bullfightSummary: articleToRestore.bullfightSummary || '', bullfightResults: articleToRestore.bullfightResults || []
        };
        const articles = [...getArticles()];
        articles.unshift(activeArticle);
        saveArticlesToLocal(articles);
        
        const newArchive = archive.filter(a => String(a.id) !== String(id));
        saveArchivedArticlesToLocal(newArchive);
        
        notifyListeners();
        if (!skipSync) triggerCloudSync();
        return true;
    }
    return false;
};
