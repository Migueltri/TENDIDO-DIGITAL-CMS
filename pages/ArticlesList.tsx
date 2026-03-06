import React, { useEffect, useState } from 'react';
import { getArticles, deleteArticle, getAuthors, saveArticle, stopAutoSync, getArchivedArticles, restoreArticle, subscribeToData } from '../services/dataService';
import { syncWithGitHub } from '../services/githubService';
import { Article, Category, Author, ArchivedArticle } from '../types';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, Edit2, Filter, AlertCircle, X, CheckCircle, Clock, CloudUpload, Loader2, EyeOff, Archive, RefreshCcw, ShieldAlert, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PreviewModal from '../components/PreviewModal';

const ArticlesList: React.FC = () => {
  const { isAdmin, currentUser } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [archivedArticles, setArchivedArticles] = useState<ArchivedArticle[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [pendingChanges, setPendingChanges] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<{id: string, title: string} | null>(null);
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, filterCategory, searchTerm]);

  // SUSCRIPCIÓN EN TIEMPO REAL A LA BASE DE DATOS ULTRA-RÁPIDA
  useEffect(() => {
    const loadData = () => {
      setArticles(getArticles());
      setArchivedArticles(getArchivedArticles());
      setAuthors(getAuthors());
    };

    const unsubscribe = subscribeToData(() => {
      loadData();
    });
    return unsubscribe;
  }, [viewMode]);

  const handleApprove = async (article: Article) => {
      if (!confirm(`¿Publicar "${article.title}" en la web ahora mismo?`)) return;
      try {
          const updatedArticle = { ...article, isPublished: true };
          saveArticle(updatedArticle, true); 
          setIsSyncing(true);
          syncWithGitHub(true).then(result => {
              if (result.success) setPendingChanges(0);
              else {
                  alert("⚠️ Se guardó localmente, pero hubo un error subiendo a la web: " + result.message);
                  setPendingChanges(prev => prev + 1);
              }
          }).finally(() => setIsSyncing(false));
      } catch (error: any) { alert("❌ Error de conexión."); }
  };

  const handleUnpublish = async (article: Article) => {
      if(!confirm(`¿Retirar "${article.title}" de la web? Pasará a ser un borrador y se actualizará la web inmediatamente.`)) return;
      try {
          const updatedArticle = { ...article, isPublished: false };
          saveArticle(updatedArticle, true);
          setIsSyncing(true);
          syncWithGitHub(true).then(result => {
              if (result.success) setPendingChanges(0);
              else {
                  alert("⚠️ Retirada localmente, pero falló la sincronización: " + result.message);
                  setPendingChanges(prev => prev + 1);
              }
          }).finally(() => setIsSyncing(false));
      } catch (error: any) { alert("❌ Error de conexión."); }
  };
  
  const handleRestore = async (id: string) => {
      if(!window.confirm("¿Restaurar esta noticia? Volverá a la lista de borradores activos.")) return;
      setIsSyncing(true); 
      try {
          const success = restoreArticle(id);
          if (success) {
              const result = await syncWithGitHub();
              if (result.success) {
                  setFilterCategory('all'); setSearchTerm(''); setViewMode('active'); window.scrollTo(0,0);
              } else {
                  alert("⚠️ Restaurada localmente, pero hubo error de red: " + result.message);
                  setViewMode('active');
              }
          } else alert("❌ Error al restaurar: No se encontró la noticia en el archivo.");
      } catch (e) { alert("⚠️ Error de conexión al restaurar en la nube."); setViewMode('active'); } 
      finally { setIsSyncing(false); }
  };

  const promptDelete = (id: string, title: string) => { setArticleToDelete({ id, title }); };

  const confirmDelete = () => {
    if (articleToDelete) {
      const idToDelete = articleToDelete.id;
      setArticleToDelete(null); // La ventana se cierra AL INSTANTE
      
      try {
          deleteArticle(idToDelete, currentUser?.id || 'unknown'); // Ahora no bloquea nada
          stopAutoSync(); 
          syncWithGitHub().then(result => {
              if (result.success) setPendingChanges(0); 
              else {
                  console.warn("Error actualizando la web: " + result.message);
                  setPendingChanges(prev => prev + 1);
              }
          });
      } catch (error) { alert("Error crítico al eliminar."); }
    }
  };

  const cancelDelete = () => setArticleToDelete(null);

  const handleQuickSyncInternal = async (forcePush: boolean = false) => {
    setIsSyncing(true); stopAutoSync();
    try {
        const result = await syncWithGitHub(forcePush);
        if (result.success) setPendingChanges(0);
        else alert("❌ Error al publicar: " + result.message);
    } catch (error) { alert("❌ Error de conexión"); } 
    finally { setIsSyncing(false); }
  };

  const sourceList = viewMode === 'active' ? articles : archivedArticles;
  const filteredList = sourceList.filter(article => {
    const matchesCategory = filterCategory === 'all' || article.category === filterCategory;
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (article.summary || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const paginatedList = filteredList.slice(0, currentPage * ITEMS_PER_PAGE);
  const hasMore = paginatedList.length < filteredList.length;
  
  const getAuthor = (id: string) => authors.find(a => a.id === id);
  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>, name: string) => {
      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
           <h2 className="text-3xl font-bold text-gray-800">Gestión de Noticias</h2>
           <p className="text-gray-500">{isAdmin ? 'Control total de contenidos y archivo histórico.' : 'Gestión de tus noticias y borradores.'}</p>
        </div>
        <div className="flex gap-2">
            <Link to="/crear-noticia" className="bg-brand-red hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm font-medium">
            <Plus size={18} /> Nueva Noticia
            </Link>
        </div>
      </div>

      {pendingChanges > 0 && (
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in shadow-sm">
              <div className="flex items-start gap-3 text-orange-800">
                  <AlertCircle className="flex-shrink-0 mt-0.5" />
                  <div>
                      <p className="font-bold text-lg">Tienes cambios pendientes.</p>
                      <p className="text-sm opacity-90">Recuerda sincronizar para que los cambios se vean reflejados en la web pública.</p>
                  </div>
              </div>
              <button onClick={() => handleQuickSyncInternal(false)} disabled={isSyncing} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-lg font-medium shadow-sm flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap">
                 <RefreshCcw size={18} className={isSyncing ? "animate-spin" : ""} /> {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <button onClick={() => handleQuickSyncInternal(true)} disabled={isSyncing} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap">
                {isSyncing ? <><Loader2 size={18} className="animate-spin" /> Actualizando Web...</> : <><CloudUpload size={18} /> Subir cambios a la web</>}
              </button>
          </div>
      )}

      <div className="flex border-b border-gray-200">
          <button onClick={() => setViewMode('active')} className={`px-6 py-3 font-medium text-sm flex items-center gap-2 transition-colors border-b-2 ${viewMode === 'active' ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <CheckCircle size={18} /> Activas y Borradores
              <span className={`text-xs px-2 py-0.5 rounded-full ${viewMode === 'active' ? 'bg-red-100 text-brand-red' : 'bg-gray-200 text-gray-600'}`}>{articles.length}</span>
          </button>
          {isAdmin && (
              <button onClick={() => setViewMode('history')} className={`px-6 py-3 font-medium text-sm flex items-center gap-2 transition-colors border-b-2 ${viewMode === 'history' ? 'border-gray-800 text-gray-800 bg-gray-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <Archive size={18} /> Historial de Eliminadas
                  <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">{archivedArticles.length}</span>
              </button>
          )}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder={viewMode === 'active' ? "Buscar por título..." : "Buscar en el historial..."} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter size={18} className="text-gray-500" />
            <select className="w-full md:w-48 p-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-red bg-white" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">Todas las Categorías</option>
              {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
        </div>
      </div>

      {viewMode === 'history' && (
          <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg flex items-center gap-2 text-sm border border-yellow-200">
              <ShieldAlert size={18} /><span><strong>Modo Historial Seguro:</strong> Las noticias aquí no se pueden borrar definitivamente. Solo pueden restaurarse a borradores.</span>
          </div>
      )}

      {isSyncing && viewMode === 'history' && (
          <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
              <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3 border border-gray-200">
                  <Loader2 className="animate-spin text-brand-red" />
                  <span className="font-medium text-gray-700">Restaurando y sincronizando...</span>
              </div>
          </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="md:hidden grid grid-cols-1 divide-y divide-gray-100">
            {filteredList.length === 0 ? (
                <div className="p-8 text-center text-gray-500">{viewMode === 'active' ? 'No se encontraron noticias activas.' : 'El historial está vacío.'}</div>
            ) : (
                paginatedList.map((article) => {
                    const author = getAuthor(article.authorId);
                    const authorName = author ? author.name : 'Desconocido';
                    return (
                        <div key={article.id} className={`p-4 flex flex-col gap-3 ${viewMode === 'history' ? 'bg-gray-50/50 grayscale-[20%]' : ''}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <img src={article.imageUrl} className="w-12 h-12 rounded object-cover bg-gray-200" alt="" />
                                    <div>
                                        <h3 className="font-bold text-gray-900 line-clamp-2 text-sm leading-tight">{article.title}</h3>
                                        <p className="text-xs text-gray-500 mt-0.5">{new Date(article.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${article.isPublished ? 'bg-green-50 text-green-700 border-green-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100'}`}>
                                    {article.isPublished ? 'PUBLICADA' : 'BORRADOR'}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center pt-2 border-t border-gray-50 mt-1">
                                <div className="flex items-center gap-2">
                                    <img src={author?.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}`} alt={authorName} className="w-6 h-6 rounded-full object-cover border border-gray-100" onError={(e) => handleAvatarError(e, authorName)} />
                                    <span className="text-xs text-gray-600 font-medium truncate max-w-[100px]">{authorName}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setPreviewArticle(article)} className="p-2 text-gray-600 bg-gray-100 rounded-lg"><Eye size={16} /></button>
                                    {viewMode === 'active' && (
                                        <><Link to={`/editar-noticia/${article.id}`} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit2 size={16} /></Link>
                                        <button onClick={() => promptDelete(article.id, article.title)} className="p-2 text-red-600 bg-red-50 rounded-lg"><Trash2 size={16} /></button></>
                                    )}
                                    {viewMode === 'history' && (
                                        <button onClick={() => handleRestore(article.id)} className="p-2 text-blue-600 bg-blue-50 rounded-lg flex items-center gap-1 text-xs font-bold"><RefreshCcw size={14} /> Restaurar</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm">
                <th className="p-4 font-medium w-24">Estado</th>
                <th className="p-4 font-medium">Noticia</th>
                <th className="p-4 font-medium w-32">Categoría</th>
                <th className="p-4 font-medium w-80">{viewMode === 'history' ? 'Archivado' : 'Autor y Fecha'}</th>
                <th className="p-4 font-medium text-right w-32">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredList.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">{viewMode === 'active' ? 'No se encontraron noticias activas.' : 'El historial está vacío.'}</td></tr>
              ) : (
                paginatedList.map((article) => {
                  const author = getAuthor(article.authorId);
                  const authorName = author ? author.name : 'Desconocido';
                  return (
                    <tr key={article.id} className={`hover:bg-gray-50 group ${viewMode === 'history' ? 'bg-gray-50/50 grayscale-[20%]' : ''}`}>
                      <td className="p-4 align-top pt-5">
                          {viewMode === 'history' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-200 text-gray-700 text-xs font-bold border border-gray-300"><Archive size={12} /> <span className="hidden xl:inline">Archivada</span></span>
                          ) : (
                             article.isPublished ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-200"><CheckCircle size={12} /> <span className="hidden xl:inline">Publicada</span></span>
                            : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold border border-yellow-200"><Clock size={12} /> <span className="hidden xl:inline">Borrador</span></span>
                          )}
                      </td>
                      <td className="p-4 max-w-md">
                        <div className="flex items-start gap-3">
                          <img src={article.imageUrl} className="w-16 h-12 rounded object-cover bg-gray-200 mt-1" alt="" />
                          <div><p className="font-medium text-gray-900 line-clamp-2 leading-tight mb-1">{article.title}</p><p className="text-xs text-gray-500 line-clamp-1">{article.summary}</p></div>
                        </div>
                      </td>
                      <td className="p-4 align-top pt-5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap
                          ${article.category === Category.CRONICAS ? 'bg-orange-50 text-orange-700 border-orange-100' : ''}
                          ${article.category === Category.ACTUALIDAD ? 'bg-blue-50 text-blue-700 border-blue-100' : ''}
                          ${article.category === Category.ENTREVISTAS ? 'bg-green-50 text-green-700 border-green-100' : ''}
                          ${article.category === Category.OPINION ? 'bg-purple-50 text-purple-700 border-purple-100' : ''}`}>{article.category}</span>
                      </td>
                      <td className="p-4 align-top pt-4">
                        <div className="flex items-center gap-3">
                           {viewMode === 'active' ? (
                               <><img src={author?.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}`} alt={authorName} className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm" onError={(e) => handleAvatarError(e, authorName)} />
                                <div className="flex flex-col justify-center"><p className="text-sm text-gray-500 font-light flex items-center gap-1 whitespace-nowrap">por <span className="text-brand-red font-bold text-sm">{authorName}</span></p><p className="text-xs text-gray-400 capitalize whitespace-nowrap">{new Date(article.date).toLocaleDateString()}</p></div></>
                           ) : (
                               <div className="flex flex-col justify-center text-sm"><p className="text-gray-600 font-bold">Eliminada el: {new Date((article as ArchivedArticle).archivedAt).toLocaleDateString()}</p><p className="text-xs text-gray-400">Original: {new Date(article.date).toLocaleDateString()}</p></div>
                           )}
                        </div>
                      </td>
                      <td className="p-4 text-right align-top pt-4">
                        <div className="flex items-center justify-end gap-2">
                          {viewMode === 'active' && (
                              <>
                                {!article.isPublished && <button onClick={() => handleApprove(article)} className="p-2 text-yellow-600 bg-yellow-50 hover:bg-green-50 hover:text-green-600 rounded-lg transition-colors border border-yellow-100"><CheckCircle size={18} /></button>}
                                {article.isPublished && <button onClick={() => handleUnpublish(article)} className="p-2 text-gray-400 bg-gray-50 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors border border-transparent hover:border-orange-100"><EyeOff size={18} /></button>}
                                <button onClick={() => setPreviewArticle(article)} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"><Eye size={18} /></button>
                                <Link to={`/editar-noticia/${article.id}`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={18} /></Link>
                                <button onClick={() => promptDelete(article.id, article.title)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                              </>
                          )}
                          {viewMode === 'history' && (
                              <button onClick={() => handleRestore(article.id)} disabled={isSyncing} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 rounded-lg transition-all flex items-center gap-2 text-sm font-medium shadow-sm disabled:opacity-50"><RefreshCcw size={14} className={isSyncing ? "animate-spin" : ""} /> Restaurar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && (
          <div className="p-6 flex justify-center bg-white border-t border-gray-100">
              <button onClick={() => setCurrentPage(prev => prev + 1)} className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-6 rounded-lg transition-colors">Cargar más noticias...</button>
          </div>
      )}

      {articleToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="bg-red-100 p-2 rounded-full"><Archive size={24} /></div><h3 className="text-lg font-bold">¿Archivar noticia?</h3>
              </div>
              <button onClick={cancelDelete} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"><X size={20} /></button>
            </div>
            <p className="text-gray-600 mb-2">Se eliminará de la página web inmediatamente, pero se guardará en el <strong>Historial de Eliminadas</strong> por seguridad.</p>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-6"><p className="font-medium text-gray-900 italic line-clamp-2">"{articleToDelete.title}"</p></div>
            <div className="flex justify-end gap-3">
              <button onClick={cancelDelete} className="px-4 py-2 text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"><Trash2 size={18} /> Eliminar y Archivar</button>
            </div>
          </div>
        </div>
      )}

      {previewArticle && (
        <PreviewModal article={previewArticle} author={authors.find(a => String(a.id) === String(previewArticle.authorId))} onClose={() => setPreviewArticle(null)} />
      )}
    </div>
  );
};
export default ArticlesList;
