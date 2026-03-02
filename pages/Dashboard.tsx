
import React, { useEffect, useState } from 'react';
import { getArticles, getAuthors } from '../services/dataService';
import { syncWithGitHub, getSettings, verifyConnection } from '../services/githubService';
import { Article, Category } from '../types';
import { Newspaper, Users, MessageSquare, TrendingUp, CloudUpload, RefreshCw, CheckCircle2, Wifi, WifiOff, AlertTriangle, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PreviewModal from '../components/PreviewModal';

const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between transition-transform hover:scale-[1.02]">
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
    </div>
    <div className={`p-4 rounded-full ${color} text-white shadow-lg shadow-${color.replace('bg-', '')}/30`}>
      {icon}
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [authorCount, setAuthorCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);

  useEffect(() => {
    // 1. Carga inicial local
    setArticles(getArticles());
    setAuthorCount(getAuthors().length);

    // 2. Verificar conexión y descargar datos
    checkAndSync();
  }, []);

  const checkAndSync = async () => {
      const settings = getSettings();
      if (!settings.githubToken) {
          setConnectionStatus('error');
          return;
      }

      // Verificar conexión
      try {
          const connection = await verifyConnection();
          if (connection.success) {
              setConnectionStatus('connected');
              // Si hay conexión, intentamos descargar actualizaciones silenciosamente
              handleAutoDownload();
          } else {
              setConnectionStatus('error');
              setStatusMsg(connection.message);
          }
      } catch (e) {
          setConnectionStatus('error');
      }
  };

  const handleAutoDownload = async () => {
      try {
          // Use syncWithGitHub instead of downloadFromGitHub to perform a smart merge
          // and prevent overwriting local data if the remote is temporarily stale.
          const result = await syncWithGitHub();
          if (result.success) {
              setArticles(getArticles());
              setAuthorCount(getAuthors().length);
              console.log("✅ Datos sincronizados con la nube automáticamente (Smart Merge).");
          }
      } catch (error) {
          console.error("Error en auto-sync:", error);
      }
  };

  const handleSync = async () => {
      if(!confirm("Esto enviará TODAS las noticias locales a la página web, actualizando lo que ve el público. ¿Continuar?")) return;
      
      setIsSyncing(true);
      setStatusMsg('Conectando con GitHub y subiendo cambios...');
      const result = await syncWithGitHub(true);
      setStatusMsg(result.message);
      setIsSyncing(false);
      
      if (result.success) {
          setConnectionStatus('connected');
          // Refrescar datos locales tras sync
          setArticles(getArticles());
          alert("✅ ¡Publicación completada con éxito! La web está actualizada.");
      } else {
          setConnectionStatus('error');
          alert("❌ Error al publicar: " + result.message);
      }

      setTimeout(() => setStatusMsg(''), 8000);
  };

  const cronicasCount = articles.filter(a => a.category === Category.CRONICAS).length;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between md:items-start gap-6">
        <div>
            <h2 className="text-3xl font-bold text-gray-800 font-serif">Hola, {currentUser?.name || 'Editor'}</h2>
            <p className="text-gray-500 mt-1">Bienvenido al panel de control de Tendido Digital.</p>
            
            {/* Connection Status Badge */}
            <div className="mt-3 flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm transition-colors border">
                    {connectionStatus === 'checking' && (
                        <span className="text-gray-600 bg-gray-100 border-gray-200 flex items-center gap-2">
                            <RefreshCw size={12} className="animate-spin" /> Conectando...
                        </span>
                    )}
                    {connectionStatus === 'connected' && (
                        <span className="text-green-700 bg-green-50 border-green-200 flex items-center gap-2">
                            <Wifi size={14} /> Conectado con la Web
                        </span>
                    )}
                    {connectionStatus === 'error' && (
                        <Link to="/configuracion" className="text-orange-700 bg-orange-50 border-orange-200 flex items-center gap-2 hover:bg-orange-100 cursor-pointer">
                            <WifiOff size={14} /> Modo Local (Sin Nube)
                        </Link>
                    )}
                </div>
                {connectionStatus === 'connected' && (
                    <a 
                        href="https://vercel.com/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm transition-colors border border-gray-200 bg-white text-black hover:bg-gray-50"
                        title="Ver despliegue en Vercel"
                    >
                        <svg viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-3 w-3">
                            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="currentColor"/>
                        </svg>
                        Vercel
                    </a>
                )}
            </div>
        </div>
        
        {/* Sync Controls */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <button 
                onClick={handleSync}
                disabled={isSyncing}
                className="bg-brand-dark text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50 font-bold shadow-md transition-all active:scale-95"
            >
                <CloudUpload size={18} />
                {isSyncing ? 'Subiendo...' : 'Subir cambios a la web'}
            </button>
        </div>
      </div>

      {statusMsg && (
          <div className={`p-4 rounded-lg text-center font-medium animate-fade-in-down shadow-sm border ${statusMsg.includes('Error') ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
              {statusMsg}
          </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Noticias" 
          value={articles.length} 
          icon={<Newspaper size={24} />} 
          color="bg-brand-red" 
        />
        <StatCard 
          title="Crónicas" 
          value={cronicasCount} 
          icon={<TrendingUp size={24} />} 
          color="bg-blue-600" 
        />
        <StatCard 
          title="Autores" 
          value={authorCount} 
          icon={<Users size={24} />} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="Opinión" 
          value={articles.filter(a => a.category === Category.OPINION).length} 
          icon={<MessageSquare size={24} />} 
          color="bg-purple-500" 
        />
      </div>

      <div className="bg-gradient-to-br from-gray-900 to-brand-dark p-8 rounded-2xl text-white shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-32 bg-brand-red rounded-full opacity-10 blur-3xl group-hover:opacity-20 transition-opacity duration-700"></div>
        <div className="relative z-10 text-center">
            <h3 className="text-2xl font-bold mb-3 font-serif">Panel de Redacción</h3>
            <p className="text-gray-300 mb-8 max-w-lg mx-auto">Todo listo para informar. ¿Qué quieres hacer ahora?</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link to="/crear-noticia" className="bg-brand-red text-white px-8 py-3 rounded-full font-bold hover:bg-red-600 hover:shadow-lg hover:shadow-red-900/50 transition-all transform hover:-translate-y-1">
                    Redactar Nueva Noticia
                </Link>
                <Link to="/noticias" className="bg-white/10 backdrop-blur border border-white/20 text-white px-8 py-3 rounded-full font-medium hover:bg-white/20 transition-all">
                    Ver Listado de Noticias
                </Link>
            </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewArticle && (
        <PreviewModal 
          article={previewArticle} 
          author={getAuthors().find(a => String(a.id) === String(previewArticle.authorId))}
          onClose={() => setPreviewArticle(null)} 
        />
      )}
    </div>
  );
};

export default Dashboard;
