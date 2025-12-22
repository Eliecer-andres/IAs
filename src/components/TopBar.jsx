import React, { useState, useRef, useEffect } from 'react';
import { Menu, User, LogOut, Key, X, Loader2 } from 'lucide-react';

const TopBar = ({ user, onLogout, isMobile, onMenuClick }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const dropdownRef = useRef(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userInitials = user.nombre ? user.nombre.substring(0, 2).toUpperCase() : 'U';

  return (
    <>
      <div style={{
        height: '70px',
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}>
        {/* Izquierda: Menú Móvil o Título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {isMobile && (
            <button onClick={onMenuClick} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
              <Menu size={24} color="#64748b" />
            </button>
          )}
          <span style={{ fontWeight: '700', fontSize: '1.1rem', color: '#334155' }}>
            PLATAFORMA OPERACIONAL
          </span>
        </div>

        {/* Derecha: Perfil */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '5px',
              borderRadius: '8px',
              transition: 'background 0.2s'
            }}
            className="hover-bg-slate"
          >
            <div style={{ textAlign: 'right', display: isMobile ? 'none' : 'block' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1e293b' }}>{user.nombre}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize' }}>{user.rol}</div>
            </div>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1rem',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            }}>
              {userInitials}
            </div>
          </button>

          {/* DROPDOWN */}
          {isDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '120%',
              right: 0,
              width: '220px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid #f1f5f9',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{ padding: '15px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                 <p style={{ margin: 0, fontWeight: '600', color: '#334155' }}>Mi Cuenta</p>
                 <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{user.rut}</p>
              </div>
              
              <button 
                onClick={() => { setIsDropdownOpen(false); setShowPasswordModal(true); }}
                style={{ width: '100%', padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '10px', border: 'none', background: 'white', cursor: 'pointer', textAlign: 'left', color: '#475569', fontSize: '0.9rem', transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                onMouseLeave={(e) => e.target.style.background = 'white'}
              >
                <Key size={16} /> Cambiar Contraseña
              </button>

              <button 
                onClick={onLogout}
                style={{ width: '100%', padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '10px', border: 'none', background: 'white', cursor: 'pointer', textAlign: 'left', color: '#ef4444', fontSize: '0.9rem', borderTop: '1px solid #f1f5f9' }}
                onMouseEnter={(e) => e.target.style.background = '#fef2f2'}
                onMouseLeave={(e) => e.target.style.background = 'white'}
              >
                <LogOut size={16} /> Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CAMBIO CLAVE */}
      {showPasswordModal && (
        <ChangePasswordModal 
            user={user} 
            onClose={() => setShowPasswordModal(false)} 
        />
      )}
    </>
  );
};

// Componente Interno Modal de Clave
const ChangePasswordModal = ({ user, onClose }) => {
    const [pass, setPass] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    const handleSave = async (e) => {
        e.preventDefault();
        if(pass.length < 4) return setMsg('La contraseña es muy corta.');
        if(pass !== confirm) return setMsg('Las contraseñas no coinciden.');
        
        setLoading(true);
        try {
            // Reutilizamos el endpoint PUT de usuarios.js
            // IMPORTANTE: Enviamos todos los datos del usuario actual para no borrarlos,
            // solo actualizamos la password.
            const payload = {
                id: user.id,
                nombre: user.nombre,
                rut: user.rut,
                direccion: user.direccion,
                fono: user.fono,
                correo: user.correo,
                rol: user.rol,
                password: pass // Nueva clave
            };

            const res = await fetch('/api/usuarios', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if(res.ok) {
                alert('Contraseña actualizada correctamente. Deberás ingresar de nuevo.');
                window.location.reload(); // Recargar para forzar logout o actualizar estado
            } else {
                setMsg('Error al actualizar en servidor.');
            }
        } catch(e) {
            setMsg('Error de conexión.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{zIndex: 100}}>
            <div className="modal-content" style={{maxWidth: '400px'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                    <h3>Cambiar Contraseña</h3>
                    <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer'}}><X/></button>
                </div>
                <form onSubmit={handleSave}>
                    <div style={{marginBottom:'15px'}}>
                        <label className="control-label">Nueva Contraseña</label>
                        <input type="password" className="input-modern" style={{width:'100%'}} 
                            value={pass} onChange={e=>setPass(e.target.value)} required />
                    </div>
                    <div style={{marginBottom:'20px'}}>
                        <label className="control-label">Confirmar Contraseña</label>
                        <input type="password" className="input-modern" style={{width:'100%'}} 
                            value={confirm} onChange={e=>setConfirm(e.target.value)} required />
                    </div>
                    {msg && <p style={{color:'#ef4444', fontSize:'0.9rem', marginBottom:'10px'}}>{msg}</p>}
                    
                    <button className="btn btn-primary" style={{width:'100%', justifyContent:'center'}} disabled={loading}>
                        {loading ? <Loader2 className="spin" size={18}/> : 'Guardar Nueva Clave'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default TopBar;
