import React from 'react';
import {
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  Bus,
  Users,
  Settings,
  X,
  FileText,
  Database,
  Calendar,
  ArrowLeftRight,
  BarChart3
} from 'lucide-react';
import './Sidebar.css';

// =========================================================================
// === CONFIGURACIÓN DE PERMISOS POR ROL ===
// =========================================================================
// admin/supervisor/coordinador: Acceso completo
// analista: dimensionamiento, transporte, usuarios, turnos
// gtr: dashboard, turnos, cambio_turnos, dimensionamiento
// operaciones: solo dimensionamiento
// analista_op: dimensionamiento, transporte, variables
// agente: solo transporte y variables (SIN dimensionamiento)

const ROLE_PERMISSIONS = {
  admin: ['dashboard', 'dimensionamiento', 'turnos', 'turno_diario', 'cambio_turnos', 'teletrabajo', 'cartas', 'variables', 'transporte', 'usuarios', 'configuracion'],
  supervisor: ['dashboard', 'dimensionamiento', 'turnos', 'turno_diario', 'cambio_turnos', 'teletrabajo', 'cartas', 'variables', 'transporte', 'usuarios', 'configuracion'],
  coordinador: ['dashboard', 'dimensionamiento', 'turnos', 'turno_diario', 'cambio_turnos', 'teletrabajo', 'cartas', 'variables', 'transporte', 'usuarios', 'configuracion'], // Igual que supervisor
  analista: ['dimensionamiento', 'transporte', 'usuarios', 'turnos', 'variables'],
  gtr: ['dashboard', 'turnos', 'cambio_turnos', 'dimensionamiento'],
  operaciones: ['dimensionamiento'],
  analista_op: ['dimensionamiento', 'transporte', 'variables'],
  agente: ['transporte', 'variables'], // SIN dimensionamiento
};

const Sidebar = ({
  activeSection,
  setActiveSection,
  user,
  isMobileOpen,
  setIsMobileOpen
}) => {

  const userRole = (user?.rol || 'guest').toLowerCase();

  // Obtener permisos del rol actual (o vacío si no existe)
  const allowedSections = ROLE_PERMISSIONS[userRole] || [];

  // Roles que pueden ver Configuración
  const canSeeConfig = ['admin', 'supervisor', 'coordinador'].includes(userRole);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'dimensionamiento', label: 'Dimensionamiento', icon: BarChart3 },
    { id: 'turnos', label: 'Turnos', icon: CalendarClock },
    { id: 'turno_diario', label: 'Turno Diario', icon: Calendar },
    { id: 'cambio_turnos', label: 'Cambio de Turnos', icon: ArrowLeftRight },
    { id: 'teletrabajo', label: 'Calendario TT', icon: CalendarDays },
    { id: 'cartas', label: 'Gestión Cartas', icon: FileText },
    { id: 'variables', label: 'Variables', icon: Database },
    { id: 'transporte', label: 'Transporte', icon: Bus },
    { id: 'usuarios', label: 'Usuarios', icon: Users }
  ];

  const handleItemClick = (id) => {
    setActiveSection(id);
    if (window.innerWidth < 768) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Overlay para Móvil */}
      {isMobileOpen && (
        <div
          className="mobile-overlay md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`sidebar-container ${isMobileOpen ? 'mobile-open' : ''}`}>

        {/* Header */}
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon">P</div>
            <span className="brand-text">Gestor Inbound</span>
          </div>

          <button
            className="md:hidden ml-auto text-slate-400 hover:text-white"
            onClick={() => setIsMobileOpen(false)}
            style={{ display: isMobileOpen ? 'block' : 'none' }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Navegación */}
        <nav className="sidebar-nav">
          <div className="menu-label">
            <span className="menu-label-text">Menú Principal</span>
          </div>

          {menuItems.map((item) => {
            // Verificar si el rol tiene permiso para esta sección
            if (!allowedSections.includes(item.id)) return null;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`nav-button ${activeSection === item.id ? 'active' : ''}`}
                title={item.label}
              >
                <div className="nav-icon">
                  <item.icon size={22} />
                </div>
                <span className="nav-text">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer (Solo Configuración para Admin/Supervisor/Coordinador) */}
        <div className="sidebar-footer" style={{ marginTop: 'auto' }}>
          {canSeeConfig && (
            <button
              onClick={() => handleItemClick('configuracion')}
              className={`nav-button ${activeSection === 'configuracion' ? 'active' : ''}`}
              title="Configuración"
              style={{ marginBottom: '10px' }}
            >
              <div className="nav-icon">
                <Settings size={22} />
              </div>
              <span className="config-text">Configuración</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
