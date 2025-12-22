
import React, { useState, useEffect } from 'react';
import {
    ArrowLeftRight, Download, AlertTriangle, CheckCircle, XCircle,
    Search, UserPlus, Trash2, Calendar, Loader2, RefreshCw, Filter, X,
    Save, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { useUI } from '../context/UIContext';

// IMPORTANTE: Aquí importamos el CSS de la ruta solicitada
import './CambioTurnosManager.css';

// =========================================================================
// === UTILIDADES ===
// =========================================================================

const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

const formatDateDB = (date) => {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
    } catch (e) { return ''; }
};

const formatTime = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') {
        const clean = val.trim().toUpperCase();
        if (clean.includes('LIBRE') || clean === '') return '';
        if (clean.includes(':')) {
            const parts = clean.split(':');
            const h = parts[0].padStart(2, '0');
            const m = parts[1].substring(0, 2).padStart(2, '0');
            return `${h}:${m}`;
        }
        return '';
    }
    if (val instanceof Date && !isNaN(val)) {
        return `${String(val.getHours()).padStart(2, '0')}:${String(val.getMinutes()).padStart(2, '0')}`;
    }
    return '';
};

const calculateMinutes = (startStr, endStr) => {
    if (!startStr || !endStr) return NaN;
    const [h1, m1] = startStr.split(':').map(Number);
    const [h2, m2] = endStr.split(':').map(Number);
    let minutesStart = h1 * 60 + m1;
    let minutesEnd = h2 * 60 + m2;
    if (minutesEnd <= minutesStart) minutesEnd += 24 * 60;
    return minutesEnd - minutesStart;
};

// =========================================================================
// === COMPONENTE PRINCIPAL ===
// =========================================================================

export default function CambioTurnosManager() {
    const { showToast, confirm } = useUI();
    const [loading, setLoading] = useState(false);
    const [weeksOptions, setWeeksOptions] = useState([]);
    const [selectedWeekId, setSelectedWeekId] = useState('');

    const [allData, setAllData] = useState([]);
    const [availableAgents, setAvailableAgents] = useState([]);

    // Estados de gestión
    const [addedAgents, setAddedAgents] = useState([]);
    const [simulationState, setSimulationState] = useState({});
    const [originalState, setOriginalState] = useState({}); // Nuevo: Almacena el snapshot original
    const [agentStatus, setAgentStatus] = useState({}); // 'pending', 'applied', 'loading'
    const [expandedCards, setExpandedCards] = useState({}); // Nuevo: Controla la visibilidad { [rut]: boolean }

    const [selectedServices, setSelectedServices] = useState(['01_Masivo']);
    const [uniqueServices, setUniqueServices] = useState([]);

    const [notification, setNotification] = useState(null);
    const [showSwapModal, setShowSwapModal] = useState(null);
    const [showServiceMenu, setShowServiceMenu] = useState(false);
    const [isExcelReady, setIsExcelReady] = useState(false);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js";
        script.async = true;
        script.onload = () => setIsExcelReady(true);
        document.body.appendChild(script);
        return () => { if (document.body.contains(script)) document.body.removeChild(script); }
    }, []);

    // Carga de Semanas
    useEffect(() => {
        const initWeeks = async () => {
            try {
                const res = await fetch('/api/turnos?get_dates=true');
                const dates = await res.json();

                const weeksMap = new Map();
                dates.forEach(row => {
                    if (!row.fecha) return;
                    const parts = row.fecha.split('-');
                    const d = new Date(parts[0], parts[1] - 1, parts[2]);
                    const monday = getMonday(d);
                    const key = formatDateDB(monday);

                    if (!weeksMap.has(key)) {
                        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
                        const label = `Semana del ${monday.getDate()} al ${sunday.getDate()} de ${monday.toLocaleString('es-ES', { month: 'long' })} `;
                        weeksMap.set(key, { id: key, label, start: formatDateDB(monday), end: formatDateDB(sunday) });
                    }
                });

                const sorted = Array.from(weeksMap.values()).sort((a, b) => b.id.localeCompare(a.id));
                setWeeksOptions(sorted);
                if (sorted.length > 0) setSelectedWeekId(sorted[0].id);

            } catch (err) { console.error(err); }
        };
        initWeeks();
    }, []);

    // Carga de Datos y Sincronización con BD
    const fetchData = async () => {
        if (!selectedWeekId) return;
        setLoading(true);

        try {
            const weekObj = weeksOptions.find(w => w.id === selectedWeekId);

            // 1. Cargar Turnos Reales
            const res = await fetch(`/api/turnos?start=${weekObj.start}&end=${weekObj.end}`);
            const data = await res.json();

            const processed = data.map(r => ({
                id: r.id,
                rut: String(r.rut || r.Rut || '').trim(),
                nombre: r.nombre || r.Nombre,
                fecha: r.fecha,
                ini: r.ini,
                fin: r.fin,
                dur_cola: parseInt(r.dur_cola || 0),
                servicio: r.servicio || r.Servicio || 'Sin Servicio'
            })).filter(r => r.rut && r.fecha);

            setAllData(processed);

            const services = [...new Set(processed.map(r => r.servicio))].sort();
            setUniqueServices(services);
            if (selectedServices.length === 0 && services.length > 0) setSelectedServices([services[0]]);

            // 2. Cargar Historial de Cambios desde DB
            const changesRes = await fetch(`/api/cambios-turnos?semana_id=${selectedWeekId}`);
            if (changesRes.ok) {
                const changesData = await changesRes.json();

                const newSimulationState = {};
                const newOriginalState = {};
                const newAgentStatus = {};
                const newExpandedCards = {};
                const newAddedAgents = new Set();

                changesData.forEach(change => {
                    newAddedAgents.add(change.rut);
                    // Parsear el JSON guardado
                    let modificado = [];
                    let originalSnapshot = [];
                    try { modificado = JSON.parse(change.turno_modificado); } catch (e) { }
                    try { originalSnapshot = JSON.parse(change.turno_original); } catch (e) { }

                    // IMPORTANTE: Si modificado está vacío o no tiene 7 días, usar el original como base
                    if (!modificado || modificado.length !== 7) {
                        modificado = originalSnapshot;
                    }

                    newSimulationState[change.rut] = modificado;
                    newOriginalState[change.rut] = originalSnapshot;
                    const st = change.estado === 'Aplicado' ? 'applied' : 'pending';
                    newAgentStatus[change.rut] = st;
                    // Si está aplicado, colapsado por defecto. Si es pendiente, expandido.
                    newExpandedCards[change.rut] = st !== 'applied';
                });

                setAddedAgents(Array.from(newAddedAgents));
                setSimulationState(newSimulationState);
                setOriginalState(newOriginalState);
                setAgentStatus(newAgentStatus);
                setExpandedCards(newExpandedCards);
            }

        } catch (e) {
            console.error(e);
            showToast('error', 'Error cargando datos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedWeekId]);

    // Filtro de Agentes Disponibles
    useEffect(() => {
        if (allData.length === 0) {
            setAvailableAgents([]);
            return;
        }
        const agentsMap = new Map();
        allData.forEach(row => {
            if (selectedServices.includes(row.servicio)) {
                if (!agentsMap.has(row.rut)) {
                    agentsMap.set(row.rut, { rut: row.rut, nombre: row.nombre, servicio: row.servicio });
                }
            }
        });
        setAvailableAgents(Array.from(agentsMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)));
    }, [allData, selectedServices]);

    const getOriginalSchedule = (rut) => {
        if (!selectedWeekId) return [];
        const weekObj = weeksOptions.find(w => w.id === selectedWeekId);
        const start = new Date(weekObj.start + 'T00:00:00');

        const schedule = [];
        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(start);
            currentDay.setDate(start.getDate() + i);
            const dateStr = formatDateDB(currentDay);

            const dayData = allData.find(d => String(d.rut) === String(rut) && d.fecha === dateStr);

            if (dayData && dayData.ini && !String(dayData.ini).toUpperCase().includes('LIBRE')) {
                schedule.push({
                    dbId: dayData.id,
                    date: dateStr,
                    startTime: formatTime(dayData.ini),
                    endTime: formatTime(dayData.fin),
                    colacion: String(dayData.dur_cola || 0),
                    isLibre: false
                });
            } else {
                schedule.push({
                    dbId: dayData ? dayData.id : null,
                    date: dateStr,
                    startTime: '', endTime: '', colacion: '0', isLibre: true
                });
            }
        }
        return schedule;
    };

    // --- LÓGICA CRÍTICA: AGREGAR AGENTE Y GUARDAR EN PENDIENTE ---
    const addAgentToTable = async (rut) => {
        if (!rut) return;
        if (addedAgents.includes(rut)) {
            showToast('error', 'Este agente ya está en la mesa de trabajo.');
            return;
        }

        const agent = availableAgents.find(a => a.rut === rut);
        const original = getOriginalSchedule(rut);
        const copyForMod = JSON.parse(JSON.stringify(original));

        // Guardado inicial en DB como "Pendiente"
        try {
            const res = await fetch('/api/cambios-turnos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rut: rut,
                    nombre: agent.nombre,
                    semana_id: selectedWeekId,
                    estado: 'Pendiente',
                    turno_original: original,
                    turno_modificado: copyForMod
                })
            });

            if (!res.ok) {
                const err = await res.json();
                if (res.status === 409) {
                    showToast('warning', '⚠️ Ya existe una gestión para este agente esta semana.');
                } else {
                    showToast('error', 'Error al iniciar gestión.');
                }
                return; // No lo agregamos visualmente si falló en DB
            }

            // Si guardó OK en DB, actualizamos estado visual
            setSimulationState(prev => ({ ...prev, [rut]: copyForMod }));
            setOriginalState(prev => ({ ...prev, [rut]: original })); // Guardamos snapshot local
            setAgentStatus(prev => ({ ...prev, [rut]: 'pending' }));
            setExpandedCards(prev => ({ ...prev, [rut]: true })); // Nuevo: Expandir al agregar
            setAddedAgents(prev => [...prev, rut]);

        } catch (e) {
            showToast('error', 'Error de conexión.');
        }
    };

    const updateSchedule = (rut, dayIdx, field, val) => {
        if (agentStatus[rut] === 'applied') return; // Bloqueado si ya está aplicado

        setSimulationState(prev => {
            const newSchedule = [...prev[rut]];
            newSchedule[dayIdx] = { ...newSchedule[dayIdx], [field]: val };
            return { ...prev, [rut]: newSchedule };
        });
        // Visualmente sigue pendiente, pero los datos cambiaron.
        // Podríamos hacer un auto-save aquí o esperar al botón "Aplicar".
        // Para esta versión, actualizaremos la BD al momento de "Aplicar".
    };

    const handleRemoveAgent = async (rut) => {
        const status = agentStatus[rut];

        let confirmed = false;

        if (status === 'applied') {
            confirmed = await confirm({
                title: '¿Revertir Cambios?',
                message: 'Este cambio ya fue APLICADO. Si lo eliminas, los turnos se revertirán a su estado original antes del cambio. ¿Estás seguro?',
                type: 'danger',
                confirmText: 'Sí, Revertir y Eliminar',
                cancelText: 'Cancelar'
            });
        } else {
            confirmed = await confirm({
                title: '¿Quitar de la mesa?',
                message: 'Se eliminarán los cambios pendientes de este agente. No se afectarán los turnos reales.',
                type: 'warning',
                confirmText: 'Sí, Quitar',
                cancelText: 'Cancelar'
            });
        }

        if (!confirmed) return;

        try {
            if (status === 'applied') {
                // Lógica de reversión: Restaurar Turnos Originales en BD
                const original = originalState[rut]; // Recuperamos el snapshot
                if (original && original.length > 0) {
                    const updates = [];
                    original.forEach(day => {
                        if (day.dbId) {
                            updates.push({
                                id: day.dbId,
                                ini: day.startTime || 'LIBRE',
                                fin: day.endTime || 'LIBRE',
                                dur_cola: day.colacion
                            });
                        }
                    });

                    for (const update of updates) {
                        await fetch('/api/turnos', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(update)
                        });
                    }

                    // Forzar recarga de turnos reales después de revertir para que la vista gral se actualice
                    // fetchData() se llamará al final
                }
            }

            // Eliminar de DB (tabla cambios_turnos)
            await fetch(`/api/cambios-turnos?rut=${rut}&semana_id=${selectedWeekId}`, { method: 'DELETE' });

            // Limpiar visualmente
            setAddedAgents(prev => prev.filter(r => r !== rut));

            const newSim = { ...simulationState }; delete newSim[rut]; setSimulationState(newSim);
            const newOrig = { ...originalState }; delete newOrig[rut]; setOriginalState(newOrig);
            const newStatus = { ...agentStatus }; delete newStatus[rut]; setAgentStatus(newStatus);

            showToast('success', status === 'applied' ? 'Cambios revertidos correctamente.' : 'Operación cancelada.');

            if (status === 'applied') {
                await fetchData(); // Refrescamos todo para ver los turnos originales en la grilla principal
            }

        } catch (e) {
            console.error(e);
            showToast('error', 'Error al eliminar/revertir.');
        }
    };

    const validateSchedule = (rut, schedule) => {
        const messages = [];
        let status = 'valid';
        const errorDays = [];
        let totalWeeklyHours = 0;
        let shifts = [];

        if (!schedule) return { status: 'valid', messages: [], errorDays: [] };

        schedule.forEach((day, idx) => {
            if ((day.startTime && !day.endTime) || (!day.startTime && day.endTime)) {
                status = 'error';
                errorDays.push(idx);
            }
            if (day.startTime && day.endTime) {
                const minutes = calculateMinutes(day.startTime, day.endTime);
                const hours = (minutes - parseInt(day.colacion || 0)) / 60;

                if (hours > 10) { status = 'error'; messages.push(`⛔ Día ${idx + 1}: Jornada > 10h`); errorDays.push(idx); }
                if (hours < 4 && hours > 0) { status = 'error'; messages.push(`⛔ Día ${idx + 1}: Jornada < 4h`); errorDays.push(idx); }
                totalWeeklyHours += hours;

                let startDt = new Date(2023, 0, idx + 1, parseInt(day.startTime.split(':')[0]), parseInt(day.startTime.split(':')[1]));
                let endDt = new Date(2023, 0, idx + 1, parseInt(day.endTime.split(':')[0]), parseInt(day.endTime.split(':')[1]));
                if (endDt <= startDt) endDt.setDate(endDt.getDate() + 1);
                shifts.push({ start: startDt, end: endDt, dayIndex: idx });
            }
        });

        for (let i = 1; i < shifts.length; i++) {
            const diffMs = shifts[i].start - shifts[i - 1].end;
            const diffHrs = diffMs / (1000 * 60 * 60);
            if (diffHrs < 12) {
                status = 'error';
                messages.push(`⛔ Descanso < 12h(Día ${shifts[i - 1].dayIndex + 1} - ${shifts[i].dayIndex + 1})`);
                errorDays.push(shifts[i].dayIndex);
            }
        }

        if (totalWeeklyHours > 45) { status = 'error'; messages.push(`⛔ Exceso Semanal: ${totalWeeklyHours.toFixed(1)} h`); }
        else if (totalWeeklyHours < 40) { if (status !== 'error') status = 'warning'; messages.push(`⚠️ Déficit Semanal: ${totalWeeklyHours.toFixed(1)} h`); }
        else { messages.push(`✅ Semanal: ${totalWeeklyHours.toFixed(1)} h`); }

        if (shifts.length > 6) { status = 'error'; messages.push('⛔ Sin día libre'); }

        return { status, messages, errorDays };
    };

    const handleApplyChanges = async (rut) => {
        const schedule = simulationState[rut];
        const validation = validateSchedule(rut, schedule);

        if (validation.status === 'error') {
            showToast('error', 'Corrige los errores normativos antes de aplicar.');
            return;
        }

        setAgentStatus(prev => ({ ...prev, [rut]: 'applying' }));

        try {
            // 1. Actualizar Turnos Reales (Tabla 'turnos')
            const updates = [];
            schedule.forEach(day => {
                if (day.dbId) {
                    updates.push({
                        id: day.dbId,
                        ini: day.startTime || 'LIBRE',
                        fin: day.endTime || 'LIBRE',
                        dur_cola: day.colacion
                    });
                }
            });

            // Ejecutar PUTs a la tabla principal
            for (const update of updates) {
                await fetch('/api/turnos', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(update)
                });
            }

            // 2. Actualizar Estado en 'cambios_turnos' a 'Aplicado'
            // Y guardar la versión final del modificado
            await fetch('/api/cambios-turnos', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rut: rut,
                    semana_id: selectedWeekId,
                    estado: 'Aplicado',
                    turno_modificado: schedule
                })
            });

            // 3. UI Update
            setAgentStatus(prev => ({ ...prev, [rut]: 'applied' }));
            setExpandedCards(prev => ({ ...prev, [rut]: false })); // Nuevo: Colapsar al aplicar
            showToast('success', `Cambios aplicados correctamente.`);

            // Recargar para que 'original' se actualice en memoria si quisiéramos comparar de nuevo,
            // pero como ya está aplicado, se bloquea.
            await fetchData();

        } catch (error) {
            console.error(error);
            setAgentStatus(prev => ({ ...prev, [rut]: 'pending' }));
            showToast('error', 'Error al aplicar cambios.');
        } finally {
            // setTimeout(() => setNotification(null), 3000); 
        }
    };

    const handleSwap = (sourceRut, targetRut) => {
        // Implementación básica de swap visual (no guarda DB automáticamente hasta aplicar)
        // Pero como exigimos que al seleccionar se guarde en DB, aquí deberíamos
        // llamar a la API para ambos. Por simplicidad en la UI, lo dejamos local
        // y el usuario debe dar 'Aplicar' a cada uno.

        const sourceSched = simulationState[sourceRut] || getOriginalSchedule(sourceRut);
        const targetSched = simulationState[targetRut] || getOriginalSchedule(targetRut);

        // Si el destino no está en mesa, agregarlo (esto disparará el POST a DB)
        if (!addedAgents.includes(targetRut)) {
            addAgentToTable(targetRut);
            // Pequeño delay para asegurar que el estado se asiente antes de swappear
            setTimeout(() => {
                performSwap(sourceRut, targetRut, sourceSched, targetSched);
            }, 500);
        } else {
            performSwap(sourceRut, targetRut, sourceSched, targetSched);
        }
    };

    const performSwap = (sourceRut, targetRut, sourceSched, targetSched) => {
        setSimulationState(prev => ({
            ...prev,
            [sourceRut]: JSON.parse(JSON.stringify(targetSched)),
            [targetRut]: JSON.parse(JSON.stringify(sourceSched))
        }));
        setAgentStatus(prev => ({ ...prev, [sourceRut]: 'pending', [targetRut]: 'pending' }));
        setShowSwapModal(null);
        showToast('success', 'Turnos intercambiados. Revisa y aplica.');
    };

    const handleDownload = async () => {
        if (!isExcelReady) return;
        if (addedAgents.length === 0) return;

        const ExcelJS = window.ExcelJS;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Cambios de Turno');

        // Set column widths (matching template)
        worksheet.columns = [
            { width: 10.26 }, { width: 10.26 }, { width: 10.26 }, { width: 10.26 }, { width: 10.26 }, { width: 10.26 }, { width: 10.26 },
            { width: 10.26 }, { width: 10.26 }, { width: 10.26 }, { width: 10.26 }, { width: 10.26 }, { width: 10.26 }, { width: 10.26 },
            { width: 2 }, { width: 30 }
        ];

        const weekObj = weeksOptions.find(w => w.id === selectedWeekId);
        const weekStart = new Date(weekObj.start + 'T00:00:00');
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const startDay = String(weekStart.getDate()).padStart(2, '0');
        const endDay = String(weekEnd.getDate()).padStart(2, '0');
        const monthName = weekEnd.toLocaleDateString('es-ES', { month: 'long' }).toUpperCase();
        const mainTitleText = `CAMBIOS TURNO DEL ${startDay} AL ${endDay} ${monthName}`;

        // Main Title Row (Row 3)
        const titleRow = worksheet.getRow(3);
        const titleCell = titleRow.getCell(2);
        titleCell.value = mainTitleText;
        worksheet.mergeCells('B3:N3');
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
        titleCell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12, name: 'Calibri' };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        // Style functions
        const applySubtitleStyle = (cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A3041' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11, name: 'Calibri' };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        };
        const applyHeaderStyle = (cell, text) => {
            cell.value = text;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF83CAEB' } };
            cell.font = { color: { argb: 'FF000000' }, bold: true, size: 10, name: 'Calibri' };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        };
        const applyDataStyle = (cell) => {
            cell.font = { color: { argb: 'FF000000' }, size: 10, name: 'Calibri' };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        };

        let currentRowIndex = 5;
        const headers = ['RUT', 'FECHA', 'INICIO', 'TERMINO', 'JORNADA', 'COLACION'];

        // Iterate through added agents
        addedAgents.forEach((rut) => {
            const agent = availableAgents.find(a => a.rut === rut);
            const agentName = agent ? agent.nombre : rut;
            const modifiedSchedule = simulationState[rut] || [];
            const original = originalState[rut] || [];

            // Subtitle Row (TURNO ORIGINAL / TURNO A MODIFICAR)
            const subtitleRow = worksheet.getRow(currentRowIndex);
            const subLeft = subtitleRow.getCell(2);
            subLeft.value = 'TURNO ORIGINAL';
            const subRight = subtitleRow.getCell(9);
            subRight.value = 'TURNO A MODIFICAR';
            worksheet.mergeCells(`B${currentRowIndex}:G${currentRowIndex}`);
            worksheet.mergeCells(`I${currentRowIndex}:N${currentRowIndex}`);
            applySubtitleStyle(subLeft);
            applySubtitleStyle(subRight);
            currentRowIndex++;

            // Header Row
            const headerRow = worksheet.getRow(currentRowIndex);
            headers.forEach((header, index) => {
                applyHeaderStyle(headerRow.getCell(2 + index), header);
                applyHeaderStyle(headerRow.getCell(9 + index), header);
            });
            currentRowIndex++;

            // Data Rows (7 days)
            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                const dataRow = worksheet.getRow(currentRowIndex + dayIndex);
                const dayDate = new Date(weekStart);
                dayDate.setDate(weekStart.getDate() + dayIndex);
                const formattedDate = `${String(dayDate.getDate()).padStart(2, '0')}/${String(dayDate.getMonth() + 1).padStart(2, '0')}/${dayDate.getFullYear()}`;

                // Original Schedule
                const origDay = original[dayIndex] || {};
                const oIni = origDay.startTime || '';
                const oFin = origDay.endTime || '';
                const oCol = origDay.colacion || '0';
                let oJor = '';
                if (oIni && oFin) {
                    const mins = calculateMinutes(oIni, oFin);
                    oJor = ((mins - parseInt(oCol || 0)) / 60).toFixed(1);
                }

                const originalValues = [rut, formattedDate, oIni || 'LIBRE', oFin || 'LIBRE', oIni ? oJor : '', oIni ? oCol : ''];
                originalValues.forEach((val, i) => dataRow.getCell(2 + i).value = val);

                // Modified Schedule
                const modDay = modifiedSchedule[dayIndex] || {};
                const mIni = modDay.startTime || '';
                const mFin = modDay.endTime || '';
                const mCol = modDay.colacion || '0';
                let mJor = '';
                if (mIni && mFin) {
                    const mins = calculateMinutes(mIni, mFin);
                    mJor = ((mins - parseInt(mCol || 0)) / 60).toFixed(1);
                }

                const modifiedValues = [rut, formattedDate, mIni || 'LIBRE', mFin || 'LIBRE', mIni ? mJor : '', mIni ? mCol : ''];
                modifiedValues.forEach((val, i) => dataRow.getCell(9 + i).value = val);

                // Apply styles
                for (let col = 2; col <= 7; col++) applyDataStyle(dataRow.getCell(col));
                for (let col = 9; col <= 14; col++) applyDataStyle(dataRow.getCell(col));

                // Agent name in column P (first row only)
                if (dayIndex === 0) {
                    const nameCell = dataRow.getCell(16);
                    nameCell.value = agentName;
                    applyDataStyle(nameCell);
                    nameCell.alignment = { horizontal: 'left', vertical: 'middle' };
                }
            }
            currentRowIndex += 7;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Cambios_Turno_${startDay}_al_${endDay}_${monthName}.xlsx`);
    };

    return (
        <div className="section-container" style={{ padding: 0 }}>
            {/* Notifications handled globally now */}

            {/* HEADER */}
            <div className="ctm-top-bar">
                <div>
                    <h1 className="ctm-title"><ArrowLeftRight color="#2563eb" /> Gestor de Cambios</h1>
                    <p className="ctm-subtitle">Simulación y validación normativa</p>
                </div>
                <button onClick={handleDownload} disabled={addedAgents.length === 0} className="ctm-btn ctm-btn-primary">
                    <Download size={18} /> Descargar Excel
                </button>
            </div>

            {/* CONTROLES */}
            <div className="ctm-card ctm-controls">
                <div className="ctm-control-group">
                    <label className="ctm-label">Semana Operativa</label>
                    <div className="ctm-input-wrapper">
                        <Calendar size={18} className="ctm-input-icon" />
                        <select className="ctm-select" value={selectedWeekId} onChange={e => setSelectedWeekId(e.target.value)}>
                            {weeksOptions.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="ctm-control-group" style={{ position: 'relative' }}>
                    <label className="ctm-label">Servicios</label>
                    <button className="ctm-input-btn" onClick={() => setShowServiceMenu(!showServiceMenu)}>
                        <span>{selectedServices.length} Seleccionados</span> <Filter size={16} color="#94a3b8" />
                    </button>
                    {showServiceMenu && (
                        <div className="ctm-dropdown">
                            <div className="ctm-dropdown-header">
                                <span>FILTRAR SERVICIO</span>
                                <button onClick={() => setShowServiceMenu(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={14} /></button>
                            </div>
                            <div className="ctm-dropdown-list">
                                {uniqueServices.map(svc => (
                                    <label key={svc} className="ctm-checkbox-label">
                                        <input type="checkbox" checked={selectedServices.includes(svc)} onChange={(e) => {
                                            if (e.target.checked) setSelectedServices(prev => [...prev, svc]);
                                            else setSelectedServices(prev => prev.filter(s => s !== svc));
                                        }} />
                                        {svc}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="ctm-control-group">
                    <label className="ctm-label">Agregar Ejecutivo</label>
                    <div className="ctm-input-wrapper">
                        <UserPlus size={18} className="ctm-input-icon" />
                        <select className="ctm-select" onChange={(e) => { if (e.target.value) { addAgentToTable(e.target.value); e.target.value = ""; } }}>
                            <option value="">Buscar ejecutivo...</option>
                            {availableAgents.filter(a => !addedAgents.includes(a.rut)).map(a => <option key={a.rut} value={a.rut}>{a.nombre}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* ZONA DE SIMULACIÓN */}
            {loading ? (
                <div className="ctm-loading-state"><Loader2 size={48} className="ctm-spin" /><p>Cargando datos...</p></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {addedAgents.length === 0 && (
                        <div className="ctm-empty-state ctm-empty-box">
                            <div className="ctm-icon-circle"><ArrowLeftRight size={40} color="#94a3b8" /></div>
                            <h3>Mesa de Trabajo Vacía</h3>
                            <p>Selecciona un ejecutivo arriba para comenzar.</p>
                        </div>
                    )}

                    {addedAgents.map(rut => {
                        const agent = availableAgents.find(a => a.rut === rut);
                        // Usar state si existe, si no original (aunque siempre debería existir state si está en addedAgents)
                        // PRIORIDAD: originalState (snapshot) > getOriginalSchedule (vivo)
                        // Esto arregla que al aplicar, el "Original" no cambie
                        const original = originalState[rut] || getOriginalSchedule(rut);
                        const simState = simulationState[rut];
                        // Fallback to original if simulationState is empty or has no actual schedule data
                        const modified = (simState && simState.length === 7) ? simState : original;
                        const validation = validateSchedule(rut, modified);
                        const status = agentStatus[rut] || 'pending';
                        const isExpanded = expandedCards[rut];

                        const toggleCard = () => setExpandedCards(prev => ({ ...prev, [rut]: !prev[rut] }));

                        return (
                            <div key={rut} className="ctm-card ctm-agent-card">
                                <div className="ctm-agent-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1, cursor: 'pointer' }} onClick={toggleCard}>
                                        <div style={{ color: '#94a3b8' }}>
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                        <div>
                                            <h3 className="ctm-agent-name">{agent?.nombre || 'Agente'}</h3>
                                            <p className="ctm-agent-meta">{rut} • {agent?.servicio}</p>
                                        </div>

                                        <span className={`status - btn ${status} `}>
                                            {status === 'pending' && <><Clock size={14} /> Pendiente</>}
                                            {status === 'applying' && <><Loader2 size={14} className="ctm-spin" /> Aplicando...</>}
                                            {status === 'applied' && <><CheckCircle size={14} /> Aplicado</>}
                                        </span>

                                        {status === 'pending' && (
                                            <button onClick={(e) => { e.stopPropagation(); handleApplyChanges(rut); }} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                                                Aplicar Cambios
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => setShowSwapModal({ sourceRut: rut, type: 'smart' })} disabled={status === 'applied'} className="ctm-btn ctm-btn-sm ctm-btn-smart">
                                            <RefreshCw size={14} /> Smart Swap
                                        </button>
                                        <button onClick={() => setShowSwapModal({ sourceRut: rut, type: 'manual' })} disabled={status === 'applied'} className="ctm-btn ctm-btn-sm ctm-btn-manual">
                                            <ArrowLeftRight size={14} /> Swap
                                        </button>
                                        <button onClick={() => handleRemoveAgent(rut)} className="ctm-btn ctm-btn-sm ctm-btn-danger">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="ctm-grid-layout">
                                        <div className="ctm-tables-area">
                                            {/* Tabla Original */}
                                            <div className="ctm-col-original">
                                                <div className="ctm-table-header ctm-header-original">TURNO ORIGINAL</div>
                                                <table className="ctm-table">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ textAlign: 'left', paddingLeft: '15px' }}>Día</th><th>Inicio</th><th>Fin</th><th>Col</th><th>Hrs</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {original.map((day, i) => {
                                                            const d = new Date(weeksOptions.find(w => w.id === selectedWeekId).start + 'T00:00:00'); d.setDate(d.getDate() + i);
                                                            const hrs = day.startTime ? ((calculateMinutes(day.startTime, day.endTime) - parseInt(day.colacion)) / 60).toFixed(1) : '-';
                                                            return (
                                                                <tr key={i}>
                                                                    <td style={{ paddingLeft: '15px', color: '#475569', textTransform: 'capitalize' }}>{d.toLocaleDateString('es-ES', { weekday: 'short' })}</td>
                                                                    <td>{day.startTime || '--'}</td><td>{day.endTime || '--'}</td><td>{day.colacion}</td><td>{hrs}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Tabla Modificada */}
                                            <div className="ctm-col-modified">
                                                <div className="ctm-table-header ctm-header-modified">TURNO MODIFICADO</div>
                                                <table className="ctm-table">
                                                    <thead><tr><th>Inicio</th><th>Fin</th><th>Col</th><th>Hrs</th></tr></thead>
                                                    <tbody>
                                                        {modified.map((day, i) => {
                                                            const isError = validation.errorDays.includes(i);
                                                            const hrs = day.startTime ? ((calculateMinutes(day.startTime, day.endTime) - parseInt(day.colacion)) / 60).toFixed(1) : '-';
                                                            return (
                                                                <tr key={i} className={isError ? 'ctm-row-error' : ''}>
                                                                    <td><input type="time" className="ctm-input-time" value={day.startTime} onChange={e => updateSchedule(rut, i, 'startTime', e.target.value)} disabled={status === 'applied'} /></td>
                                                                    <td><input type="time" className="ctm-input-time" value={day.endTime} onChange={e => updateSchedule(rut, i, 'endTime', e.target.value)} disabled={status === 'applied'} /></td>
                                                                    <td>
                                                                        <select className="ctm-input-select" value={day.colacion} onChange={e => updateSchedule(rut, i, 'colacion', e.target.value)} disabled={status === 'applied'}>
                                                                            <option value="0">0</option><option value="30">30</option><option value="60">60</option>
                                                                        </select>
                                                                    </td>
                                                                    <td style={{ fontWeight: 'bold' }}>{hrs}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Panel de Validación Lateral */}
                                        <div className="ctm-validation-panel">
                                            <div className={`ctm - validation - box ${validation.status === 'valid' ? 'ctm-valid' : validation.status === 'warning' ? 'ctm-warning' : 'ctm-error'} `}>
                                                <div className="ctm-validation-header">
                                                    {validation.status === 'valid' ? <CheckCircle size={18} /> : validation.status === 'warning' ? <AlertTriangle size={18} /> : <XCircle size={18} />}
                                                    {validation.status === 'valid' ? 'Cumple Normativa' : validation.status === 'warning' ? 'Advertencia' : 'Error Normativo'}
                                                </div>
                                                <ul className="ctm-validation-list">
                                                    {validation.messages.map((m, i) => (
                                                        <li key={i} className="ctm-validation-item"><span>•</span> {m}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {showSwapModal && (
                <div className="ctm-modal-overlay">
                    <div className="ctm-modal">
                        <div className="ctm-modal-header">
                            <h3 className="ctm-modal-title">{showSwapModal.type === 'smart' ? '✨ Intercambio Inteligente' : '🔄 Intercambio Manual'}</h3>
                            <button onClick={() => setShowSwapModal(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div className="ctm-modal-list">
                            {availableAgents
                                .filter(a => a.rut !== showSwapModal.sourceRut)
                                // Filtro inteligente si es smart swap
                                .filter(target => {
                                    if (showSwapModal.type === 'manual') return true;
                                    const sourceSched = simulationState[showSwapModal.sourceRut] || getOriginalSchedule(showSwapModal.sourceRut);
                                    const targetSched = simulationState[target.rut] || getOriginalSchedule(target.rut);
                                    const val1 = validateSchedule(showSwapModal.sourceRut, targetSched);
                                    const val2 = validateSchedule(target.rut, sourceSched);
                                    return val1.status !== 'error' && val2.status !== 'error';
                                })
                                .map(candidate => (
                                    <button key={candidate.rut} className="ctm-modal-item" onClick={() => handleSwap(showSwapModal.sourceRut, candidate.rut)}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: '#334155' }}>{candidate.nombre}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{candidate.servicio}</div>
                                        </div>
                                        <ArrowLeftRight size={16} color="#cbd5e1" />
                                    </button>
                                ))
                            }
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
