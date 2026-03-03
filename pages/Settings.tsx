
import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, verifyConnection } from '../Services/githubService';
import { AppSettings } from '../types';
import { Save, Code, Copy, CheckCircle, AlertCircle, AlertTriangle, ArrowDown, Edit, Github, Server, Globe } from 'lucide-react';

const Settings: React.FC = () => {
  // DATOS PRE-CARGADOS SEGÚN PETICIÓN
  const defaultSettings: AppSettings = {
    githubToken: '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',
    repoOwner: 'MiguelTro',
    repoName: 'tendido-digital-oficial',
    filePath: 'public/data/db.json',
    repoBranch: 'main',
    vercelDeployHook: ''
  };

  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  
  const [saved, setSaved] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [testStatus, setTestStatus] = useState<{ loading: boolean, msg: string, success?: boolean } | null>(null);
  const [showCode, setShowCode] = useState(false); 

  useEffect(() => {
    let currentSettings = getSettings();
    
    // Force update the repoName if it's the old default
    if (currentSettings.repoName === 'Tendido-Digital') {
        currentSettings.repoName = 'tendido-digital-oficial';
        saveSettings(currentSettings);
    }
    
    // Si ya existe configuración guardada, la usamos. Si no, usamos la default hardcodeada.
    if (currentSettings.githubToken) {
        setSettings(currentSettings);
        if (currentSettings.githubToken && currentSettings.repoName) {
            setIsConfigured(true);
            // Verificar conexión al cargar
            verifyConnection().then(res => {
                if(res.success) setTestStatus({ loading: false, msg: res.message, success: true });
                else setTestStatus({ loading: false, msg: res.message, success: false });
            });
        }
    } else {
        // Primera vez: Guardamos los defaults automáticamente para que funcione YA
        saveSettings(defaultSettings);
        setSettings(defaultSettings);
        setIsEditing(true);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.filePath.endsWith('.json')) {
        alert("Error: El archivo debe terminar en .json (normalmente public/data/db.json)");
        return;
    }
    saveSettings(settings);
    setSaved(true);
    setIsConfigured(true);
    setIsEditing(false); // Cerrar modo edición
    setTestStatus(null);
    setTimeout(() => setSaved(false), 3000);
    
    // Probar conexión inmediatamente después de guardar
    handleTestConnection();
  };

  const handleTestConnection = async () => {
      saveSettings(settings); // Asegurar que probamos lo último escrito
      setTestStatus({ loading: true, msg: 'Conectando con GitHub...', success: false });
      const result = await verifyConnection();
      setTestStatus({ loading: false, msg: result.message, success: result.success });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 mb-12">
      
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-800">Conexión con la Web</h2>
        <p className="text-gray-500">Configuración del repositorio de <strong>tendidodigital.es</strong>.</p>
      </div>

      {/* ESTADO DE CONEXIÓN (VISUAL) */}
      {isConfigured && !isEditing && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
              <div className="bg-green-50 p-4 border-b border-green-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-full text-green-700">
                          <Globe size={24} />
                      </div>
                      <div>
                          <h3 className="font-bold text-green-900">Enlazado con GitHub</h3>
                          <p className="text-green-700 text-sm">El panel está listo para publicar.</p>
                      </div>
                  </div>
                  <div className="flex gap-2">
                       <button 
                        type="button" 
                        onClick={handleTestConnection} 
                        className="px-3 py-1.5 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 font-medium transition-colors text-sm"
                        disabled={testStatus?.loading}
                      >
                         {testStatus?.loading ? 'Probando...' : 'Probar Conexión'}
                      </button>
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="text-green-700 hover:text-green-900 hover:bg-green-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                      >
                          <Edit size={16} /> Editar
                      </button>
                  </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center gap-3 text-gray-600">
                      <Github size={20} />
                      <div className="overflow-hidden">
                          <p className="text-xs text-gray-400 uppercase font-semibold">Repositorio</p>
                          <p className="font-medium text-gray-800 truncate" title={`${settings.repoOwner}/${settings.repoName}`}>{settings.repoOwner}/{settings.repoName}</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                      <Code size={20} />
                      <div>
                          <p className="text-xs text-gray-400 uppercase font-semibold">Rama</p>
                          <p className="font-medium text-gray-800">{settings.repoBranch}</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                      <Server size={20} />
                      <div className="overflow-hidden">
                          <p className="text-xs text-gray-400 uppercase font-semibold">Ruta Archivo</p>
                          <p className="font-medium text-gray-800 truncate" title={settings.filePath}>{settings.filePath}</p>
                      </div>
                  </div>
              </div>
              
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                      <svg viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-black">
                          <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="currentColor"/>
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Desplegado en Vercel</span>
                  </div>
                  <a 
                      href={`https://vercel.com/`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                      Ver Logs en Vercel &rarr;
                  </a>
              </div>

              {testStatus && (
                <div className={`px-6 py-2 text-sm border-t font-medium ${testStatus.success ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                    {testStatus.msg}
                </div>
              )}
          </div>
      )}

      {/* FORMULARIO (Solo visible si no hay config o se está editando) */}
      {(isEditing || !isConfigured) && (
        <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100 space-y-6 animate-fade-in-down">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-gray-700">Editar Credenciales</h3>
                {isConfigured && (
                    <button type="button" onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600">Cancelar</button>
                )}
            </div>
            
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Token de GitHub (PAT)</label>
                <input 
                    type="password" 
                    name="githubToken" 
                    value={settings.githubToken} 
                    onChange={handleChange} 
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red/20 outline-none bg-white text-gray-800 font-mono text-sm" 
                    placeholder="github_pat_..."
                    required 
                />
                {settings.githubToken === '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' && (
                    <p className="text-xs text-red-600 font-bold mt-1">
                        ⚠️ ATENCIÓN: Este token ha sido revocado por GitHub por seguridad al ser expuesto. Debes generar uno nuevo en GitHub y pegarlo aquí.
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Usuario de GitHub</label>
                    <input 
                        type="text" 
                        name="repoOwner" 
                        value={settings.repoOwner} 
                        onChange={handleChange} 
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red/20 outline-none bg-white text-gray-800" 
                        required 
                    />
                </div>
                <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Nombre del Repositorio</label>
                    <input 
                        type="text" 
                        name="repoName" 
                        value={settings.repoName} 
                        onChange={handleChange} 
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red/20 outline-none bg-white text-gray-800" 
                        required 
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Rama</label>
                    <input 
                        type="text" 
                        name="repoBranch" 
                        value={settings.repoBranch} 
                        onChange={handleChange} 
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red/20 outline-none bg-white text-gray-800" 
                        required 
                    />
                </div>
                <div className="md:col-span-2 space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Ruta Archivo DB</label>
                    <input 
                        type="text" 
                        name="filePath" 
                        value={settings.filePath} 
                        onChange={handleChange} 
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red/20 outline-none bg-white text-gray-800" 
                        required 
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Vercel Deploy Hook URL (Opcional)</label>
                <input 
                    type="text" 
                    name="vercelDeployHook" 
                    value={settings.vercelDeployHook || ''} 
                    onChange={handleChange} 
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red/20 outline-none bg-white text-gray-800" 
                    placeholder="https://api.vercel.com/v1/integrations/deploy/..."
                />
                <p className="text-xs text-gray-500 mt-1">Si se configura, se llamará automáticamente a esta URL para forzar el despliegue en Vercel tras subir cambios.</p>
            </div>

            {testStatus && isEditing && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${testStatus.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {testStatus.success ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
                    {testStatus.msg}
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                    type="button" 
                    onClick={handleTestConnection} 
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                    disabled={testStatus?.loading}
                >
                    {testStatus?.loading ? 'Probando...' : 'Probar Conexión'}
                </button>
                <button 
                    type="submit" 
                    className="bg-brand-dark text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-800 font-medium shadow-sm transition-colors"
                >
                    <Save size={18}/> Guardar Configuración
                </button>
            </div>
        </form>
      )}
    </div>
  );
};

export default Settings;
