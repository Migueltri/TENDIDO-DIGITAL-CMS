import React, { useEffect, useState, useRef } from 'react';
import ImageCropper from '../components/ImageCropper';
import { useNavigate, useParams } from 'react-router-dom';
import { getArticleById, getArticles, getAuthors, saveArticle, saveAuthor, subscribeToData, isDataReady } from '../services/dataService';
import { compressImage } from '../services/imageService';
import { Article, Author, Category, BullfightResult, GalleryImage } from '../types';
import { ArrowLeft, Image as ImageIcon, UploadCloud, X, Plus, Bold, Italic, List, Shield, MapPin, Award, Trash2, FileEdit, Send, Camera, Loader2, MessageSquare, Camera as CameraIcon, Link as LinkIcon, Calendar, Edit2 } from 'lucide-react';import { useAuth } from '../contexts/AuthContext';

// TRADUCTOR DE IMÁGENES AL CMS
const getCMSImageUrl = (url: any) => {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('data:image') || url.startsWith('http')) return url;
    let cleanPath = url.startsWith('/') ? url.substring(1) : url;
    if (!cleanPath.startsWith('images/')) cleanPath = `images/${cleanPath}`;
    return `https://raw.githubusercontent.com/Migueltri/TENDIDO-DIGITAL-CMS/main/public/${cleanPath}`;
};

const ArticleForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, currentUser } = useAuth();
  const isEditMode = !!id;

  const [authors, setAuthors] = useState<Author[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [formIsDirty, setFormIsDirty] = useState(false); 
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

  const [formData, setFormData] = useState<Partial<Article>>({
    id: generateId(), title: '', summary: '', content: '', category: Category.ACTUALIDAD,
    imageUrl: '', imageCaption: '', photoCredit: '', contentImages: [], authorId: '',
    date: new Date().toISOString(), isPublished: false, bullfightLocation: '',
    bullfightCattle: '', bullfightSummary: '', bullfightResults: []
  });

  const [newResult, setNewResult] = useState<BullfightResult>({ bullfighter: '', result: '' });

  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const authorImageInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const bullfighterInputRef = useRef<HTMLInputElement>(null);

  // CONEXIÓN ASÍNCRONA SEGURA AL NUEVO MOTOR DE DATOS
  useEffect(() => {
    const unsubscribe = subscribeToData(() => {
        setAuthors(getAuthors());
        
        if (!hasLoaded) {
            if (isEditMode && id) {
              const article = getArticleById(id);
              if (article) {
                if (!isAdmin && article.authorId !== currentUser?.id) {
                     alert("⛔ No tienes permisos para editar esta noticia.");
                     navigate('/noticias');
                     return;
                }
                let processedGallery = article.contentImages || [];
                if (processedGallery.length > 0 && typeof processedGallery[0] === 'string') {
                    processedGallery = (processedGallery as any).map((url: string) => ({ url, caption: '' }));
                }
                // Extraemos el contenido real asegurando compatibilidad de nombres
                const loadedContent = article.fullContent || article.content || '';
                
                setFormData({ ...article, contentImages: processedGallery, content: loadedContent });
                setHasLoaded(true);
                
                // Forzamos a React a esperar 150ms para asegurar que el DOM existe antes de inyectar
                setTimeout(() => {
                    if (editorRef.current) {
                        editorRef.current.innerHTML = loadedContent;
                    }
                }, 150);
              } else if (isDataReady) {
                // Si la base de datos ya está lista pero no hay noticia, volvemos
                navigate('/noticias');
              }
            } else {
                const savedDraft = localStorage.getItem('td_draft_article');
                if (savedDraft) {
                    try {
                        const draft = JSON.parse(savedDraft);
                        if (window.confirm("¡Hemos encontrado un borrador no guardado! ¿Quieres recuperarlo?")) {
                            setFormData(draft);
                            if (editorRef.current) editorRef.current.innerHTML = draft.content || '';
                            setDraftRecovered(true);
                        } else {
                            localStorage.removeItem('td_draft_article');
                            setFormData(prev => ({ ...prev, id: generateId(), authorId: currentUser?.id || '' }));
                        }
                    } catch (e) { console.error(e); }
                } else {
                    setFormData(prev => ({ ...prev, id: generateId(), authorId: currentUser?.id || '' }));
                }
                setHasLoaded(true);
            }
        }
    });
    return unsubscribe;
  }, [id, isEditMode, navigate, currentUser, isAdmin, hasLoaded]);

  useEffect(() => {
      if (!isEditMode && formIsDirty && hasLoaded) {
          const draftToSave = { ...formData };
          delete draftToSave.imageUrl;
          delete draftToSave.contentImages;
          try { localStorage.setItem('td_draft_article', JSON.stringify(draftToSave)); } catch (e) {}
      }
  }, [formData, isEditMode, formIsDirty, hasLoaded]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFormIsDirty(true);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (!val) return;
      const localDate = new Date(val);
      if (!isNaN(localDate.getTime())) {
          setFormData(prev => ({ ...prev, date: localDate.toISOString() }));
          setFormIsDirty(true);
      }
  };

  // --- SISTEMA DE RECORTE PARA IMAGEN PRINCIPAL (TITULAR) ---
  const [mainImageToCrop, setMainImageToCrop] = useState<string | null>(null);

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // En lugar de guardar directo, abrimos el recortador
      setMainImageToCrop(URL.createObjectURL(file));
      if (mainImageInputRef.current) mainImageInputRef.current.value = '';
    }
  };

  const handleMainCropDone = (base64Image: string) => {
    setFormData(prev => ({ ...prev, imageUrl: base64Image }));
    setFormIsDirty(true);
    setMainImageToCrop(null);
  };

  const handleMainCropCancel = () => {
    setMainImageToCrop(null);
  };

  // --- NUEVO SISTEMA DE COLA PARA RECORTAR GALERÍA ---
  const [pendingCrops, setPendingCrops] = useState<string[]>([]);
  const [isCroppingGallery, setIsCroppingGallery] = useState(false);

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newImagesToCrop = [];
      for (let i = 0; i < files.length; i++) {
        // Convertimos el archivo en una URL temporal para que el recortador pueda leerla
        newImagesToCrop.push(URL.createObjectURL(files[i]));
      }
      setPendingCrops(newImagesToCrop);
      setIsCroppingGallery(true);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleCropDone = (base64Image: string) => {
    // 1. Guardamos la foto ya recortada
    setFormData(prev => ({ 
       ...prev, 
       contentImages: [...(prev.contentImages || []), { url: base64Image, caption: '', credit: '' }] 
    }));
    setFormIsDirty(true);
    
    // 2. Pasamos a la siguiente foto de la cola (si subió varias)
    const nextCrops = [...pendingCrops];
    nextCrops.shift();
    if (nextCrops.length > 0) {
      setPendingCrops(nextCrops);
    } else {
      setIsCroppingGallery(false);
    }
  };

  const handleCropCancel = () => {
    // Si cancela, saltamos esta foto y vamos a la siguiente
    const nextCrops = [...pendingCrops];
    nextCrops.shift();
    if (nextCrops.length > 0) {
      setPendingCrops(nextCrops);
    } else {
      setIsCroppingGallery(false);
    }
  };

  const handleAuthorImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && formData.authorId) {
          setLoadingImage(true);
          try {
              const compressed = await compressImage(file, 400, 0.8);
              const authorToUpdate = authors.find(a => a.id === formData.authorId);
              if (authorToUpdate) {
                  const newAuthorData = { ...authorToUpdate, imageUrl: compressed };
                  saveAuthor(newAuthorData, true);
                  import('../services/githubService').then(({ syncWithGitHub }) => syncWithGitHub(true));
              }
          } catch(e) { alert("Error al subir foto de autor"); } 
          finally { setLoadingImage(false); }
      }
  };

  const removeGalleryImage = (indexToRemove: number) => {
      setFormData(prev => ({ ...prev, contentImages: prev.contentImages?.filter((_, index) => index !== indexToRemove) }));
      setFormIsDirty(true);
  };

  const updateGalleryCaption = (index: number, caption: string) => {
      setFormData(prev => {
          const newImages = [...(prev.contentImages || [])];
          if(newImages[index]) newImages[index] = { ...newImages[index], caption };
          return { ...prev, contentImages: newImages };
      });
  };

  const updateGalleryCredit = (index: number, credit: string) => {
      setFormData(prev => {
          const newImages = [...(prev.contentImages || [])];
          if(newImages[index]) newImages[index] = { ...newImages[index], credit };
          return { ...prev, contentImages: newImages };
      });
  };

  const addResult = () => {
    if (newResult.bullfighter && newResult.result) {
        setFormData(prev => ({ ...prev, bullfightResults: [...(prev.bullfightResults || []), newResult] }));
        setNewResult({ bullfighter: '', result: '' });
        setFormIsDirty(true);
        setTimeout(() => bullfighterInputRef.current?.focus(), 50);
    }
  };
  
  const handleResultKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); addResult(); } };
  const removeResult = (index: number) => { setFormData(prev => ({ ...prev, bullfightResults: prev.bullfightResults?.filter((_, i) => i !== index) })); setFormIsDirty(true); };
  const editResult = (index: number) => {
      const currentResults = [...(formData.bullfightResults || [])];
      const resultToEdit = currentResults[index];
      
      if (resultToEdit) {
          // 1. Ponemos los datos en las cajas de abajo
          setNewResult({ 
              bullfighter: resultToEdit.bullfighter, 
              result: resultToEdit.result 
          });
          
          // 2. Lo eliminamos de la lista visual
          currentResults.splice(index, 1);
          setFormData(prev => ({ ...prev, bullfightResults: currentResults }));
          setFormIsDirty(true);
          
          // 3. Hacemos scroll automático para que el redactor vea dónde ha ido a parar el texto
          setTimeout(() => {
              if (bullfighterInputRef.current) {
                  bullfighterInputRef.current.focus();
                  bullfighterInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
          }, 50);
      }
  };
  const handleFormat = (e: React.MouseEvent, command: string) => { 
      e.preventDefault(); // Evita que el botón robe el foco
      editorRef.current?.focus(); // Obliga al cursor a quedarse en el texto
      document.execCommand(command, false); 
      setFormIsDirty(true);
  };

// --- PARCHE DE EMERGENCIA: BLOQUEO DE IMÁGENES INLINE (Base64) ---
  
  // Función auxiliar para detectar imágenes en eventos
  const isImageTransfer = (data: DataTransfer | null) => {
      if (!data?.items) return false;
      for (let i = 0; i < data.items.length; i++) {
          if (data.items[i].type.indexOf('image') !== -1) {
              return true;
          }
      }
      return false;
  };

  // 1. Manejador de Pegado (onPaste - Ctrl+V) - BLINDADO CONTRA FORMATOS EXTERNOS
  const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault(); // Bloqueamos la acción por defecto del navegador

      if (isImageTransfer(e.clipboardData)) {
          alert("❌ ERROR: No puedes pegar fotos directamente en el texto.\n\nEsto satura la base de datos y tumbará la web. Por favor, sube las fotos usando el botón 'Añadir Fotos' en la sección de Galería.");
          return;
      }

      // Si es texto, le quitamos todo el formato sucio (enlaces, colores, estilos de otras webs)
      const text = e.clipboardData.getData('text/plain');
      // Lo inyectamos como texto 100% puro
      document.execCommand('insertText', false, text);
  };

  // 2. Manejador de Arrastre (onDrop)
  const handleDrop = (e: React.DragEvent) => {
      if (isImageTransfer(e.dataTransfer)) {
          e.preventDefault();
          alert("❌ ERROR: No puedes arrastrar fotos directamente al texto.\n\nEsto satura la base de datos y tumbará la web. Por favor, sube las fotos usando el botón 'Añadir Fotos' en la sección de Galería.");
      }
  };

  const handleLink = () => {
    const url = prompt('Introduce el enlace (URL):', 'https://');
    if (url) {
      document.execCommand('createLink', false, url);
      if (editorRef.current) {
        const links = editorRef.current.getElementsByTagName('a');
        for (let i = 0; i < links.length; i++) {
          if (links[i].getAttribute('href') === url && !links[i].getAttribute('target')) {
            links[i].setAttribute('target', '_blank'); links[i].setAttribute('rel', 'noopener noreferrer');
          }
        }
        setFormData(prev => ({ ...prev, content: editorRef.current!.innerHTML }));
      }
      editorRef.current?.focus();
    }
  };

  const handleSave = async (e: React.MouseEvent, shouldPublish: boolean) => {
    if (isSubmitting || loadingImage) return; 
    if (!formData.title || !formData.authorId) { alert('Por favor completa el Título y el Autor.'); return; }
    if (!formData.imageUrl) { alert('Por favor sube una imagen de portada para la noticia.'); return; }

    const isValidUrl = (url: string) => { try { if (url.startsWith('data:image/') || url.startsWith('/')) return true; new URL(url); return true; } catch (e) { return false; } };
    if (!isValidUrl(formData.imageUrl)) { alert('La URL de la imagen de portada no es válida.'); return; }

    // BLOQUEAMOS LA INTERFAZ MIENTRAS SE SUBEN LAS FOTOS
    setIsSubmitting(true);

    try {
        // --- BLINDAJE DE IMÁGENES: Subir a la nube y guardar solo la URL ---
        const { uploadImageAndGetUrl, getSettings } = await import('../services/githubService');
        const settings = getSettings();

        // 1. Procesar la imagen de portada
        let finalImageUrl = formData.imageUrl;
        if (finalImageUrl.startsWith('data:image')) {
            finalImageUrl = await uploadImageAndGetUrl(settings, finalImageUrl, `portada-${Date.now()}.jpg`);
        }

        // 2. Procesar las imágenes de la galería
        let finalContentImages = [...(formData.contentImages || [])];
        for (let i = 0; i < finalContentImages.length; i++) {
            let img = finalContentImages[i];
            let urlToCheck = typeof img === 'string' ? img : img.url;

            if (urlToCheck && urlToCheck.startsWith('data:image')) {
                const cloudUrl = await uploadImageAndGetUrl(settings, urlToCheck, `galeria-${Date.now()}-${i}.jpg`);
                if (typeof img === 'string') {
                    finalContentImages[i] = cloudUrl;
                } else {
                    finalContentImages[i] = { ...img, url: cloudUrl };
                }
            }
        }
        // -------------------------------------------------------------------

        const finalContent = editorRef.current?.innerHTML || formData.content || '';

        const articleToSave: Article = {
          id: formData.id || generateId(), title: formData.title || '', summary: formData.summary || '',
          content: finalContent, category: formData.category as Category, authorId: formData.authorId || '',
          imageUrl: finalImageUrl || 'https://picsum.photos/800/600', imageCaption: formData.imageCaption || '',
          photoCredit: formData.photoCredit || '', contentImages: finalContentImages || [],
          date: formData.date || new Date().toISOString(), isPublished: shouldPublish,
          lastModified: new Date().toISOString(), bullfightLocation: formData.bullfightLocation || '',
          bullfightCattle: formData.bullfightCattle || '', bullfightSummary: formData.bullfightSummary || '',
          bullfightResults: formData.bullfightResults || [], customOrder: formData.customOrder || 0
        };

        if (shouldPublish) {
            saveArticle(articleToSave, true); 
            const { syncWithGitHub } = await import('../services/githubService');
            const result = await syncWithGitHub(true);
            localStorage.removeItem('td_draft_article');
            if (result.success) { alert("✅ ¡Noticia publicada con éxito! Las imágenes se han optimizado en la nube."); navigate('/noticias'); } 
            else { alert(`⚠️ Hubo un problema subiendo a la web: ${result.message}`); setIsSubmitting(false); }
        } else {
            saveArticle(articleToSave);
            localStorage.removeItem('td_draft_article');
            setIsSubmitting(false);
            navigate('/noticias');
        }
    } catch (error: any) {
        setIsSubmitting(false);
        alert("❌ Error al guardar o subir las imágenes: " + error.message);
    }
  };

  const handleCancel = (e?: React.MouseEvent) => {
      if(e) e.preventDefault();
      if (formIsDirty) { if (confirm("Tienes cambios sin guardar. ¿Seguro que quieres salir?")) navigate('/noticias'); } 
      else navigate('/noticias');
  };

  const getSelectedAuthor = () => authors.find(a => a.id === formData.authorId);
  const getFormattedDateValue = () => {
      if (!formData.date) return '';
      try { const d = new Date(formData.date); if (isNaN(d.getTime())) return ''; const offsetMs = d.getTimezoneOffset() * 60000; return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16); } catch (e) { return ''; }
  };
  
  if (!hasLoaded) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
              <Loader2 className="animate-spin text-brand-red w-12 h-12" />
              <p className="text-gray-500 font-medium animate-pulse">Cargando base de datos...</p>
          </div>
      );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 mb-12">
      <div className="flex items-center gap-4">
        <button onClick={handleCancel} className="text-gray-500 hover:text-gray-800" disabled={isSubmitting}><ArrowLeft size={24} /></button>
        <h2 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Editar Noticia' : 'Nueva Noticia'}</h2>
        {draftRecovered && <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">Borrador recuperado</span>}
      </div>

      {/* MODAL DE RECORTE: IMAGEN DEL TITULAR */}
      {mainImageToCrop && (
        <ImageCropper 
          imageSrc={mainImageToCrop} 
          onCropDone={handleMainCropDone} 
          onCancel={handleMainCropCancel} 
        />
      )}

      {/* MODAL DE RECORTE: GALERÍA (El que pusiste antes) */}
      {isCroppingGallery && pendingCrops.length > 0 && (
        <ImageCropper 
          imageSrc={pendingCrops[0]} 
          onCropDone={handleCropDone} 
          onCancel={handleCropCancel} 
        />
      )}

      <form className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100 space-y-8 relative">
        {isSubmitting && (
            <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center rounded-xl backdrop-blur-sm">
                <Loader2 size={48} className="text-brand-red animate-spin mb-4" />
                <p className="text-xl font-bold text-gray-800">Procesando petición...</p>
                <p className="text-sm text-gray-500">Sincronizando con la nube, no cierres la ventana.</p>
            </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Título</label>
          <input type="text" name="title" value={formData.title} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none text-lg font-medium bg-white font-serif" placeholder="Escribe un titular llamativo..." required disabled={isSubmitting} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Categoría</label>
                <select name="category" value={formData.category} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none bg-white" disabled={isSubmitting}>
                    {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
            </div>
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-2"><Calendar size={16} /> Fecha de Publicación</label>
                <input type="datetime-local" value={getFormattedDateValue()} onChange={handleDateChange} className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none bg-white text-gray-600 font-medium" disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Orden (Prioridad)</label>
                <input type="number" min="0" max="4" name="customOrder" value={formData.customOrder || 0} onChange={(e) => { let val = Number(e.target.value); if (val > 4) val = 4; if (val < 0) val = 0; setFormData(prev => ({ ...prev, customOrder: val })); }} className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none bg-white font-medium" disabled={isSubmitting} title="0 = Normal. 1 al 4 = Posición fijada." />
            </div>
        </div>
        
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Autor</label>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="relative flex-1 w-full">
                    <select name="authorId" value={formData.authorId} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none bg-white" required disabled={isSubmitting}>
                        <option value="">Selecciona un autor</option>
                        {authors.map(author => <option key={author.id} value={author.id}>{author.name}</option>)}
                    </select>
                </div>
                {formData.authorId && (
                     <div className="flex items-center gap-3 p-2 border border-gray-100 rounded-lg bg-gray-50 min-w-[200px]">
                         <img src={getSelectedAuthor()?.imageUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-200" onError={(e) => e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getSelectedAuthor()?.name || 'A')}`} />
                         <div className="flex-1">
                             <p className="text-xs font-bold text-gray-700">Foto Actual</p>
                             <button type="button" onClick={() => !loadingImage && authorImageInputRef.current?.click()} className="text-xs text-brand-red hover:underline flex items-center gap-1 mt-0.5 disabled:opacity-50" disabled={isSubmitting || loadingImage}><Camera size={12} /> Cambiar Foto</button>
                             <input type="file" ref={authorImageInputRef} className="hidden" accept="image/*" onChange={handleAuthorImageUpload} disabled={isSubmitting || loadingImage} />
                         </div>
                     </div>
                )}
            </div>
        </div>

        {formData.category === Category.CRONICAS && (
            <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 space-y-6">
                <div className="flex items-center gap-2 text-orange-800 border-b border-orange-200 pb-2"><Shield size={20} /><h3 className="font-bold text-lg">Ficha del Festejo</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-xs font-semibold text-orange-800 uppercase flex items-center gap-1"><MapPin size={14} /> Plaza</label><input type="text" name="bullfightLocation" value={formData.bullfightLocation} onChange={handleChange} className="w-full p-2 border border-orange-200 rounded focus:border-orange-500 outline-none bg-white" placeholder="Ej: Plaza Mayor de Ciudad Rodrigo" disabled={isSubmitting} /></div>
                    <div className="space-y-1"><label className="text-xs font-semibold text-orange-800 uppercase flex items-center gap-1"><Shield size={14} /> Ganadería</label><input type="text" name="bullfightCattle" value={formData.bullfightCattle} onChange={handleChange} className="w-full p-2 border border-orange-200 rounded focus:border-orange-500 outline-none bg-white" placeholder="Ej: Novillos de Talavante" disabled={isSubmitting} /></div>
                </div>
                <div className="space-y-1"><label className="text-xs font-semibold text-orange-800 uppercase">Resumen del Festejo (Ficha Técnica)</label><textarea name="bullfightSummary" value={formData.bullfightSummary} onChange={handleChange} rows={3} className="w-full p-2 border border-orange-200 rounded focus:border-orange-500 outline-none resize-none bg-white" placeholder="Resumen general del comportamiento del ganado y la tarde..." disabled={isSubmitting} /></div>
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-orange-800 uppercase flex items-center gap-1"><Award size={14} /> Resultados</label>
                    <div className="space-y-2">
                        {formData.bullfightResults?.map((res, idx) => (
                            <div key={idx} className="flex items-center bg-white p-2 rounded border border-orange-200 shadow-sm animate-fade-in">
                                <div className="flex-1"><span className="font-bold text-gray-800">{res.bullfighter}</span><span className="text-gray-400 mx-2">|</span><span className="text-gray-600 italic">{res.result}</span></div>
                                <button type="button" onClick={() => editResult(idx)} className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 mr-1 transition-colors" title="Editar resultado" disabled={isSubmitting}><Edit2 size={16} /></button>
                                <button type="button" onClick={() => removeResult(idx)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors" title="Eliminar resultado" disabled={isSubmitting}><Trash2 size={16} /></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col md:flex-row gap-2 items-end bg-orange-100/50 p-3 rounded-lg border border-orange-200">
                        <div className="flex-1 w-full space-y-1"><label className="text-[10px] text-orange-800 font-bold uppercase">Torero / Novillero</label><input ref={bullfighterInputRef} type="text" placeholder="Ej: Diego Urdiales" className="w-full p-2 text-sm border border-gray-300 rounded bg-white focus:border-orange-500 outline-none" value={newResult.bullfighter} onChange={(e) => setNewResult(prev => ({ ...prev, bullfighter: e.target.value }))} onKeyDown={handleResultKeyDown} disabled={isSubmitting} /></div>
                        <div className="flex-1 w-full space-y-1"><label className="text-[10px] text-orange-800 font-bold uppercase">Resultado</label><input type="text" placeholder="Ej: una oreja" className="w-full p-2 text-sm border border-gray-300 rounded bg-white focus:border-orange-500 outline-none" value={newResult.result} onChange={(e) => setNewResult(prev => ({ ...prev, result: e.target.value }))} onKeyDown={handleResultKeyDown} disabled={isSubmitting} /></div>
                        <button type="button" onClick={addResult} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors w-full md:w-auto h-[38px] flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"><Plus size={16} /> Añadir</button>
                    </div>
                </div>
            </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Resumen / Entradilla (Opcional)</label>
          <textarea name="summary" value={formData.summary} onChange={handleChange} rows={2} className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none bg-white font-serif leading-relaxed" placeholder="Breve descripción que aparecerá en la portada..." disabled={isSubmitting} />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 flex items-center gap-2"><ImageIcon size={18} /> Imagen del Titular (Portada)</label>
          <div className={`border-2 border-dashed ${loadingImage ? 'border-brand-red bg-red-50' : 'border-gray-300 hover:bg-gray-50'} rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer relative overflow-hidden`} onClick={() => !loadingImage && !isSubmitting && mainImageInputRef.current?.click()}>
             {loadingImage && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80"><Loader2 className="animate-spin text-brand-red mb-2" size={32} /><p className="text-xs font-bold text-gray-600">Procesando imagen...</p></div>}
             {formData.imageUrl ? (
               <div className="relative w-full h-64"><img src={getCMSImageUrl(formData.imageUrl)} alt="Portada" className="w-full h-full object-cover rounded-lg" /><div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg"><p className="text-white font-medium flex items-center gap-2"><UploadCloud size={20} /> Cambiar Imagen</p></div></div>
             ) : (
               <div className="py-8 space-y-2"><div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400"><UploadCloud size={24} /></div><p className="text-gray-600 font-medium">Haz clic para subir imagen</p></div>
             )}
             <input type="file" ref={mainImageInputRef} className="hidden" accept="image/*" onChange={handleMainImageUpload} disabled={isSubmitting || loadingImage} />
          </div>
          {formData.imageUrl && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="flex gap-2 items-center"><MessageSquare size={16} className="text-gray-400" /><input type="text" name="imageCaption" value={formData.imageCaption || ''} onChange={handleChange} className="flex-1 p-2 text-sm border border-gray-200 rounded focus:border-brand-red outline-none bg-white text-gray-700" placeholder="Pie de foto (Descripción)" disabled={isSubmitting} /></div>
                  <div className="flex gap-2 items-center"><CameraIcon size={16} className="text-gray-400" /><input type="text" name="photoCredit" value={formData.photoCredit || ''} onChange={handleChange} className="flex-1 p-2 text-sm border border-gray-200 rounded focus:border-brand-red outline-none bg-white text-gray-700 font-medium" placeholder="Autor de la foto (Ej: Manolo Herrera)" disabled={isSubmitting} /></div>
              </div>
          )}
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 flex items-center gap-2"><ImageIcon size={18} /> Imágenes de la Noticia (Galería)</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div onClick={() => !loadingImage && !isSubmitting && galleryInputRef.current?.click()} className={`aspect-video border-2 border-dashed ${loadingImage ? 'border-brand-red bg-red-50' : 'border-gray-300 hover:bg-gray-50'} rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all min-h-[200px] relative`}>
                  {loadingImage ? <div className="flex flex-col items-center justify-center"><Loader2 size={32} className="animate-spin text-brand-red mb-2" /><span className="text-xs font-medium text-gray-600">Procesando cola...</span></div> : <div className="flex flex-col items-center justify-center"><Plus size={32} className="mb-2 opacity-50 text-gray-500" /><span className="text-xs font-medium text-gray-600">Añadir Fotos</span></div>}
                  <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" multiple onChange={handleGalleryUpload} disabled={isSubmitting || loadingImage} />
              </div>
              {formData.contentImages?.map((img, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl border border-gray-200 p-2 relative group">
                      
                      {/* DISEÑO MEJORADO: Permite verticales usando object-contain y altura fija */}
                      <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden mb-2 flex items-center justify-center border border-gray-200">
                          <img src={getCMSImageUrl(url)} alt={`Galería ${idx}`} className="max-w-full max-h-full object-contain drop-shadow-sm" />
                          <button type="button" onClick={() => removeGalleryImage(idx)} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-md" disabled={isSubmitting}>
                              <X size={14} />
                          </button>
                      </div>

                      <div className="space-y-2">
                        <input type="text" value={img.caption || ''} onChange={(e) => updateGalleryCaption(idx, e.target.value)} className="w-full p-2 text-xs border border-gray-200 rounded focus:border-brand-red outline-none bg-white text-gray-600" placeholder="Pie de foto" disabled={isSubmitting} />
                        <div className="flex items-center gap-1"><CameraIcon size={12} className="text-gray-400" /><input type="text" value={img.credit || ''} onChange={(e) => updateGalleryCredit(idx, e.target.value)} className="w-full p-1.5 text-xs border border-gray-200 rounded focus:border-brand-red outline-none bg-white text-gray-600" placeholder="Autor (Crédito)" disabled={isSubmitting} /></div>
                      </div>
                  </div>
              ))}
          </div>
        </div>

       <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Contenido de la Noticia</label>
          <div className={`border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-red/20 focus-within:border-brand-red bg-white ${isSubmitting ? 'border-gray-200 opacity-70 pointer-events-none' : 'border-gray-200'}`}>
             <div className="flex items-center gap-1 p-2 border-b border-gray-100 bg-gray-50">
                  <button type="button" onMouseDown={(e) => handleFormat(e, 'bold')} className="p-2 hover:bg-gray-200 rounded text-gray-700"><Bold size={18} /></button><button type="button" onMouseDown={(e) => handleFormat(e, 'italic')} className="p-2 hover:bg-gray-200 rounded text-gray-700"><Italic size={18} /></button><button type="button" onMouseDown={(e) => handleFormat(e, 'insertUnorderedList')} className="p-2 hover:bg-gray-200 rounded text-gray-700"><List size={18} /></button><div className="w-px h-6 bg-gray-300 mx-1"></div><button type="button" onMouseDown={(e) => { e.preventDefault(); handleLink(); }} className="p-2 hover:bg-gray-200 rounded text-gray-700"><LinkIcon size={18} /></button>
              </div>
              <div ref={editorRef} contentEditable={!isSubmitting} suppressContentEditableWarning onPaste={handlePaste} onDrop={handleDrop} className="w-full p-4 min-h-[300px] outline-none font-serif text-gray-800 leading-relaxed overflow-y-auto text-lg prose prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800" onBlur={() => setFormIsDirty(true)} style={{ minHeight: '300px' }} />
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button type="button" onClick={handleCancel} className="w-full sm:w-auto px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors disabled:opacity-50" disabled={isSubmitting || loadingImage}>Cancelar</button>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button type="button" onClick={(e) => handleSave(e, false)} className="w-full sm:w-auto px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50" disabled={isSubmitting || loadingImage}><FileEdit size={18} /> Guardar Borrador</button>
                <button type="button" onClick={(e) => handleSave(e, true)} disabled={isSubmitting || loadingImage} className="w-full sm:w-auto px-6 py-3 bg-brand-red hover:bg-red-700 text-white rounded-lg font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                    {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Publicando...</> : <><Send size={18} /> {isEditMode ? 'Actualizar y Publicar' : 'Publicar Noticia'}</>}
                </button>
            </div>
        </div>
      </form>
    </div>
  );
};
export default ArticleForm;
