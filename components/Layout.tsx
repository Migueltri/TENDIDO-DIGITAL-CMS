import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Newspaper, Users, PenTool, ExternalLink, Menu, X, Settings, LogOut, ChevronDown, ShieldCheck, User, Eye, Globe, Download, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAuthors } from '../Services/dataService';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  
  const { currentUser, login, isAdmin } = useAuth();
  const allAuthors = getAuthors();
  const location = useLocation();
  const isPreview = location.pathname === '/ver-web';

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=random&color=fff`;
  };

  const navItems: { to: string; icon: React.ReactNode; label: string; hidden?: boolean }[] = [
    { to: '/', icon: <LayoutDashboard size={20} />, label: 'Panel Principal' },
    { to: '/noticias', icon: <Newspaper size={20} />, label: 'Gestión Noticias' },
    { to: '/crear-noticia', icon: <PenTool size={20} />, label: 'Nueva Noticia' },
    { to: '/autores', icon: <Users size={20} />, label: 'Equipo / Autores' },
    { to: '/configuracion', icon: <Settings size={20} />, label: 'Configuración' },
  ];

  // MODO PREVISUALIZACIÓN (Pantalla completa sin sidebar)
  if (isPreview) {
      return (
          <div className="min-h-screen bg-white">
              <div className="bg-brand-dark text-white p-3 flex justify-between items-center sticky top-0 z-50 shadow-md">
                  <div className="flex items-center gap-2">
                      <Eye size={18} className="text-brand-red animate-pulse" />
                      <span className="font-bold text-sm uppercase tracking-wide">Previsualización (Simulación Local)</span>
                  </div>
                  <NavLink to="/" className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors flex items-center gap-2 font-medium">
                      <LogOut size={14} /> Volver al Panel
                  </NavLink>
              </div>
              {children}
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-brand-dark text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <span className="font-bold text-xl flex items-center gap-2">
           <span className="text-brand-red">Tendido</span>Digital
        </span>
        <button onClick={toggleMenu} className="p-2 active:bg-white/10 rounded-lg transition-colors">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm animate-fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        bg-brand-dark text-white w-72 md:w-64 flex-shrink-0 
        flex flex-col transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-gray-700 hidden md:block">
           <h1 className="font-bold text-2xl tracking-tighter">
             TENDIDO<span className="text-brand-red">DIGITAL</span>
           </h1>
           <p className="text-xs text-gray-400 mt-1">Panel de Gestión</p>
        </div>

        {/* User Profile */}
        <div className="p-4 border-b border-gray-700 bg-black/20">
            <div 
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            >
                <img 
                    src={currentUser?.imageUrl} 
                    alt="User" 
                    className="w-10 h-10 rounded-full border-2 border-brand-red object-cover"
                    onError={handleImageError}
                />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{currentUser?.name}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                        {isAdmin ? <ShieldCheck size={12} className="text-green-400"/> : <User size={12}/>}
                        {isAdmin ? 'Administrador' : 'Redactor'}
                        <ChevronDown size={12} />
                    </div>
                </div>
            </div>

            {isUserMenuOpen && (
                <div className="mt-3 bg-white text-gray-800 rounded-lg shadow-xl overflow-hidden text-sm z-50 relative">
                    <div className="p-2 bg-gray-50 border-b font-semibold text-xs text-gray-500 uppercase">
                        Cambiar Usuario (Simulador)
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {allAuthors.map(author => (
                            <button
                                key={author.id}
                                onClick={() => {
                                    login(author.id);
                                    setIsUserMenuOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-brand-red/10 flex items-center justify-between ${currentUser?.id === author.id ? 'bg-brand-red/5 font-bold text-brand-red' : ''}`}
                            >
                                <span>{author.name}</span>
                                <span className="text-xs text-gray-400">{author.systemRole === 'ADMIN' ? 'Admin' : 'Editor'}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.filter(item => !item.hidden).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-brand-red text-white font-medium' 
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
          
           <div className="pt-4 mt-4 border-t border-gray-700">
              <NavLink
                to="/descargar-app"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-purple-600 text-white font-medium' 
                      : 'text-purple-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Smartphone size={20} />
                <span>Descargar App</span>
              </NavLink>
           </div>
        </nav>

        <div className="p-4 border-t border-gray-700 space-y-3 bg-gradient-to-b from-brand-dark to-black/30">
            {/* BOTÓN 1: WEB OFICIAL (EXTERNA) */}
            <a 
              href="https://tendidodigital.es"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-white font-bold bg-green-600 hover:bg-green-700 transition-colors w-full py-3 rounded-lg shadow-lg hover:shadow-green-900/50 group"
            >
              <Globe size={18} />
              IR A WEB OFICIAL
            </a>

            {/* BOTÓN 2: SIMULADOR LOCAL */}
            <NavLink 
              to="/ver-web"
              className="flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-white transition-colors w-full py-2 hover:bg-white/5 rounded"
            >
              <Eye size={14} />
              Ver Simulación
            </NavLink>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
