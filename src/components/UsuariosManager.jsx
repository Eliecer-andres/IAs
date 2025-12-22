import React, { useState, useEffect } from 'react';
import {
    Users, Search, MapPin, Phone, Mail, UserCheck, Trash2,
    Plus, Save, X, Key, Loader2, ShieldAlert
} from 'lucide-react';

const cleanRut = (rut) => rut ? rut.toString().replace(/[^0-9kK]/g, "").toLowerCase() : "";

export default function UsuariosManager() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [modalOpen, setModalOpen] = useState(false);

    // Estado para el usuario que se está editando o creando
    const [editingItem, setEditingItem] = useState(null);
    const [saving, setSaving] = useState(false);

    // Cargar usuarios al iniciar
    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/usuarios');
            if (res.ok) setData(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchUsers(); }, []);

    // --- ACCIONES ---

    // Abrir modal para CREAR
    const handleAdd = () => {
        setEditingItem({
            id: null, // ID nulo indica creación
            rut: '',
            nombre: '',
            direccion: '',
            fono: '',
            correo: '',
            rol: 'agente', // Rol por defecto
            password: '' // Se llenará automáticamente con el RUT si se deja vacío
        });
        setModalOpen(true);
    };

    // Abrir modal para EDITAR
    const handleEdit = (item) => {
        setEditingItem({
            ...item,
            rol: item.rol || 'sin_acceso',
            password: '' // No mostramos la contraseña actual por seguridad
        });
        setModalOpen(true);
    };

    // Resetear password (solo en modo edición)
    const handleResetPassword = () => {
        if (!editingItem.rut) return alert("El usuario no tiene RUT definido.");
        const rutLimpio = cleanRut(editingItem.rut);
        const confirm = window.confirm(`¿Resetear contraseña al RUT (${rutLimpio})?`);
        if (confirm) {
            setEditingItem({ ...editingItem, password: rutLimpio });
            alert("Contraseña establecida al RUT. Presiona 'Guardar Cambios' para aplicar.");
        }
    };

    // Guardar (POST o PUT)
    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const isNew = !editingItem.id;
            const method = isNew ? 'POST' : 'PUT';

            // Si es nuevo y no puso password, usamos el RUT limpio como password inicial
            let payload = { ...editingItem };
            if (isNew && !payload.password && payload.rut) {
                payload.password = cleanRut(payload.rut);
            }

            const res = await fetch('/api/usuarios', {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setModalOpen(false);
                fetchUsers();
            } else {
                const errorData = await res.json();
                alert("Error al guardar: " + (errorData.error || errorData.message));
            }
        } catch (e) { console.error(e); alert("Error de conexión"); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (!confirm("¿Eliminar este registro completamente (Datos y Acceso)?")) return;
        await fetch(`/api/usuarios?id=${id}`, { method: 'DELETE' });
        fetchUsers();
    };

    // --- RENDER ---

    const filteredData = data.filter(item =>
        (item.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.rut || '').includes(searchTerm)
    );

    // Función para asignar colores a los roles
    const getRoleBadgeStyle = (rol) => {
        switch (rol) {
            case 'admin': return { bg: '#dbeafe', color: '#1e40af' }; // Azul
            case 'supervisor': return { bg: '#fce7f3', color: '#9d174d' }; // Rosa
            case 'coordinador': return { bg: '#fff7ed', color: '#c2410c' }; // Naranja
            case 'analista': return { bg: '#f3e8ff', color: '#7e22ce' }; // Morado
            case 'gtr': return { bg: '#dcfce7', color: '#166534' }; // Verde
            case 'analista_op': return { bg: '#fef3c7', color: '#92400e' }; // Amarillo
            case 'operaciones': return { bg: '#e0e7ff', color: '#3730a3' }; // Indigo
            case 'agente': return { bg: '#f1f5f9', color: '#475569' }; // Gris
            default: return { bg: '#f8fafc', color: '#94a3b8' };
        }
    };

    return (
        <div className="section-container">
            {/* HEADER */}
            <div className="top-bar" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', fontWeight: '700', color: '#0f172a' }}>
                    <Users color="#3b82f6" /> Gestión de Usuarios
                </h2>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                        <input
                            className="input-modern"
                            placeholder="Buscar..."
                            style={{ paddingLeft: '36px' }}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={handleAdd}>
                        <Plus size={18} /> Nuevo Usuario
                    </button>
                </div>
            </div>

            {/* TABLA */}
            <div className="table-card">
                <div className="table-wrapper">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th style={{ width: '50px' }}>Est.</th>
                                <th>Nombre / RUT</th>
                                <th>Contacto</th>
                                <th>Rol Sistema</th>
                                <th style={{ textAlign: 'center' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}><Loader2 className="spin" /></td></tr> :
                                filteredData.map(u => {
                                    const badgeStyle = getRoleBadgeStyle(u.rol);
                                    return (
                                        <tr key={u.id} onDoubleClick={() => handleEdit(u)} className="hover-row" style={{ cursor: 'pointer' }}>
                                            <td>
                                                {u.rol && u.rol !== 'sin_acceso' ? <UserCheck size={20} color="#16a34a" /> : <span style={{ color: '#cbd5e1' }}>•</span>}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: '600' }}>{u.nombre}</div>
                                                <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#64748b' }}>{u.rut}</div>
                                            </td>
                                            <td style={{ fontSize: '0.9rem' }}>
                                                <div><MapPin size={12} /> {u.direccion || '-'}</div>
                                                <div><Phone size={12} /> {u.fono || '-'}</div>
                                                <div><Mail size={12} /> {u.correo || '-'}</div>
                                            </td>
                                            <td>
                                                <span className="badge" style={{ background: badgeStyle.bg, color: badgeStyle.color, border: `1px solid ${badgeStyle.bg}` }}>
                                                    {(u.rol || 'Sin Acceso').toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                                <button className="btn btn-outline" style={{ padding: '6px' }} onClick={() => handleEdit(u)}>Editar</button>
                                                <button className="btn btn-danger" style={{ padding: '6px' }} onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }}><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    )
                                })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL (CREAR / EDITAR) */}
            {modalOpen && editingItem && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3>{editingItem.id ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</h3>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
                        </div>

                        <form onSubmit={handleSave} className="form-grid">
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="control-label">Nombre Completo</label>
                                    <input
                                        className="input-modern" style={{ width: '100%' }} required
                                        value={editingItem.nombre}
                                        onChange={e => setEditingItem({ ...editingItem, nombre: e.target.value })}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="control-label">RUT {editingItem.id && '(Fijo)'}</label>
                                    <input
                                        className="input-modern" style={{ width: '100%', background: editingItem.id ? '#f1f5f9' : '#fff' }}
                                        value={editingItem.rut}
                                        onChange={e => setEditingItem({ ...editingItem, rut: e.target.value })}
                                        readOnly={!!editingItem.id} // Solo editable si es nuevo
                                        required
                                        placeholder="Ej: 12345678-9"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="control-label">Dirección</label>
                                    <input className="input-modern" style={{ width: '100%' }} value={editingItem.direccion} onChange={e => setEditingItem({ ...editingItem, direccion: e.target.value })} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="control-label">Fono</label>
                                    <input className="input-modern" style={{ width: '100%' }} value={editingItem.fono} onChange={e => setEditingItem({ ...editingItem, fono: e.target.value })} />
                                </div>
                            </div>

                            {/* SECCIÓN SEGURIDAD Y ROLES */}
                            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ShieldAlert size={14} /> Acceso y Permisos
                                </h4>

                                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label className="control-label">Rol Asignado</label>
                                        <select
                                            className="input-modern"
                                            style={{ width: '100%' }}
                                            value={editingItem.rol}
                                            onChange={e => setEditingItem({ ...editingItem, rol: e.target.value })}
                                        >
                                            <option value="sin_acceso">Sin Acceso</option>
                                            <option value="agente">Agente</option>
                                            <option value="analista">Analista</option>
                                            <option value="gtr">GTR</option>
                                            <option value="analista_op">Analista Op</option>
                                            <option value="operaciones">Operaciones</option>
                                            <option value="coordinador">Coordinador</option>
                                            <option value="supervisor">Supervisor</option>
                                            <option value="admin">Administrador</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className="control-label">Correo (Login)</label>
                                        <input
                                            className="input-modern" style={{ width: '100%' }}
                                            value={editingItem.correo}
                                            onChange={e => setEditingItem({ ...editingItem, correo: e.target.value })}
                                            placeholder="usuario@empresa.cl"
                                        />
                                    </div>
                                </div>

                                {/* Manejo de contraseña */}
                                {editingItem.id ? (
                                    <button type="button" onClick={handleResetPassword} className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
                                        <Key size={16} /> Resetear Contraseña (Usar RUT)
                                    </button>
                                ) : (
                                    <div>
                                        <label className="control-label">Contraseña Inicial</label>
                                        <input
                                            className="input-modern" type="password" style={{ width: '100%' }}
                                            value={editingItem.password}
                                            onChange={e => setEditingItem({ ...editingItem, password: e.target.value })}
                                            placeholder="Dejar vacío para usar RUT"
                                        />
                                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>* Si se deja vacío, la clave será el RUT (sin puntos ni guión).</p>
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <Loader2 className="spin" /> : <><Save size={18} /> {editingItem.id ? 'Guardar Cambios' : 'Crear Usuario'}</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <style>{` .spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } } `}</style>
        </div>
    );
}
