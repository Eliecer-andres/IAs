import React, { useState, useEffect, useMemo } from 'react';
import {
    LayoutDashboard, Users, Calendar, Clock, UserCheck, UserX,
    Table, LineChart, ChevronDown, Download, Loader2
} from 'lucide-react';

// --- UTILIDADES ---
const formatDateDB = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getStartOfWeek = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
};

const formatTime = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (str.includes(':')) {
        const [h, m] = str.split(':');
        return `${h.padStart(2, '0')}:${(m || '00').substring(0, 2).padStart(2, '0')}`;
    }
    return '';
};

const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const DimensionamientoManager = () => {
    const [loading, setLoading] = useState(true);
    const [turnosData, setTurnosData] = useState([]);
    const [selectedWeekId, setSelectedWeekId] = useState('');
    const [selectedDate, setSelectedDate] = useState(formatDateDB(new Date()));
    const [intervalHourly, setIntervalHourly] = useState(true); // true = 60min, false = 30min
    const [weeksOptions, setWeeksOptions] = useState([]);

    // Cargar datos de turnos
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Obtener rango de fechas (4 semanas atrás y 4 adelante)
                const today = new Date();
                const startRange = new Date(today);
                startRange.setDate(today.getDate() - 28);
                const endRange = new Date(today);
                endRange.setDate(today.getDate() + 28);

                const res = await fetch(`/api/turnos?start=${formatDateDB(startRange)}&end=${formatDateDB(endRange)}`);
                if (res.ok) {
                    const data = await res.json();
                    // Procesar datos: convertir fechas y horas
                    const processed = data.map(row => {
                        const fecha = new Date(row.fecha + 'T12:00:00');
                        let inicioTurno = null, finTurno = null;

                        if (row.ini && !String(row.ini).toUpperCase().includes('LIBRE')) {
                            const iniTime = formatTime(row.ini);
                            const finTime = formatTime(row.fin);
                            if (iniTime && finTime) {
                                const [hIni, mIni] = iniTime.split(':').map(Number);
                                const [hFin, mFin] = finTime.split(':').map(Number);
                                inicioTurno = new Date(fecha);
                                inicioTurno.setHours(hIni, mIni, 0, 0);
                                finTurno = new Date(fecha);
                                finTurno.setHours(hFin, mFin, 0, 0);
                                // Si fin es menor que inicio, es al día siguiente
                                if (finTurno <= inicioTurno) {
                                    finTurno.setDate(finTurno.getDate() + 1);
                                }
                            }
                        }

                        return {
                            ...row,
                            FECHA: fecha,
                            'INICIO TURNO': inicioTurno,
                            'FIN DEL TURNO': finTurno,
                            Nombre: row.nombre,
                            Estado: row.estado,
                            Servicio: row.servicio
                        };
                    });
                    setTurnosData(processed);
                    populateWeeks(processed);
                }
            } catch (e) {
                console.error('Error cargando turnos:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const populateWeeks = (data) => {
        if (!data.length) return;
        const weekStarts = [...new Set(data.map(t => getStartOfWeek(t.FECHA).getTime()))];
        weekStarts.sort((a, b) => a - b);

        const options = weekStarts.map(ts => {
            const start = new Date(ts);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            return {
                id: formatDateDB(start),
                label: `Semana del ${start.getDate()} al ${end.getDate()} de ${monthNames[end.getMonth()]}`,
                start: start
            };
        });
        setWeeksOptions(options);

        // Seleccionar semana actual
        const currentWeekStart = formatDateDB(getStartOfWeek(new Date()));
        const found = options.find(w => w.id === currentWeekStart);
        setSelectedWeekId(found ? found.id : options[options.length - 1]?.id || '');
    };

    // Calcular agentes por intervalo
    const calculateAgents = (dataSet, dateObj, intervalMinutes, startMinute, serviceFilter = null, applyStatusFilter = true) => {
        if (!dataSet || dataSet.length === 0) return 0;
        const year = dateObj.getFullYear(), month = dateObj.getMonth(), day = dateObj.getDate();
        const inicioIntervalo = new Date(year, month, day, 0, startMinute);
        const finIntervalo = new Date(year, month, day, 0, startMinute + intervalMinutes - 1);

        return dataSet.filter(turno => {
            if (applyStatusFilter) {
                const estado = turno.Estado || turno.estado || '';
                if (String(estado).trim().toUpperCase() !== 'ACTIVO') return false;
            }
            if (serviceFilter) {
                const servicio = turno.Servicio || turno.servicio || '';
                if (String(servicio).trim().toUpperCase() !== serviceFilter.toUpperCase()) return false;
            }
            const inicioTurno = turno['INICIO TURNO'], finTurno = turno['FIN DEL TURNO'];
            return inicioTurno && finTurno && inicioTurno <= finIntervalo && finTurno > inicioIntervalo;
        }).length;
    };

    // Datos para la tabla consolidada
    const consolidatedData = useMemo(() => {
        if (!selectedDate || turnosData.length === 0) return [];
        const dateObj = new Date(selectedDate + 'T12:00:00');
        const intervalDuration = intervalHourly ? 60 : 30;
        const numIntervals = 24 * (60 / intervalDuration);
        const results = [];

        for (let i = 0; i < numIntervals; i++) {
            const totalMinutes = i * intervalDuration;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const timeLabel = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            const agents = calculateAgents(turnosData, dateObj, intervalDuration, totalMinutes, null, true);
            results.push({ timeLabel, agents });
        }
        return results;
    }, [turnosData, selectedDate, intervalHourly]);

    // Estado de agentes
    const agentStats = useMemo(() => {
        if (!selectedDate || turnosData.length === 0) return { onShift: 0, available: 0, inactive: 0, total: 0, active: 0 };
        const dateObj = new Date(selectedDate + 'T12:00:00');
        const now = new Date();
        const syntheticNow = new Date(dateObj);
        syntheticNow.setHours(now.getHours(), now.getMinutes(), 0, 0);

        const todayShifts = turnosData.filter(s => s.FECHA && s.FECHA.toDateString() === dateObj.toDateString());
        const uniqueAgents = [...new Set(todayShifts.map(s => s.Nombre))];
        const activeAgents = todayShifts.filter(s => String(s.Estado || '').toUpperCase() === 'ACTIVO');
        const uniqueActive = [...new Set(activeAgents.map(s => s.Nombre))];

        const total = uniqueAgents.length;
        const activeTotal = uniqueActive.length;
        const inactiveTotal = total - activeTotal;

        // Contar quiénes están en turno ahora
        const onShiftNow = uniqueActive.filter(name => {
            const shifts = activeAgents.filter(s => s.Nombre === name);
            return shifts.some(s => s['INICIO TURNO'] && s['FIN DEL TURNO'] && syntheticNow >= s['INICIO TURNO'] && syntheticNow < s['FIN DEL TURNO']);
        }).length;

        const available = activeTotal - onShiftNow;

        return { onShift: onShiftNow, available, inactive: inactiveTotal, total, active: activeTotal };
    }, [turnosData, selectedDate]);

    // Tabla semanal
    const weeklyData = useMemo(() => {
        if (!selectedWeekId || turnosData.length === 0) return { days: [], intervals: [] };
        const weekStart = new Date(selectedWeekId + 'T00:00:00');
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            days.push(d);
        }

        const intervalDuration = intervalHourly ? 60 : 30;
        const numIntervals = 24 * (60 / intervalDuration);
        const intervals = [];

        for (let i = 0; i < numIntervals; i++) {
            const totalMinutes = i * intervalDuration;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const timeLabel = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            const row = { timeLabel, values: [] };
            days.forEach(day => {
                const agents = calculateAgents(turnosData, day, intervalDuration, totalMinutes, null, true);
                row.values.push(agents);
            });
            intervals.push(row);
        }
        return { days, intervals };
    }, [turnosData, selectedWeekId, intervalHourly]);

    // Estilos
    const cardStyle = { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '20px' };
    const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e2e8f0' };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh', flexDirection: 'column', gap: '15px' }}>
                <Loader2 size={48} className="animate-spin" style={{ color: '#3b82f6' }} />
                <p style={{ color: '#64748b' }}>Cargando dimensionamiento...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '30px', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <LayoutDashboard size={28} color="#3b82f6" />
                        Dimensionamiento Diario
                    </h1>
                    <p style={{ color: '#64748b', marginTop: '5px' }}>Análisis de cobertura y dotación</p>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <select
                        value={selectedWeekId}
                        onChange={e => setSelectedWeekId(e.target.value)}
                        className="input-modern"
                        style={{ padding: '10px 15px', borderRadius: '8px', minWidth: '250px' }}
                    >
                        {weeksOptions.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Layout Principal */}
            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '25px' }}>
                {/* Columna Izquierda - Tabla Consolidada (más angosta) */}
                <div style={cardStyle}>
                    <div style={headerStyle}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Table size={18} color="#64748b" />
                            Consolidado
                        </h3>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="input-modern"
                            style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem' }}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b' }}>
                            <span>30m</span>
                            <input
                                type="checkbox"
                                checked={intervalHourly}
                                onChange={e => setIntervalHourly(e.target.checked)}
                                style={{ width: '32px', height: '16px' }}
                            />
                            <span>1h</span>
                        </label>
                    </div>
                    <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#3b82f6', color: 'white' }}>
                                <tr>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.85rem' }}>Hora</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: '0.85rem' }}>Agentes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {consolidatedData.map((row, i) => (
                                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '6px 10px', fontWeight: '600', color: '#1e293b', fontSize: '0.85rem' }}>{row.timeLabel}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                            <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: '12px', fontWeight: '600', fontSize: '0.85rem' }}>
                                                {row.agents}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Columna Derecha - Estado de Agentes */}
                <div>
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                            <Users size={24} color="#3b82f6" />
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1e293b', margin: 0 }}>Estado de Agentes</h3>
                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Distribución del día</span>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
                            {/* En Turno */}
                            <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '15px', borderLeft: '4px solid #22c55e', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>En Turno</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '8px 0' }}>
                                    <UserCheck size={20} color="#22c55e" />
                                    <span style={{ fontSize: '1.8rem', fontWeight: '700', color: '#1e293b' }}>{agentStats.onShift}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                    {agentStats.active > 0 ? ((agentStats.onShift / agentStats.active) * 100).toFixed(1) : 0}%
                                </div>
                                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${agentStats.active > 0 ? (agentStats.onShift / agentStats.active) * 100 : 0}%`, background: '#22c55e', borderRadius: '3px' }} />
                                </div>
                            </div>

                            {/* Libres */}
                            <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '15px', borderLeft: '4px solid #3b82f6', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Libres</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '8px 0' }}>
                                    <Clock size={20} color="#3b82f6" />
                                    <span style={{ fontSize: '1.8rem', fontWeight: '700', color: '#1e293b' }}>{agentStats.available}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                    {agentStats.active > 0 ? ((agentStats.available / agentStats.active) * 100).toFixed(1) : 0}%
                                </div>
                                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${agentStats.active > 0 ? (agentStats.available / agentStats.active) * 100 : 0}%`, background: '#3b82f6', borderRadius: '3px' }} />
                                </div>
                            </div>

                            {/* Inactivos */}
                            <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '15px', borderLeft: '4px solid #ef4444', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Inactivos</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '8px 0' }}>
                                    <UserX size={20} color="#ef4444" />
                                    <span style={{ fontSize: '1.8rem', fontWeight: '700', color: '#1e293b' }}>{agentStats.inactive}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                    {agentStats.total > 0 ? ((agentStats.inactive / agentStats.total) * 100).toFixed(1) : 0}%
                                </div>
                                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${agentStats.total > 0 ? (agentStats.inactive / agentStats.total) * 100 : 0}%`, background: '#ef4444', borderRadius: '3px' }} />
                                </div>
                            </div>
                        </div>

                        <div style={{ textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.9rem' }}>
                            <strong>Total: {agentStats.total} agentes</strong> • Activos: {agentStats.active}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabla Semanal */}
            <div style={cardStyle}>
                <div style={headerStyle}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Calendar size={20} color="#64748b" />
                        Planificación Semanal
                    </h3>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: '50vh' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#3b82f6', color: 'white' }}>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Hora</th>
                                {weeklyData.days.map((d, i) => {
                                    const dayName = d.toLocaleDateString('es-CL', { weekday: 'short' });
                                    const datePart = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '');
                                    return (
                                        <th key={i} style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ textTransform: 'capitalize' }}>{dayName}</div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{datePart}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {weeklyData.intervals.map((row, i) => (
                                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '8px 12px', fontWeight: '600', color: '#1e293b' }}>{row.timeLabel}</td>
                                    {row.values.map((val, j) => (
                                        <td key={j} style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b' }}>{val}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DimensionamientoManager;
