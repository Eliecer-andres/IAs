import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
    Search, UploadCloud, FileDown, AlertCircle, CheckCircle, Loader2, Calendar,
    Filter, X, Plus, Edit2, Save, FileSpreadsheet
} from 'lucide-react';

// --- UTILIDADES ---
const normalizeString = (str) => {
    if (str === null || str === undefined) return "";
    return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

const formatDateDB = (date) => {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
    } catch (e) { return ''; }
};

const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

// Función para parsear horas Excel tal cual vienen
const parseExcelTime = (val) => {
    if (!val && val !== 0) return null;

    // Si es un número, verificar que sea un valor Excel válido (fracción de día: 0 a ~1.5)
    if (typeof val === 'number') {
        // Valores Excel de tiempo están entre 0 y ~1.5 (para turnos hasta 36 horas)
        // Valores fuera de rango son probablemente datos corruptos o erróneos
        if (val < 0 || val > 2) {
            console.warn(`parseExcelTime: Valor numérico fuera de rango válido: ${val}`);
            return null; // Valor inválido, devolver null
        }
        const totalSeconds = Math.round(val * 86400);
        const hours = Math.floor(totalSeconds / 3600) % 24; // Modulo 24 para que 1 = 00:00
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Si es string, verificar si es un tiempo válido o "LIBRE"
    const strVal = String(val).trim().toUpperCase();
    if (strVal === 'LIBRE' || strVal === '') {
        return 'LIBRE';
    }

    // Si es un string que parece hora (HH:MM), devolverlo
    if (/^\d{1,2}:\d{2}$/.test(strVal)) {
        return strVal;
    }

    // Si es un número en formato string, intentar parsearlo
    const numVal = parseFloat(val);
    if (!isNaN(numVal) && numVal >= 0 && numVal <= 2) {
        const totalSeconds = Math.round(numVal * 86400);
        const hours = Math.floor(totalSeconds / 3600) % 24; // Modulo 24 para que 1 = 00:00
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Valor no reconocido, devolver null
    console.warn(`parseExcelTime: Valor no reconocido: ${val}`);
    return null;
};

// --- NUEVA FUNCIÓN: GARANTIZA EL FORMATO YYYY-MM-DD PARA EL FILTRO ---
const ensureDateFormat = (val) => {
    if (!val) return null;

    // Si ya es un objeto Date de JS
    if (val instanceof Date) {
        return val.toISOString().split('T')[0];
    }

    const strVal = String(val).trim();

    // Caso 1: Viene como YYYY-MM-DD (Lo que queremos)
    if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
        return strVal;
    }

    // Caso 2: Viene como DD/MM/YYYY o DD-MM-YYYY (Común en Excel español)
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(strVal)) {
        const parts = strVal.split(/[/-]/); // Separa por / o -
        // Asumimos formato Dia-Mes-Año
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2];
        return `${y}-${m}-${d}`; // Retorna YYYY-MM-DD
    }

    // Intento final usando el constructor de Date
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
    }

    return strVal; // Si falla todo, devuelve lo que llegó (para que no se pierda, aunque podría fallar el filtro)
};

export default function TurnosManager() {
    // --- ESTADOS ---
    const [turnosData, setTurnosData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [weeksOptions, setWeeksOptions] = useState([]);
    const [selectedWeekId, setSelectedWeekId] = useState('');

    // Estado de Filtros
    const [activeFilters, setActiveFilters] = useState([
        { key: 'estado', label: 'Estado', value: 'Activo' }
    ]);

    const [newFilterCol, setNewFilterCol] = useState('nombre');
    const [newFilterVal, setNewFilterVal] = useState('');

    // Edición
    const [editingId, setEditingId] = useState(null);
    const [editStatusValue, setEditStatusValue] = useState('');

    // Modales
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [notification, setNotification] = useState(null);
    const [uploading, setUploading] = useState(false);

    // --- CARGA INICIAL ---
    useEffect(() => {
        const initWeeks = async () => {
            try {
                const res = await fetch('/api/turnos?get_dates=true');
                const dates = await res.json();

                const weeksMap = new Map();
                dates.forEach(row => {
                    if (!row.fecha) return;

                    // AQUÍ ES DONDE NECESITAMOS QUE VENGA "YYYY-MM-DD"
                    const parts = row.fecha.split('-');
                    // parts[0] debe ser Año.
                    const d = new Date(parts[0], parts[1] - 1, parts[2]);
                    const monday = getMonday(d);
                    const key = formatDateDB(monday);

                    if (!weeksMap.has(key)) {
                        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
                        const label = `Semana del ${monday.getDate()} al ${sunday.getDate()} de ${monday.toLocaleString('es-ES', { month: 'long' })}`;
                        weeksMap.set(key, { id: key, label, start: formatDateDB(monday), end: formatDateDB(sunday) });
                    }
                });

                const sorted = Array.from(weeksMap.values()).sort((a, b) => b.id.localeCompare(a.id));
                setWeeksOptions(sorted);

                if (sorted.length > 0) {
                    const today = formatDateDB(getMonday(new Date()));
                    const current = sorted.find(w => w.id === today);
                    setSelectedWeekId(current ? current.id : sorted[0].id);
                }
            } catch (err) { console.error(err); }
        };
        initWeeks();
    }, []);

    const fetchTurnos = async () => {
        if (!selectedWeekId) return;
        setLoading(true);
        const selectedObj = weeksOptions.find(w => w.id === selectedWeekId);
        if (!selectedObj) return;

        try {
            const res = await fetch(`/api/turnos?start=${selectedObj.start}&end=${selectedObj.end}`);
            const data = await res.json();
            setTurnosData(data);
        } catch (err) {
            setNotification({ message: 'Error cargando turnos', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTurnos(); }, [selectedWeekId]);

    // --- FILTROS ---
    const addFilter = () => {
        if (!newFilterVal.trim()) return;
        if (activeFilters.some(f => f.key === newFilterCol && f.value.toLowerCase() === newFilterVal.toLowerCase())) {
            setNewFilterVal('');
            return;
        }
        const labelMap = { nombre: 'Nombre', lugar: 'Lugar', servicio: 'Servicio', estado: 'Estado', rut: 'RUT' };
        setActiveFilters([...activeFilters, {
            key: newFilterCol,
            label: labelMap[newFilterCol],
            value: newFilterVal
        }]);
        setNewFilterVal('');
    };

    const removeFilter = (index) => {
        const newFilters = [...activeFilters];
        newFilters.splice(index, 1);
        setActiveFilters(newFilters);
    };

    const filteredData = useMemo(() => {
        if (!turnosData || turnosData.length === 0) return [];

        return turnosData.filter(item => {
            return activeFilters.every(filter => {
                const val = item[filter.key] || item[filter.key.charAt(0).toUpperCase() + filter.key.slice(1)];
                const cleanItemVal = normalizeString(val);
                const cleanFilterVal = normalizeString(filter.value);

                // Para el campo "estado", usar comparación exacta (evita que "activo" matchee con "inactivo")
                if (filter.key === 'estado') {
                    return cleanItemVal === cleanFilterVal;
                }

                // Para otros campos, usar includes (búsqueda parcial)
                return cleanItemVal.includes(cleanFilterVal);
            });
        });
    }, [turnosData, activeFilters]);

    // --- EDICIÓN ---
    const startEditing = (item) => {
        setEditingId(item.id);
        setEditStatusValue(item.estado || item.Estado || 'Activo');
    };

    const saveStatus = async (item) => {
        try {
            const res = await fetch('/api/turnos', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id, estado: editStatusValue })
            });

            if (res.ok) {
                const newData = turnosData.map(t => t.id === item.id ? { ...t, estado: editStatusValue } : t);
                setTurnosData(newData);
                setEditingId(null);
                setNotification({ message: 'Estado actualizado', type: 'success' });
                setTimeout(() => setNotification(null), 2000);
            } else {
                setNotification({ message: 'Error al actualizar.', type: 'error' });
            }
        } catch (e) {
            console.error(e);
            setNotification({ message: 'Error de conexión', type: 'error' });
        }
    };

    // --- DESCARGAR PLANTILLA ---
    const downloadTemplate = () => {
        const headers = [
            [
                "Rut", "Lugar", "Nombre", "Estado", "Fecha", "Dia", "Ini", "FIN",
                "Dur_Tur", "Desc_1", "Ini_Colac", "Fin_Colac", "Desc_2", "Dur_Colac",
                "HC", "Encargado", "Servicio"
            ]
        ];

        // Ejemplo de datos
        const example = [
            [
                "11.111.111-1", "Site", "Juan Perez", "Activo", "2025-05-15", "Jueves", "09:00", "18:00",
                "9", "Descanso", "13:00", "14:00", "", "60",
                "1", "Supervisor X", "Ventas"
            ]
        ];

        const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Turnos_Oficial");
        XLSX.writeFile(wb, "Plantilla_Turnos_Oficial.xlsx");
    };

    // --- SUBIDA DE ARCHIVOS ---
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const ws = wb.Sheets[wb.SheetNames[0]];
                // Usamos raw: false y dateNF para intentar que Excel nos de YYYY-MM-DD
                const rawMatrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

                if (rawMatrix.length < 2) {
                    setNotification({ message: 'Archivo vacío o sin datos', type: 'error' });
                    setUploading(false);
                    return;
                }

                const headers = rawMatrix[0].map(h => String(h).toLowerCase().trim());
                const dataRows = rawMatrix.slice(1);

                const processedData = dataRows.map(row => {
                    const newRow = {};

                    const getValByName = (keys) => {
                        const index = headers.findIndex(h => keys.includes(h));
                        return index !== -1 ? row[index] : null;
                    };

                    // 1. OBTENER FECHA CRUDA
                    let rawFecha = getValByName(['fecha', 'date']);

                    // 2. SI NO HAY NOMBRE, INTENTAR POR POSICIÓN (Columna 4 es Fecha)
                    if (!rawFecha && !row[0]) {
                        rawFecha = row[4];
                    }

                    // 3. APLICAR FORMATO FORZOSO YYYY-MM-DD
                    newRow.fecha = ensureDateFormat(rawFecha);

                    newRow.rut = getValByName(['rut', 'run']);

                    if (!newRow.rut && !newRow.nombre) {
                        // Estrategia por Posición Fija
                        newRow.rut = row[0];
                        newRow.lugar = row[1];
                        newRow.nombre = row[2];
                        newRow.estado = row[3] || 'Activo';
                        // Fecha ya procesada arriba (row[4])
                        newRow.dia = row[5];
                        newRow.ini = parseExcelTime(row[6]);
                        newRow.fin = parseExcelTime(row[7]);
                        newRow.dur_tur = row[8];
                        newRow.desc_1 = row[9];
                        newRow.ini_cola = parseExcelTime(row[10]);
                        newRow.fin_cola = parseExcelTime(row[11]);
                        newRow.desc_2 = row[12];
                        newRow.dur_cola = row[13];
                        newRow.hc = row[14];
                        newRow.encargado = row[15];
                        newRow.servicio = row[16];

                    } else {
                        // Estrategia por Nombre de Columna
                        newRow.nombre = getValByName(['nombre', 'colaborador']);
                        newRow.lugar = getValByName(['lugar', 'site']);
                        newRow.servicio = getValByName(['servicio', 'campaña']);
                        newRow.estado = getValByName(['estado', 'status']) || 'Activo';
                        newRow.dia = getValByName(['dia', 'day']);
                        newRow.ini = parseExcelTime(getValByName(['ini', 'inicio']));
                        newRow.fin = parseExcelTime(getValByName(['fin', 'fin', 'salida']));
                        newRow.dur_tur = getValByName(['dur_tur', 'duracion']);

                        newRow.desc_1 = getValByName(['desc_1']);
                        newRow.ini_cola = parseExcelTime(getValByName(['ini_colac', 'ini_cola']));
                        newRow.fin_cola = parseExcelTime(getValByName(['fin_colac', 'fin_cola']));
                        newRow.desc_2 = getValByName(['desc_2']);
                        newRow.dur_cola = getValByName(['dur_colac', 'dur_cola']);
                        newRow.hc = getValByName(['hc']);
                        newRow.encargado = getValByName(['encargado']);
                    }

                    return newRow;
                }).filter(r => r.rut && r.fecha);

                if (processedData.length === 0) {
                    throw new Error("No se pudieron leer datos válidos. Verifique la plantilla.");
                }

                const chunkSize = 50;
                for (let i = 0; i < processedData.length; i += chunkSize) {
                    const chunk = processedData.slice(i, i + chunkSize);
                    await fetch('/api/turnos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(chunk)
                    });
                }

                setNotification({ message: `Carga exitosa: ${processedData.length} registros.`, type: 'success' });
                setShowUploadModal(false);

                setTimeout(() => {
                    fetchTurnos();
                    setNotification(null);
                }, 1500);

            } catch (error) {
                console.error(error);
                setNotification({ message: 'Error procesando archivo: ' + error.message, type: 'error' });
            } finally {
                setUploading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleExportFiltered = () => {
        const dataToExport = filteredData.map(row => ({
            Fecha: row.fecha,
            Nombre: row.nombre,
            RUT: row.rut,
            Lugar: row.lugar,
            Servicio: row.servicio,
            Dia: row.dia,
            Inicio: row.ini,
            Fin: row.fin,
            Duracion: row.dur_tur || row.Dur_Tur,
            Estado: row.estado
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Turnos Filtrados");
        XLSX.writeFile(wb, `Turnos_${selectedWeekId}.xlsx`);
    };

    // --- RENDER ---
    return (
        <div className="section-container">

            {/* HEADER */}
            <div style={{
                background: 'linear-gradient(to right, #ffffff, #f8fafc)',
                padding: '20px', borderRadius: '16px', marginBottom: '25px',
                border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '800', color: '#1e293b', letterSpacing: '-0.5px' }}>
                            Gestión de Turnos
                        </h1>
                        <p style={{ margin: '5px 0 0 0', color: '#64748b' }}>Administración y control operativo</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={handleExportFiltered} className="btn btn-outline" style={{ background: 'white' }}>
                            <FileDown size={18} /> Exportar Vista
                        </button>
                        <button onClick={() => setShowUploadModal(true)} className="btn btn-primary" style={{ boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)' }}>
                            <UploadCloud size={18} /> Importar
                        </button>
                    </div>
                </div>

                {/* BARRA DE CONTROLES */}
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'end' }}>
                    <div style={{ flex: '1 1 250px', minWidth: '250px' }}>
                        <label className="control-label" style={{ marginLeft: '4px', marginBottom: '6px' }}>Semana Operativa</label>
                        <div style={{ position: 'relative' }}>
                            <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                            <select
                                className="input-modern"
                                value={selectedWeekId}
                                onChange={(e) => setSelectedWeekId(e.target.value)}
                                style={{ width: '100%', paddingLeft: '38px', fontWeight: '500' }}
                            >
                                {weeksOptions.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{
                        flex: '999 1 300px', // Allow growing but wrap eagerly
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'end',
                        background: '#f1f5f9',
                        padding: '10px',
                        borderRadius: '12px',
                        flexWrap: 'wrap' // Allow internal wrapping
                    }}>
                        <div style={{ flex: '1 1 120px' }}>
                            <label className="control-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Columna</label>
                            <select className="input-modern" style={{ padding: '8px' }} value={newFilterCol} onChange={e => setNewFilterCol(e.target.value)}>
                                <option value="nombre">Nombre</option>
                                <option value="rut">RUT</option>
                                <option value="lugar">Lugar</option>
                                <option value="servicio">Servicio</option>
                                <option value="estado">Estado</option>
                            </select>
                        </div>
                        <div style={{ flex: '2 1 150px' }}>
                            <label className="control-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Valor a buscar</label>
                            <input
                                className="input-modern"
                                placeholder="Escribe y presiona +..."
                                style={{ padding: '8px', width: '100%' }}
                                value={newFilterVal}
                                onChange={e => setNewFilterVal(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addFilter()}
                            />
                        </div>
                        <button className="btn btn-primary" style={{ padding: '8px 12px', height: '38px' }} onClick={addFilter}>
                            <Plus size={18} />
                        </button>
                    </div>
                </div>

                {/* FILTROS ACTIVOS */}
                <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', minHeight: '32px' }}>
                    {activeFilters.length === 0 && <span style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic', alignSelf: 'center' }}>Sin filtros activos (Mostrando todo)</span>}

                    {activeFilters.map((f, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: f.key === 'estado' ? '#ecfdf5' : '#eff6ff',
                            color: f.key === 'estado' ? '#047857' : '#1d4ed8',
                            border: f.key === 'estado' ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
                            padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                            animation: 'popIn 0.2s ease-out'
                        }}>
                            <Filter size={12} style={{ opacity: 0.6 }} />
                            <span>{f.label}: {f.value}</span>
                            <button
                                onClick={() => removeFilter(i)}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', color: 'inherit', padding: 0, marginLeft: '4px' }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* TABLA */}
            <div className="table-card">
                <div className="table-wrapper">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Nombre</th>
                                <th>Lugar</th>
                                <th>Servicio</th>
                                <th>Inicio</th>
                                <th>Fin</th>
                                <th>Duración</th>
                                <th>Estado</th>
                                <th style={{ textAlign: 'center' }}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '50px' }}><Loader2 className="spin" size={32} color="#3b82f6" /></td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No se encontraron resultados con los filtros actuales.</td></tr>
                            ) : (
                                filteredData.map(row => (
                                    <tr key={row.id} className="hover-row">
                                        <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>{row.fecha}</td>
                                        <td style={{ fontWeight: '600', color: '#1e293b' }}>{row.nombre}</td>
                                        <td><span className={`badge ${row.lugar === 'TT' ? 'badge-active' : 'badge-inactive'}`} style={{ background: row.lugar === 'TT' ? '#f0fdf4' : '#f8fafc', color: row.lugar === 'TT' ? '#15803d' : '#475569' }}>{row.lugar}</span></td>
                                        <td style={{ fontSize: '0.85rem' }}>{row.servicio}</td>
                                        <td style={{ fontFamily: 'monospace' }}>{row.ini}</td>
                                        <td style={{ fontFamily: 'monospace' }}>{row.fin}</td>

                                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>
                                            {(row.dur_tur || row.Dur_Tur) ? (row.dur_tur || row.Dur_Tur) : '-'}
                                        </td>

                                        <td onDoubleClick={() => startEditing(row)} style={{ cursor: 'pointer' }}>
                                            {editingId === row.id ? (
                                                <select
                                                    className="input-modern"
                                                    style={{ padding: '4px', fontSize: '0.85rem' }}
                                                    value={editStatusValue}
                                                    onChange={e => setEditStatusValue(e.target.value)}
                                                    autoFocus
                                                    onBlur={() => setEditingId(null)}
                                                >
                                                    <option value="Activo">Activo</option>
                                                    <option value="Inactivo">Inactivo</option>
                                                </select>
                                            ) : (
                                                <span className={`badge`} style={{
                                                    background: (row.estado || 'Activo') === 'Activo' ? '#dcfce7' : '#fee2e2',
                                                    color: (row.estado || 'Activo') === 'Activo' ? '#166534' : '#991b1b',
                                                    border: '1px solid transparent',
                                                    borderColor: (row.estado || 'Activo') === 'Activo' ? '#bbf7d0' : '#fecaca'
                                                }}>
                                                    {row.estado || 'Activo'}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {editingId === row.id ? (
                                                <button className="btn btn-primary" style={{ padding: '4px 8px' }} onMouseDown={(e) => { e.preventDefault(); saveStatus(row); }}>
                                                    <Save size={14} />
                                                </button>
                                            ) : (
                                                <button className="btn btn-outline" style={{ padding: '4px 8px', border: 'none' }} onClick={() => startEditing(row)}>
                                                    <Edit2 size={14} color="#94a3b8" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Mostrando {filteredData.length} registros</span>
                    <span>Total cargados: {turnosData.length}</span>
                </div>
            </div>

            {notification && (
                <div style={{
                    position: 'fixed', bottom: '30px', right: '30px',
                    background: notification.type === 'error' ? '#fee2e2' : '#dcfce7',
                    color: notification.type === 'error' ? '#991b1b' : '#166534',
                    padding: '12px 24px', borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontWeight: '600', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', zIndex: 1000
                }}>
                    {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                    {notification.message}
                </div>
            )}

            {showUploadModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0 }}>Importar Turnos</h3>
                            <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                            <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b' }}>
                                1. Asegúrate de que tu archivo sigue el formato correcto.<br />
                                2. Si el sistema no reconoce los encabezados, intentará leer por orden de columna.
                            </p>
                            <button onClick={downloadTemplate} className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
                                <FileSpreadsheet size={16} /> Descargar Plantilla Oficial
                            </button>
                        </div>

                        <div style={{ position: 'relative', border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '30px', textAlign: 'center', cursor: 'pointer', background: uploading ? '#f1f5f9' : 'white' }}>
                            {uploading ? (
                                <div style={{ color: '#3b82f6', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                    <Loader2 className="spin" size={32} />
                                    <span>Procesando archivo...</span>
                                </div>
                            ) : (
                                <>
                                    <UploadCloud size={40} color="#94a3b8" style={{ marginBottom: '10px' }} />
                                    <p style={{ margin: 0, color: '#64748b' }}>Arrastra tu archivo aquí o haz clic</p>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleFileUpload}
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .spin { animation: spin 1s linear infinite; } 
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
}
