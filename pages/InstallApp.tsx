
import React, { useState, useEffect } from 'react';
import { Download, Monitor, Smartphone, Share2, Globe, CheckCircle2, Apple, Play, Laptop, AlertCircle } from 'lucide-react';

const InstallApp: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [os, setOs] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [installError, setInstallError] = useState('');

  useEffect(() => {
    // Detect OS
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
        setOs('ios');
    } else if (/android/.test(userAgent)) {
        setOs('android');
    } else {
        setOs('desktop');
    }

    // Check environment
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setIsLocalhost(true);
    }

    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
    }

    // Capture install prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log("Evento 'beforeinstallprompt' capturado.");
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
        // Mejorar mensaje según el OS
        if (os === 'ios') {
             alert("En iOS, debes usar el botón 'Compartir' de Safari y seleccionar 'Añadir a la pantalla de inicio'.");
        } else {
             setInstallError("El navegador no permite la instalación automática. Por favor, utiliza el menú del navegador (tres puntos) y busca 'Instalar aplicación' o 'Añadir a pantalla de inicio'.");
        }
        return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setInstallError('');
    }
  };

  const getShareableUrl = () => {
      const url = window.location.href;
      if (url.includes('#')) {
          return url.split('#')[0];
      }
      return window.location.origin;
  };
  
  const currentUrl = getShareableUrl();

  return (
    <div className="space-y-8 animate-fade-in-down pb-12">
      
      {/* HEADER TIPO STORE */}
      <div className="bg-gradient-to-r from-brand-dark to-slate-900 rounded-3xl p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red opacity-10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-white shadow-lg p-4 flex items-center justify-center text-brand-red">
                  <Smartphone size={64} />
              </div>
              <div className="text-center md:text-left space-y-4">
                  <div>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-2">Tendido Digital CMS</h1>
                    <p className="text-blue-200 text-lg font-medium">La aplicación oficial para la gestión taurina.</p>
                  </div>
                  
                  <div className="flex flex-wrap justify-center md:justify-start gap-4 flex-col md:flex-row items-center md:items-start">
                      {isInstalled ? (
                          <div className="bg-green-500 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg cursor-default">
                              <CheckCircle2 size={20} />
                              YA INSTALADA
                          </div>
                      ) : (
                        <>
                            {(os === 'android' || os === 'desktop') && (
                                <button 
                                    onClick={handleInstallClick}
                                    className="bg-white text-brand-dark hover:bg-gray-100 px-8 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95 w-full md:w-auto justify-center"
                                >
                                    <Download size={20} />
                                    INSTALAR APLICACIÓN
                                </button>
                            )}
                            {os === 'ios' && (
                                <div className="bg-white/20 backdrop-blur text-white px-6 py-3 rounded-full font-bold text-sm border border-white/30 flex items-center gap-2">
                                    <Apple size={18} /> Instalación manual requerida en iOS
                                </div>
                            )}
                        </>
                      )}
                      
                      {installError && (
                          <div className="text-blue-100 text-sm font-medium mt-2 max-w-md bg-blue-900/30 p-3 rounded-lg border border-blue-500/30 flex items-start gap-2 text-left">
                              <AlertCircle size={16} className="shrink-0 mt-0.5" />
                              <span>{installError}</span>
                          </div>
                      )}
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400 uppercase tracking-widest pt-2 justify-center md:justify-start">
                      <span className="flex items-center gap-1"><Apple size={14} /> iOS</span>
                      <span className="flex items-center gap-1"><Play size={14} /> Android</span>
                      <span className="flex items-center gap-1"><Laptop size={14} /> PC / Mac</span>
                  </div>
              </div>
          </div>
      </div>

      {/* SECCIÓN ENLACE PÚBLICO */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          {isLocalhost && (
              <div className="absolute top-0 left-0 w-full bg-yellow-100 text-yellow-800 text-xs font-bold text-center py-1">
                  MODO LOCAL DETECTADO
              </div>
          )}
          
          <div className="flex items-start gap-4 mt-2">
              <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                  <Globe size={24} />
              </div>
              <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Enlace Público para Compartir</h3>
                  
                  {isLocalhost ? (
                      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4 flex items-start gap-3">
                          <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-yellow-800">
                              <p className="font-bold mb-1">¡Cuidado! Estás en modo de pruebas (localhost).</p>
                              <p>Este enlace <strong>NO funcionará</strong> si se lo envías a otra persona. Para compartir la app, primero debes subirla/desplegarla en internet (Vercel, Netlify, GitHub Pages, etc).</p>
                          </div>
                      </div>
                  ) : (
                      <p className="text-gray-500 mb-4">Envía este enlace a los redactores para que instalen la app en sus móviles.</p>
                  )}
                  
                  <div className="flex gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 items-center">
                      <code className="flex-1 text-sm text-gray-700 break-all">{currentUrl}</code>
                      <button 
                        onClick={() => {
                            navigator.clipboard.writeText(currentUrl);
                            alert("Enlace copiado al portapapeles");
                        }}
                        className="bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded text-sm font-bold text-gray-600 shadow-sm"
                      >
                          COPIAR
                      </button>
                      <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="text-brand-red p-2 hover:bg-red-50 rounded">
                          <ExternalLinkIcon size={20} />
                      </a>
                  </div>
              </div>
          </div>
      </div>

      {/* GUÍAS DE INSTALACIÓN */}
      <h3 className="text-2xl font-bold text-gray-800 px-2 mt-8">Guía de Instalación Manual</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ANDROID */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4 text-green-600">
                  <Play size={28} />
                  <h4 className="font-bold text-lg text-gray-800">Android</h4>
              </div>
              <ol className="space-y-3 text-sm text-gray-600 list-decimal pl-4">
                  <li>Abre el enlace en <strong>Google Chrome</strong>.</li>
                  <li>Toca el menú de tres puntos <span className="font-bold">⋮</span> arriba a la derecha.</li>
                  <li>Selecciona <strong>"Instalar aplicación"</strong>.</li>
                  <li>Si no aparece, busca "Añadir a pantalla de inicio".</li>
              </ol>
          </div>

          {/* iOS */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4 text-gray-800">
                  <Apple size={28} />
                  <h4 className="font-bold text-lg text-gray-800">iOS (iPhone)</h4>
              </div>
              <ol className="space-y-3 text-sm text-gray-600 list-decimal pl-4">
                  <li>Abre el enlace en <strong>Safari</strong> (Chrome en iOS no funciona igual).</li>
                  <li>Toca el botón <strong>Compartir</strong> <Share2 size={12} className="inline" /> (cuadrado con flecha) abajo al centro.</li>
                  <li>Baja hasta encontrar <strong>"Añadir a la pantalla de inicio"</strong>.</li>
                  <li>Dale a "Añadir" arriba a la derecha.</li>
              </ol>
          </div>

          {/* PC / MAC */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4 text-blue-600">
                  <Monitor size={28} />
                  <h4 className="font-bold text-lg text-gray-800">PC / Mac</h4>
              </div>
              <ol className="space-y-3 text-sm text-gray-600 list-decimal pl-4">
                  <li>Abre el enlace en <strong>Chrome</strong> o <strong>Edge</strong>.</li>
                  <li>Busca el icono <Download size={12} className="inline"/> <strong>Instalar</strong> en la barra de direcciones.</li>
                  <li>Haz clic en <strong>Instalar</strong>.</li>
                  <li><strong>¡Listo!</strong> Se creará un acceso directo en tu escritorio y funcionará como una app nativa (.exe).</li>
              </ol>
          </div>
      </div>
    </div>
  );
};

// Helper component icon
const ExternalLinkIcon = ({size}: {size:number}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
);

export default InstallApp;
