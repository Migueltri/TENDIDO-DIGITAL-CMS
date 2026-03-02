
import React, { useState, useEffect } from "react";

// Estructura adaptada al nuevo CMS con array de objetos para imágenes
interface GalleryImage {
  url: string;
  caption: string;
  credit?: string;
}

interface BaseArticle {
  id: number;
  title: string;
  plaza?: string;
  date: string;
  category?: string;
  toreros?: string[];
  ganaderia?: string;
  resultado?: string[];
  torerosRaw?: string;
  image: string;
  imageCaption?: string; // Captura pie de foto de portada
  photoCredit?: string; // Autor de la foto
  contentImages?: GalleryImage[]; // Array flexible para la galería
  video?: string;
  resumen?: string;
  detalles?: string;
  fullContent?: string;
  excerpt?: string;
  boldContent?: boolean;
  author?: string;
  authorLogo?: string;
  showAuthorHeader?: boolean;
  authorId?: string;
  rawDate?: string;
}

type NewsItem = BaseArticle;

// --- DATOS ESTÁTICOS INICIALES (Fallback) ---
const latestNews: NewsItem[] = [
    { 
    id: 235,
    title: `Sábado en el Carnaval del Toro de Ciudad Rodrigo`,
	image: "/images/ciud.jpg",
    category: "Crónicas",
    date: "15 de Febrero de 2026",
	excerpt: "Cuatro orejas y varios novillos aplaudidos en el arrastre en una tarde marcada por el viento, la huella taurina y el debut con entrega de Moisés Fraile.",
	plaza: "Plaza Mayor de Ciudad Rodrigo",
    ganaderia: "Novillos de las ganaderías de Talavante y un eral de El Pilar.",
	torerosRaw: `Diego Urdiales: una oreja.\nAlejandro Talavante: ovación.\nPablo Aguado: una oreja\nEl Mene: una oreja.\nMoisés Fraile: ovación.`,
	fullContent: `En este sábado de carnaval, Ciudad Rodrigo vivió una tarde con una novillada de Talavante sensacional...`,
    author: "Nerea F.Elena",
    authorLogo: "/images/nerea.jpg",
    showAuthorHeader: true
   }
];

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [combinedNews, setCombinedNews] = useState<NewsItem[]>(latestNews); 
  const [news24h, setNews24h] = useState<NewsItem[]>([]); 
  const [activeTab, setActiveTab] = useState('inicio');
  const [newsFilter, setNewsFilter] = useState('todas');
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [visibleNewsCount, setVisibleNewsCount] = useState(15);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [savedPosts, setSavedPosts] = useState<Set<number>>(new Set());
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharePost, setSharePost] = useState<NewsItem | null>(null);

  const isRecent = (rawDate?: string) => {
      if (!rawDate) return false;
      const now = new Date().getTime();
      const itemTime = new Date(rawDate).getTime();
      const diffHours = (now - itemTime) / (1000 * 60 * 60);
      return diffHours <= 48; 
  };
  
  useEffect(() => {
    const loadData = async () => {
      try {
        // Try to fetch from GitHub directly to bypass Vercel build/cache issues
        const githubUrl = `https://raw.githubusercontent.com/MiguelTro/Tendido-Digital/main/public/data/db.json?t=${Date.now()}`;
        let response = await fetch(githubUrl);
        
        if (!response.ok) {
            // Fallback to local file if GitHub fetch fails
            response = await fetch(`/data/db.json?t=${Date.now()}`);
        }
        
        if (!response.ok) {
           console.warn("No se pudo cargar db.json, usando datos estáticos.");
           setCombinedNews(latestNews);
           return;
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
            console.warn("La respuesta es HTML (posiblemente página de error). Usando datos estáticos.");
            setCombinedNews(latestNews);
            return;
        }

        const data = await response.json();
        const fetchedAuthors = data.authors || [];
        const fetchedArticles = data.articles || [];

        const processedArticles = fetchedArticles
            .filter((a: any) => a.isPublished)
            .map((a: any) => {
                const realAuthor = fetchedAuthors.find((au: any) => String(au.id) === String(a.authorId));
                let finalName = realAuthor ? realAuthor.name : "Tendido Digital";
                let finalPic = "/images/tendidodigitallogosimple.png";
                if (realAuthor) {
                     if (realAuthor.imageUrl) finalPic = realAuthor.imageUrl;
                     else finalPic = `https://ui-avatars.com/api/?name=${encodeURIComponent(realAuthor.name)}&background=random&color=fff`;
                }
                if (finalName.trim().toLowerCase() === 'redacción') finalName = "Equipo Tendido"; 

                let gallery: GalleryImage[] = [];
                if (Array.isArray(a.contentImages)) {
                    if (a.contentImages.length > 0 && typeof a.contentImages[0] === 'string') {
                        gallery = a.contentImages.map((url: string) => ({ url, caption: '' }));
                    } else {
                        gallery = a.contentImages;
                    }
                }

                return {
                    id: a.id,
                    title: a.title,
                    image: a.imageUrl,
                    imageCaption: a.imageCaption || '', 
                    photoCredit: a.photoCredit || '', 
                    category: a.category,
                    date: new Date(a.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
                    rawDate: a.date, 
                    excerpt: a.summary,
                    fullContent: a.content,
                    contentImages: gallery, 
                    plaza: a.bullfightLocation,
                    ganaderia: a.bullfightCattle,
                    torerosRaw: a.bullfightResults ? a.bullfightResults.map((r: any) => r.bullfighter + ': ' + r.result).join('\n') : '',
                    author: finalName, 
                    authorLogo: finalPic,
                    showAuthorHeader: true,
                    authorId: a.authorId
                };
            });

        const mergedNews = [...processedArticles, ...latestNews];
        mergedNews.sort((a, b) => {
             const dateA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
             const dateB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
             return dateB - dateA;
        });

        setCombinedNews(mergedNews);

        const breakingNews = mergedNews.filter((n: any) => isRecent(n.rawDate));
        if (breakingNews.length === 0) setNews24h(mergedNews.slice(0, 3));
        else setNews24h(breakingNews);

      } catch (error) {
        console.error("Error procesando noticias:", error);
        setCombinedNews(latestNews); 
      }
    };

    loadData();
  }, []);

  const renderArticleContent = (text?: string | null) => {
      if (!text) return null;
      const processedText = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      if (processedText.includes('<p>') || processedText.includes('<div>') || processedText.includes('<a ')) return <div dangerouslySetInnerHTML={{ __html: processedText }} />;
      return processedText.split('\n').map((p, i) => <p key={i} className="mb-4" dangerouslySetInnerHTML={{ __html: p }}></p>);
  };

  const openNewsModal = (news: any) => { setSelectedNews(news); setIsNewsModalOpen(true); document.body.style.overflow = "hidden"; };
  const closeNewsModal = () => { setIsNewsModalOpen(false); setSelectedNews(null); document.body.style.overflow = "auto"; };
  
  const loadMoreNews = () => { setIsLoadingMore(true); setTimeout(() => { setVisibleNewsCount(prev => prev + 10); setIsLoadingMore(false); }, 500); };
  
  const getFilteredNews = () => {
      if (newsFilter === 'todas') return combinedNews;
      return combinedNews.filter(n => n.category?.toLowerCase().includes(newsFilter.toLowerCase()));
  };
  
  const scrollToSection = (id: string) => { 
      const el = document.getElementById(id); 
      if(el) el.scrollIntoView({behavior: 'smooth'}); 
      setIsMenuOpen(false); 
  };
  
  const toggleSave = (id: number, e?: React.MouseEvent) => {
      if(e) e.stopPropagation();
      const newSaved = new Set(savedPosts);
      if (newSaved.has(id)) newSaved.delete(id);
      else newSaved.add(id);
      setSavedPosts(newSaved);
  };

  const openShareModal = (news: NewsItem, e?: React.MouseEvent) => {
      if(e) e.stopPropagation();
      setSharePost(news);
      setIsShareModalOpen(true);
  };
  
  const closeShareModal = () => { setIsShareModalOpen(false); setSharePost(null); };

  const SponsorBanner = () => (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 flex flex-col items-center justify-center my-8 cursor-pointer transition-transform duration-300 hover:scale-[1.02]">
        <a href="https://tauromania.es" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center">
        <img src="/images/tauromania.png" alt="TauroManía logo" className="w-52 md:w-64 object-contain" />
        <p className="text-gray-700 font-medium text-sm text-center mt-3">Colaboración <span className="font-bold text-yellow-600">- TauroManía</span></p>
        </a>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      
      {/* HEADER */}
      <header className={`bg-white/98 backdrop-blur-md shadow-sm sticky top-0 z-50 transition-all duration-300 border-b border-gray-100 ${scrollY > 50 ? 'shadow-md' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
                <img src="/images/tendidodigitallogosimple.png" alt="Logo" className="h-12 w-auto mix-blend-multiply" />
                <span className="text-xl font-bold bg-gradient-to-r from-red-600 to-yellow-500 bg-clip-text text-transparent font-sans">
                    TENDIDO DIGITAL
                </span>
            </div>
             <nav className="hidden md:flex space-x-6 font-medium text-gray-700">
                <button onClick={() => {setActiveTab('inicio'); scrollToSection('inicio');}} className="hover:text-red-600 transition-colors">Inicio</button>
                <button onClick={() => {setActiveTab('inicio'); scrollToSection('actualidad');}} className="hover:text-red-600 transition-colors">Actualidad</button>
                <button onClick={() => {setActiveTab('inicio'); setNewsFilter('Crónicas'); scrollToSection('actualidad');}} className="hover:text-red-600 transition-colors">Crónicas</button>
                <button onClick={() => {setActiveTab('inicio'); setNewsFilter('Entrevistas'); scrollToSection('actualidad');}} className="hover:text-red-600 transition-colors">Entrevistas</button>
                <button onClick={() => scrollToSection('contacto')} className="hover:text-red-600 transition-colors">Contacto</button>
            </nav>
            <button className="md:hidden text-2xl" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                <i className={isMenuOpen ? "ri-close-line" : "ri-menu-line"}></i>
            </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      {/* CARRUSEL PORTADA */}
        <section id="inicio" className="relative w-full h-[60vh] md:h-[75vh] overflow-hidden bg-black">
            {combinedNews.slice(0, 3).map((news, index) => (
                <div key={news.id} className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
                    <img src={news.image} alt={news.title} className="w-full h-full object-cover opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                    <div className="absolute bottom-0 left-0 w-full p-8 md:p-16 text-center md:text-left">
                        <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold uppercase mb-4 inline-block">{news.category}</span>
                        <h1 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight drop-shadow-lg font-serif">{news.title}</h1>
                        <button onClick={() => openNewsModal(news)} className="bg-white text-black px-6 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors">
                            Leer noticia completa
                        </button>
                    </div>
                </div>
            ))}
            <div className="absolute bottom-8 right-8 z-20 flex gap-2">
                <button onClick={() => setCurrentSlide((prev) => (prev === 0 ? Math.min(combinedNews.length, 3) - 1 : prev - 1))} className="bg-white/20 hover:bg-white/40 p-3 rounded-full text-white backdrop-blur"><i className="ri-arrow-left-line"></i></button>
                <button onClick={() => setCurrentSlide((prev) => (prev + 1) % Math.min(combinedNews.length, 3))} className="bg-white/20 hover:bg-white/40 p-3 rounded-full text-white backdrop-blur"><i className="ri-arrow-right-line"></i></button>
            </div>
        </section>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
            
            {/* --- SECCIÓN PANEL 24 HORAS (SIEMPRE VISIBLE) --- */}
            <section id="tablero-24h" className="animate-fade-in-down bg-red-50 p-6 rounded-2xl border border-red-100 mb-12 shadow-inner">
                <div className="flex items-center gap-3 mb-6 pb-2 border-b-2 border-red-200">
                    <span className="bg-red-600 text-white p-2 rounded-lg animate-pulse shadow-red-300 shadow-lg">
                        <i className="ri-flashlight-fill text-xl"></i>
                    </span>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tight font-sans">
                            Última Hora <span className="text-red-600">(24H)</span>
                        </h2>
                        <p className="text-sm text-gray-500 font-medium">Las noticias más recientes del día</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {news24h.map(news => (
                        <article 
                            key={news.id}
                            onClick={() => openNewsModal(news)}
                            className="bg-white rounded-xl shadow-md overflow-hidden border-l-4 border-red-500 hover:shadow-xl transition-all cursor-pointer group transform hover:-translate-y-1"
                        >
                            <div className="relative h-48 overflow-hidden">
                                <img src={news.image} alt={news.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            </div>
                            <div className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold text-gray-700 truncate">{news.author}</span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2 group-hover:text-red-600 transition-colors line-clamp-2 font-serif">
                                    {news.title}
                                </h3>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            {/* --- SECCIÓN ACTUALIDAD --- */}
            <section id="actualidad">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 font-serif">Hemeroteca y Actualidad</h2>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                        {['todas', 'actualidad', 'Crónicas', 'Opinión', 'Entrevistas'].map(cat => (
                            <button 
                                key={cat}
                                onClick={() => setNewsFilter(cat === 'todas' ? 'todas' : cat)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${newsFilter.toLowerCase() === cat.toLowerCase() ? 'bg-red-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {getFilteredNews()
                        .slice(0, visibleNewsCount)
                        .map((news, index) => (
                        <React.Fragment key={news.id}>
                            <article 
                                onClick={() => openNewsModal(news)}
                                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer group flex flex-col h-full"
                            >
                                <div className="relative h-56 overflow-hidden">
                                    <img src={news.image} alt={news.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy"/>
                                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-gray-800 shadow-sm uppercase tracking-wide">
                                        {news.category}
                                    </div>
                                </div>
                                
                                <div className="p-6 flex flex-col flex-1">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-gray-900">{news.author}</span>
                                            <span className="text-[10px] text-gray-400 uppercase">{news.date}</span>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-900 mb-3 leading-snug group-hover:text-red-600 transition-colors line-clamp-3 font-serif">
                                        {news.title}
                                    </h3>
                                    <p className="text-gray-500 text-sm line-clamp-3 mb-4 flex-1">
                                        {news.excerpt}
                                    </p>
                                </div>
                            </article>
                            {(index + 1) % 6 === 0 && <div className="col-span-full"><SponsorBanner /></div>}
                        </React.Fragment>
                    ))}
                </div>

                {visibleNewsCount < getFilteredNews().length && (
                    <div className="text-center mt-12">
                        <button 
                            onClick={loadMoreNews}
                            className="bg-white border border-gray-300 text-gray-700 px-8 py-3 rounded-full font-bold hover:border-red-600 hover:text-red-600 transition-all shadow-sm"
                        >
                            {isLoadingMore ? 'Cargando...' : 'Cargar más noticias'}
                        </button>
                    </div>
                )}
            </section>
        </main>
      
      {/* SECCIÓN CONTACTO */}
      <section id="contacto" className="py-16 bg-gradient-to-br from-red-700 to-red-900 text-white mt-12">
          <div className="max-w-4xl mx-auto px-4 text-center">
              <h2 className="text-3xl font-bold mb-6 font-serif">Contacta con Nosotros</h2>
              <form className="max-w-lg mx-auto space-y-4 text-left bg-white/10 p-8 rounded-xl backdrop-blur-sm">
                  <input type="text" placeholder="Nombre" className="w-full p-3 rounded bg-white/20 border border-white/30 text-white placeholder-white/70 focus:outline-none focus:bg-white/30" />
                  <input type="email" placeholder="Email" className="w-full p-3 rounded bg-white/20 border border-white/30 text-white placeholder-white/70 focus:outline-none focus:bg-white/30" />
                  <textarea rows={4} placeholder="Mensaje" className="w-full p-3 rounded bg-white/20 border border-white/30 text-white placeholder-white/70 focus:outline-none focus:bg-white/30"></textarea>
                  <button className="w-full bg-white text-red-700 font-bold py-3 rounded hover:bg-gray-100 transition-colors">Enviar Mensaje</button>
              </form>
          </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 text-center">
              <p className="text-sm">© 2025 Tendido Digital. Todos los derechos reservados.</p>
          </div>
      </footer>

      {/* MODAL LECTURA NOTICIA */}
      {isNewsModalOpen && selectedNews && (
        <div className="fixed inset-0 bg-white z-[100] overflow-y-auto animate-fade-in font-serif">
            <div className="max-w-4xl mx-auto bg-white min-h-screen relative shadow-2xl">
                <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex justify-between items-center z-10 font-sans">
                    <button onClick={closeNewsModal} className="flex items-center gap-2 text-gray-600 hover:text-red-600 font-medium">
                        <i className="ri-arrow-left-line text-xl"></i> Volver
                    </button>
                    <div className="flex gap-4">
                        <button onClick={(e) => toggleSave(selectedNews.id, e)} className="text-gray-400 hover:text-yellow-500"><i className="ri-bookmark-line text-xl"></i></button>
                        <button onClick={(e) => openShareModal(selectedNews, e)} className="text-gray-400 hover:text-blue-500"><i className="ri-share-line text-xl"></i></button>
                    </div>
                </div>

                <div className="relative w-full">
                    {/* IMAGEN DE PORTADA CON PIE DE FOTO */}
                    <figure className="relative w-full">
                         <img src={selectedNews.image} className="w-full max-h-[60vh] object-cover" alt={selectedNews.title} />
                         {(selectedNews.imageCaption || selectedNews.photoCredit) && (
                             <figcaption className="px-6 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 italic flex justify-between font-sans">
                                 <span>{selectedNews.imageCaption}</span>
                                 {selectedNews.photoCredit && <span className="font-bold not-italic">Foto: {selectedNews.photoCredit}</span>}
                             </figcaption>
                         )}
                    </figure>

                    <div className="absolute bottom-12 left-0 w-full p-8 md:p-12 pointer-events-none">
                         {/* Titular flotante sobre la imagen (opcional, lo mantenemos por diseño) */}
                    </div>
                </div>

                <div className="px-6 py-10 md:px-12">
                    <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4 font-serif text-gray-900">
                        {selectedNews.title}
                    </h1>

                    <div className="flex items-center gap-3 mb-8 pb-8 border-b border-gray-100 font-sans">
                        <img 
                            src={selectedNews.authorLogo} 
                            className="w-12 h-12 rounded-full border border-gray-200" 
                            alt={selectedNews.author}
                            onError={(e) => e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedNews.author || 'A')}`}
                        />
                        <div>
                            <p className="font-bold text-base text-gray-800">Por {selectedNews.author}</p>
                            <p className="text-sm text-gray-500">{selectedNews.date}</p>
                        </div>
                    </div>

                    <p className="text-xl md:text-2xl text-gray-600 font-serif italic mb-10 border-l-4 border-red-600 pl-6 py-2 leading-relaxed">
                        {selectedNews.excerpt}
                    </p>

                    <div className="prose prose-lg max-w-none text-gray-800 leading-relaxed font-serif">
                        {renderArticleContent(selectedNews.fullContent)}
                    </div>
                    
                    {/* GALERÍA DE IMÁGENES AL FINAL (Con soporte para PIES DE FOTO HTML STANDARD) */}
                    {selectedNews.contentImages && selectedNews.contentImages.length > 0 && (
                        <div className="mt-12 space-y-12 flex flex-col items-center">
                            {selectedNews.contentImages.map((img: GalleryImage, idx: number) => (
                                <figure key={idx} className="w-full flex flex-col items-center">
                                    <img
                                        src={img.url}
                                        alt={`Imagen ${idx + 1}`}
                                        className="w-full max-w-4xl rounded-md shadow-sm"
                                    />
                                    {/* PIE DE FOTO DE GALERÍA: Pequeño y debajo */}
                                    {(img.caption || img.credit) && (
                                        <figcaption className="w-full max-w-4xl mt-1.5 flex justify-between text-xs text-gray-500 font-sans border-b border-gray-100 pb-1">
                                            <span className="italic">{img.caption}</span>
                                            {img.credit && <span className="font-bold not-italic ml-2">Foto: {img.credit}</span>}
                                        </figcaption>
                                    )}
                                </figure>
                            ))}
                        </div>
                    )}

                    {selectedNews.plaza && (
                        <div className="mt-12 bg-gray-50 p-8 rounded-xl border border-gray-200">
                            <h4 className="font-bold text-gray-900 uppercase tracking-wide mb-6 border-b pb-2 flex items-center gap-2 font-sans">
                                <i className="ri-file-list-3-line"></i> Ficha del Festejo
                            </h4>
                            <div className="grid md:grid-cols-2 gap-6 text-base mb-6 font-sans">
                                <div><span className="font-bold text-gray-600 block text-xs uppercase mb-1">Plaza</span> {selectedNews.plaza}</div>
                                <div><span className="font-bold text-gray-600 block text-xs uppercase mb-1">Ganadería</span> {selectedNews.ganaderia}</div>
                            </div>
                            {selectedNews.torerosRaw && (
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <pre className="font-sans text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedNews.torerosRaw}</pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Modal Compartir */}
      {isShareModalOpen && sharePost && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm font-sans">
                <h3 className="text-lg font-bold mb-4">Compartir Noticia</h3>
                <p className="text-gray-600 mb-6">{sharePost.title}</p>
                <div className="space-y-2">
                    <button onClick={() => alert("Compartido en WhatsApp")} className="w-full bg-green-500 text-white py-2 rounded-lg font-bold">WhatsApp</button>
                    <button onClick={() => alert("Compartido en Twitter")} className="w-full bg-blue-400 text-white py-2 rounded-lg font-bold">Twitter</button>
                    <button onClick={() => alert("Enlace Copiado")} className="w-full bg-gray-100 text-gray-800 py-2 rounded-lg font-bold">Copiar Enlace</button>
                </div>
                <button onClick={closeShareModal} className="mt-4 text-gray-500 text-sm w-full text-center">Cancelar</button>
            </div>
          </div>
      )}

    </div>
  );
}
