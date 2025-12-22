import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { LayoutDashboard, Menu } from 'lucide-react'
import './index.css'

// Importamos Componentes
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import TransporteManager from './components/TransporteManager';
import TurnosManager from './components/TurnosManager';
import UsuariosManager from './components/UsuariosManager';
import TeletrabajoManager from './components/TeletrabajoManager';
import CartasManager from './components/CartasManager';
import ConfiguracionManager from './components/ConfiguracionManager';
import VariablesManager from './components/VariablesManager';
import TurnoDiarioManager from './components/TurnoDiarioManager';
import CambioTurnosManager from './components/CambioTurnosManager';
import DashboardManager from './components/DashboardManager';
import DimensionamientoManager from './components/DimensionamientoManager';
import Login from './components/Login';
import { UIProvider } from './context/UIContext';

function App() {
  const [user, setUser] = useState(null);

  // CORRECCIÓN: Inicializar estado leyendo localStorage para persistencia
  const [activeSection, setActiveSection] = useState(() => {
    return localStorage.getItem('inbound_last_section') || 'transporte';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // 1. Cargar Usuario al Inicio
  useEffect(() => {
    const storedUser = localStorage.getItem('inbound_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('inbound_user');
      }
    }
  }, []);

  // 2. Guardar Sección al cambiar
  useEffect(() => {
    if (activeSection) {
      localStorage.setItem('inbound_last_section', activeSection);
    }
  }, [activeSection]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // =========================================================================
  // === CONFIGURACIÓN DE PERMISOS POR ROL (debe coincidir con Sidebar.jsx) ===
  // =========================================================================
  const ROLE_PERMISSIONS = {
    admin: ['dashboard', 'dimensionamiento', 'turnos', 'turno_diario', 'cambio_turnos', 'teletrabajo', 'cartas', 'variables', 'transporte', 'usuarios', 'configuracion'],
    supervisor: ['dashboard', 'dimensionamiento', 'turnos', 'turno_diario', 'cambio_turnos', 'teletrabajo', 'cartas', 'variables', 'transporte', 'usuarios', 'configuracion'],
    coordinador: ['dashboard', 'dimensionamiento', 'turnos', 'turno_diario', 'cambio_turnos', 'teletrabajo', 'cartas', 'variables', 'transporte', 'usuarios', 'configuracion'],
    analista: ['dimensionamiento', 'transporte', 'usuarios', 'turnos', 'variables'],
    gtr: ['dashboard', 'turnos', 'cambio_turnos', 'dimensionamiento'],
    operaciones: ['dimensionamiento'],
    analista_op: ['dimensionamiento', 'transporte', 'variables'],
    agente: ['transporte', 'variables'],
  };

  const userRole = user?.rol?.toLowerCase() || 'guest';
  const allowedSections = ROLE_PERMISSIONS[userRole] || [];

  // Helper para verificar acceso
  const canAccess = (section) => allowedSections.includes(section);

  // Validación de seguridad por Rol
  useEffect(() => {
    if (user && allowedSections.length > 0) {
      // Si la sección activa no está permitida, redirigir a la primera permitida
      if (!allowedSections.includes(activeSection)) {
        setActiveSection(allowedSections[0] || 'transporte');
      }
    }
  }, [user, activeSection, allowedSections]);

  const handleLogin = (userData) => {
    const userWithFlag = { ...userData, justLoggedIn: true };
    localStorage.setItem('inbound_user', JSON.stringify(userWithFlag));
    setUser(userWithFlag);

    // Redirigir a la primera sección permitida del rol
    const role = (userWithFlag.rol || 'guest').toLowerCase();
    const permissions = ROLE_PERMISSIONS[role] || ['transporte'];
    setActiveSection(permissions[0] || 'transporte');
  };

  const handleLogout = () => {
    localStorage.removeItem('inbound_user');
    localStorage.removeItem('inbound_last_section');
    setUser(null);
    setActiveSection('transporte');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-container" style={{ display: 'flex', minHeight: '100vh', position: 'relative', backgroundColor: '#f8fafc' }}>

      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        user={user}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />

      <main className="main-content" style={{
        flex: 1,
        marginLeft: isMobile ? '0' : '72px',
        width: isMobile ? '100%' : 'calc(100% - 72px)',
        transition: 'margin-left 0.3s ease',
        display: 'flex',
        flexDirection: 'column'
      }}>

        <TopBar
          user={user}
          onLogout={handleLogout}
          isMobile={isMobile}
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />

        {/* Contenedor principal - renderiza según permisos */}
        <div style={{ padding: 0, flex: 1, overflowY: 'auto' }}>

          {canAccess('dashboard') && activeSection === 'dashboard' && <DashboardManager currentUser={user} />}
          {canAccess('dimensionamiento') && activeSection === 'dimensionamiento' && <DimensionamientoManager />}
          {canAccess('usuarios') && activeSection === 'usuarios' && <UsuariosManager />}
          {canAccess('turnos') && activeSection === 'turnos' && <TurnosManager />}
          {canAccess('turno_diario') && activeSection === 'turno_diario' && <TurnoDiarioManager />}
          {canAccess('cambio_turnos') && activeSection === 'cambio_turnos' && <CambioTurnosManager />}
          {canAccess('teletrabajo') && activeSection === 'teletrabajo' && <TeletrabajoManager currentUser={user} />}
          {canAccess('cartas') && activeSection === 'cartas' && <CartasManager />}
          {canAccess('configuracion') && activeSection === 'configuracion' && <ConfiguracionManager />}
          {canAccess('transporte') && activeSection === 'transporte' && <TransporteManager currentUser={user} />}
          {canAccess('variables') && activeSection === 'variables' && <VariablesManager user={user} />}
        </div>

      </main>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UIProvider>
      <App />
    </UIProvider>
  </React.StrictMode>
)
