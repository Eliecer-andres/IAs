import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard, Users, Calendar, ArrowLeftRight, Clock,
    TrendingUp, AlertTriangle, CheckCircle, Loader2, BarChart3
} from 'lucide-react';

const DashboardManager = ({ currentUser }) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalUsuarios: 0,
        usuariosActivos: 0,
        usuariosInactivos: 0,
        cambiosSemana: 0,
        cambiosPendientes: 0,
        cambiosAplicados: 0,
        turnosSemana: 0,
        semanaActual: ''
    });
    const [cambiosRecientes, setCambiosRecientes] = useState([]);

    // Obtener fecha del lunes de la semana actual
    const getMonday = (d) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff));
    };

    const formatDateDB = (d) => {
        const date = new Date(d);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                // Calcular semana actual
                const today = new Date();
                const monday = getMonday(today);
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                const semanaId = formatDateDB(monday);
                const semanaLabel = `${monday.getDate()} al ${sunday.getDate()} de ${sunday.toLocaleDateString('es-ES', { month: 'long' })}`;

                // Fetch usuarios
                const usuariosRes = await fetch('/api/usuarios');
                let totalUsuarios = 0, usuariosActivos = 0, usuariosInactivos = 0;
                if (usuariosRes.ok) {
                    const usuarios = await usuariosRes.json();
                    totalUsuarios = usuarios.length;
                    usuariosActivos = usuarios.filter(u => u.activo === 1 || u.activo === '1' || u.activo === true).length;
                    usuariosInactivos = totalUsuarios - usuariosActivos;
                }

                // Fetch cambios de turno de la semana actual
                const cambiosRes = await fetch(`/api/cambios-turnos?semana_id=${semanaId}`);
                let cambiosSemana = 0, cambiosPendientes = 0, cambiosAplicados = 0;
                let cambiosData = [];
                if (cambiosRes.ok) {
                    cambiosData = await cambiosRes.json();
                    cambiosSemana = cambiosData.length;
                    cambiosPendientes = cambiosData.filter(c => c.estado === 'Pendiente').length;
                    cambiosAplicados = cambiosData.filter(c => c.estado === 'Aplicado').length;
                }

                // Fetch turnos de la semana
                const turnosRes = await fetch(`/api/turnos?start=${semanaId}&end=${formatDateDB(sunday)}`);
                let turnosSemana = 0;
                if (turnosRes.ok) {
                    const turnos = await turnosRes.json();
                    turnosSemana = turnos.length;
                }

                setStats({
                    totalUsuarios,
                    usuariosActivos,
                    usuariosInactivos,
                    cambiosSemana,
                    cambiosPendientes,
                    cambiosAplicados,
                    turnosSemana,
                    semanaActual: semanaLabel
                });

                setCambiosRecientes(cambiosData.slice(0, 5)); // Últimos 5 cambios

            } catch (err) {
                console.error('Error fetching dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const cardStyle = {
        background: '#fff',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0'
    };

    const kpiCardStyle = (color) => ({
        ...cardStyle,
        borderLeft: `4px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
    });

    const iconBoxStyle = (bgColor) => ({
        width: '50px',
        height: '50px',
        borderRadius: '12px',
        background: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    });

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh', flexDirection: 'column', gap: '15px' }}>
                <Loader2 size={48} className="animate-spin" style={{ color: '#3b82f6' }} />
                <p style={{ color: '#64748b' }}>Cargando métricas...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '30px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <LayoutDashboard size={28} color="#3b82f6" />
                    Dashboard Operativo
                </h1>
                <p style={{ color: '#64748b', marginTop: '5px' }}>
                    Semana del <strong>{stats.semanaActual}</strong>
                </p>
            </div>

            {/* KPI Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>

                {/* Usuarios Activos */}
                <div style={kpiCardStyle('#22c55e')}>
                    <div style={iconBoxStyle('#dcfce7')}>
                        <Users size={24} color="#22c55e" />
                    </div>
                    <div>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '4px' }}>Usuarios Activos</p>
                        <p style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>{stats.usuariosActivos}</p>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>de {stats.totalUsuarios} total</p>
                    </div>
                </div>

                {/* Usuarios Inactivos */}
                <div style={kpiCardStyle('#ef4444')}>
                    <div style={iconBoxStyle('#fee2e2')}>
                        <Users size={24} color="#ef4444" />
                    </div>
                    <div>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '4px' }}>Usuarios Inactivos</p>
                        <p style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>{stats.usuariosInactivos}</p>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>requieren atención</p>
                    </div>
                </div>

                {/* Cambios de Turno */}
                <div style={kpiCardStyle('#3b82f6')}>
                    <div style={iconBoxStyle('#dbeafe')}>
                        <ArrowLeftRight size={24} color="#3b82f6" />
                    </div>
                    <div>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '4px' }}>Cambios de Turno</p>
                        <p style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>{stats.cambiosSemana}</p>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>esta semana</p>
                    </div>
                </div>

                {/* Turnos Registrados */}
                <div style={kpiCardStyle('#8b5cf6')}>
                    <div style={iconBoxStyle('#ede9fe')}>
                        <Calendar size={24} color="#8b5cf6" />
                    </div>
                    <div>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '4px' }}>Turnos Registrados</p>
                        <p style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>{stats.turnosSemana}</p>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>esta semana</p>
                    </div>
                </div>
            </div>

            {/* Secondary Stats + Table Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>

                {/* Estado de Cambios */}
                <div style={cardStyle}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BarChart3 size={18} color="#64748b" />
                        Estado de Cambios
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {/* Pendientes */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontSize: '0.875rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={14} color="#f59e0b" /> Pendientes
                                </span>
                                <span style={{ fontWeight: '600', color: '#1e293b' }}>{stats.cambiosPendientes}</span>
                            </div>
                            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${stats.cambiosSemana ? (stats.cambiosPendientes / stats.cambiosSemana) * 100 : 0}%`,
                                    background: '#f59e0b',
                                    borderRadius: '4px',
                                    transition: 'width 0.5s ease'
                                }} />
                            </div>
                        </div>

                        {/* Aplicados */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontSize: '0.875rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <CheckCircle size={14} color="#22c55e" /> Aplicados
                                </span>
                                <span style={{ fontWeight: '600', color: '#1e293b' }}>{stats.cambiosAplicados}</span>
                            </div>
                            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${stats.cambiosSemana ? (stats.cambiosAplicados / stats.cambiosSemana) * 100 : 0}%`,
                                    background: '#22c55e',
                                    borderRadius: '4px',
                                    transition: 'width 0.5s ease'
                                }} />
                            </div>
                        </div>
                    </div>

                    {/* Target Indicator */}
                    <div style={{ marginTop: '25px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Tasa de Aplicación</span>
                            <span style={{
                                fontSize: '1.25rem',
                                fontWeight: '700',
                                color: stats.cambiosSemana ? (stats.cambiosAplicados / stats.cambiosSemana >= 0.8 ? '#22c55e' : '#f59e0b') : '#94a3b8'
                            }}>
                                {stats.cambiosSemana ? Math.round((stats.cambiosAplicados / stats.cambiosSemana) * 100) : 0}%
                            </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                            Target: 80% de cambios aplicados
                        </p>
                    </div>
                </div>

                {/* Cambios Recientes Table */}
                <div style={cardStyle}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={18} color="#64748b" />
                        Cambios Recientes
                    </h3>

                    {cambiosRecientes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                            <ArrowLeftRight size={32} style={{ marginBottom: '10px', opacity: 0.3 }} />
                            <p>No hay cambios registrados esta semana</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: '600' }}>Nombre</th>
                                    <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: '600' }}>RUT</th>
                                    <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: '600' }}>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cambiosRecientes.map((cambio, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px 8px', fontSize: '0.875rem', color: '#1e293b' }}>{cambio.nombre || 'N/A'}</td>
                                        <td style={{ padding: '12px 8px', fontSize: '0.875rem', color: '#64748b' }}>{cambio.rut}</td>
                                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                fontWeight: '600',
                                                background: cambio.estado === 'Aplicado' ? '#dcfce7' : '#fef3c7',
                                                color: cambio.estado === 'Aplicado' ? '#16a34a' : '#d97706'
                                            }}>
                                                {cambio.estado === 'Aplicado' ? <CheckCircle size={12} /> : <Clock size={12} />}
                                                {cambio.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardManager;
