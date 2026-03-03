import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ArticlesList from './pages/ArticlesList';
import ArticleForm from './pages/ArticleForm';
import Authors from './pages/Authors';
import Settings from './pages/Settings';
import InstallApp from './pages/InstallApp';
import Home from './src/pages/home/page'; 
import { AuthProvider } from './contexts/AuthContext';

// ATENCIÓN: Esta línea es la que causa el error en Vercel. 
// Si en GitHub la carpeta se llama "Services" (con mayúscula), debes cambiar "./services" a "./Services".
import { setSyncCallback } from './Services/dataService'; 
import { syncWithGitHub } from './Services/githubService';

const AppStateHandler: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // 0. SINCRONIZACIÓN INICIAL (PULL)
    useEffect(() => {
        setSyncCallback(async () => {
            const result = await syncWithGitHub();
            if (!result.success) {
                console.error("Auto-sync failed:", result.message);
            }
        });

        const initialSync = async () => {
            console.log("🔄 Iniciando sincronización inicial...");
            try {
                await syncWithGitHub();
                console.log("✅ Sincronización inicial completada.");
            } catch (e) {
                console.error("❌ Error en sincronización inicial:", e);
            }
        };
        initialSync();
    }, []);

    // 1. Recuperar última ruta visitada al cargar
    useEffect(() => {
        const lastRoute = localStorage.getItem('td_last_route');
        if (lastRoute && lastRoute !== location.pathname && lastRoute !== '/') {
            navigate(lastRoute);
        }
    }, [location.pathname, navigate]);

    // 2. Guardar ruta actual en cada cambio
    useEffect(() => {
        localStorage.setItem('td_last_route', location.pathname);
    }, [location]);

    return null;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppStateHandler />
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/noticias" element={<ArticlesList />} />
            <Route path="/crear-noticia" element={<ArticleForm />} />
            <Route path="/editar-noticia/:id" element={<ArticleForm />} />
            <Route path="/autores" element={<Authors />} />
            <Route path="/configuracion" element={<Settings />} />
            <Route path="/descargar-app" element={<InstallApp />} />
            <Route path="/ver-web" element={<Home />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
};

export default App;
