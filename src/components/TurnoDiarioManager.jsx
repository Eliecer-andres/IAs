import React, { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { 
  FileSpreadsheet, Loader2, Download, AlertCircle, CheckCircle, Calendar 
} from 'lucide-react';

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

const formatDateDB = (date) => date.toISOString().slice(0, 10);

const parseTimeStr = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    const cleanTime = String(timeStr).trim().toUpperCase();
    // AQUÍ SE DETECTA "LIBRE". Si es libre, retorna null.
    if (cleanTime.includes('LIBRE') || cleanTime === '') return null;
    
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hr, min] = cleanTime.split(':').map(Number);
    if (isNaN(hr) || isNaN(min)) return null;
    
    return new Date(y, m - 1, d, hr, min);
};

const formatTime = (date) => { 
    if (!(date instanceof Date) || isNaN(date)) return ''; 
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; 
};

const formatDate = (date) => { 
    if (!(date instanceof Date)) return ''; 
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']; 
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']; 
    return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]} del ${date.getFullYear()}`; 
};

// =========================================================================
// === EL CEREBRO: ALGORITMO DE DESCANSOS (CLON EXACTO) ===
// =========================================================================
const asignarDescansosSegunPlan = (dayData) => {
    const VENTANAS_COLACION = {
        '00:00-08:00': { start: '03:00', end: '05:00' },'00:00-08:30': { start: '03:00', end: '05:00' },'00:00-09:00': { start: '03:00', end: '05:00' },'00:00-09:30': { start: '03:00', end: '05:00' },'00:00-10:00': { start: '03:00', end: '05:00' },'07:00-11:00': { start: '11:30', end: '12:00' },'07:00-14:00': { start: '11:00', end: '12:00' },'07:00-14:30': { start: '11:00', end: '12:00' },'07:00-15:00': { start: '11:00', end: '12:00' },'07:00-16:00': { start: '12:00', end: '13:00' },'07:00-17:00': { start: '12:00', end: '13:00' },'08:00-14:30': { start: '11:00', end: '12:00' },'08:00-16:00': { start: '12:00', end: '13:00' },'08:00-17:00': { start: '12:00', end: '14:00' },'08:00-18:00': { start: '13:00', end: '15:00' },'08:30-17:30': { start: '13:00', end: '15:00' },'08:30-18:30': { start: '13:00', end: '15:30' },'09:00-15:30': { start: '12:00', end: '13:00' },'09:00-17:00': { start: '14:00', end: '15:00' },'09:00-18:00': { start: '14:00', end: '16:00' },'09:00-19:00': { start: '14:00', end: '16:00' },'10:00-16:30': { start: '13:00', end: '14:00' },'10:00-17:00': { start: '13:00', end: '14:00' },'10:00-19:00': { start: '15:00', end: '16:00' },'10:00-20:00': { start: '15:00', end: '17:00' },'11:00-20:00': { start: '15:00', end: '16:00' },'12:00-18:30': { start: '14:00', end: '15:00' },'12:00-20:00': { start: '16:00', end: '17:00' },'12:00-22:00': { start: '16:00', end: '17:00' },'13:00-22:00': { start: '16:00', end: '17:00' },'14:00-00:00': { start: '16:00', end: '18:00' },'15:00-00:00': { start: '17:00', end: '19:00' },'16:00-00:00': { start: '18:00', end: '20:00' },'17:30-00:00': { start: '19:00', end: '20:00' }, '14:00-22:00': { start: '16:00', end: '17:00' }, 'fallback': { start: '11:00', end: '15:00' }
    };
    const CAPACIDADES_COLACION = { '11': 5, '12': 5, '13': 5, '14': 9, '15': 9, '16': 7, '17': 7, '19': 3, 'madrugada': 1 };
    
    const VENTANAS_BREAKS = {
        '00:00-08:00': { break1: { start: '02:00', end: '03:00' }, break2: { start: '07:00', end: '08:00' } },'00:00-08:30': { break1: { start: '02:00', end: '03:00' }, break2: { start: '07:00', end: '08:00' } },'00:00-09:00': { break1: { start: '02:00', end: '03:00' }, break2: { start: '07:00', end: '08:00' } },'00:00-09:30': { break1: { start: '02:00', end: '03:00' }, break2: { start: '07:00', end: '08:00' } },'00:00-10:00': { break1: { start: '02:00', end: '03:00' }, break2: { start: '07:00', end: '08:00' } },'07:00-11:00': { break1: { start: '08:30', end: '09:00' }, break2: { start: '10:00', end: '10:45' } },'07:00-14:00': { break1: { start: '08:30', end: '09:00' }, break2: { start: '13:00', end: '13:45' } },'07:00-14:30': { break1: { start: '08:30', end: '09:30' }, break2: { start: '13:00', end: '14:00' } },'07:00-15:00': { break1: { start: '08:30', end: '09:30' }, break2: { start: '13:00', end: '14:00' } },'07:00-16:00': { break1: { start: '08:30', end: '10:00' }, break2: { start: '14:30', end: '15:45' } },'07:00-17:00': { break1: { start: '08:30', end: '10:00' }, break2: { start: '14:30', end: '16:30' } },'08:00-12:00': { break1: { start: '09:30', end: '10:00' }, break2: { start: '10:45', end: '11:45' } },'08:00-13:00': { break1: { start: '09:30', end: '10:00' }, break2: { start: '11:45', end: '12:45' } },'08:00-14:30': { break1: { start: '09:30', end: '10:00' }, break2: { start: '13:00', end: '14:00' } },'08:00-16:00': { break1: { start: '09:30', end: '10:00' }, break2: { start: '14:00', end: '15:45' } },'08:00-17:00': { break1: { start: '09:45', end: '11:00' }, break2: { start: '15:45', end: '16:45' } },'08:00-18:00': { break1: { start: '09:45', end: '11:00' }, break2: { start: '15:45', end: '17:45' } },'08:30-17:30': { break1: { start: '10:30', end: '11:30' }, break2: { start: '16:45', end: '17:00' } },'08:30-18:30': { break1: { start: '10:30', end: '11:30' }, break2: { start: '16:45', end: '18:00' } },'09:00-15:30': { break1: { start: '10:45', end: '11:45' }, break2: { start: '14:30', end: '15:30' } },'09:00-17:00': { break1: { start: '10:45', end: '11:45' }, break2: { start: '15:45', end: '16:45' } },'09:00-18:00': { break1: { start: '10:45', end: '11:45' }, break2: { start: '16:45', end: '17:45' } },'09:00-19:00': { break1: { start: '10:45', end: '12:00' }, break2: { start: '16:45', end: '18:45' } },'10:00-16:30': { break1: { start: '11:45', end: '12:45' }, break2: { start: '15:00', end: '16:30' } },'10:00-17:00': { break1: { start: '11:45', end: '12:45' }, break2: { start: '15:00', end: '16:30' } },'10:00-19:00': { break1: { start: '11:45', end: '12:45' }, break2: { start: '17:00', end: '18:30' } },'10:00-20:00': { break1: { start: '11:45', end: '12:45' }, break2: { start: '18:00', end: '19:00' } },'11:00-20:00': { break1: { start: '12:45', end: '13:45' }, break2: { start: '17:30', end: '19:00' } },'12:00-18:30': { break1: { start: '16:30', end: '16:45' }, break2: { start: '16:30', end: '18:00' } },'12:00-20:00': { break1: { start: '13:45', end: '14:45' }, break2: { start: '18:00', end: '19:15' } },'12:00-22:00': { break1: { start: '13:45', end: '14:45' }, break2: { start: '19:00', end: '21:00' } },'13:00-22:00': { break1: { start: '14:45', end: '15:30' }, break2: { start: '19:00', end: '21:00' } },'14:00-00:00': { break1: { start: '19:00', end: '20:00' }, break2: { start: '21:00', end: '22:00' } },'15:00-00:00': { break1: { start: '20:00', end: '21:00' }, break2: { start: '22:00', end: '23:00' } },'16:00-00:00': { break1: { start: '20:00', end: '21:00' }, break2: { start: '22:30', end: '23:00' } },'17:30-00:00': { break1: { start: '21:00', end: '22:00' }, break2: { start: '22:30', end: '23:30' } },'18:00-00:00': { break1: { start: '20:00', end: '21:30' }, break2: { start: '22:00', end: '23:00' } },'19:00-00:00': { break1: { start: '21:00', end: '22:00' }, break2: { start: '22:00', end: '23:30' } },'20:00-00:00': { break1: { start: '21:45', end: '22:15' }, break2: { start: '23:00', end: '23:30' } }, '14:00-22:00': { break1: { start: '19:00', end: '20:00' }, break2: { start: '21:00', end: '22:00' } }
    };

    const addMinutes = (time, mins) => { 
        if (!time) return ''; 
        const [h, m] = time.split(':').map(Number); 
        const d = new Date(); d.setHours(h, m + mins, 0, 0); 
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; 
    };

    const getCapacityForTime = (time, type) => {
        if (!time) return 99;
        const hour = parseInt(time.split(':')[0], 10);
        if (type === 'colacion') {
            if (hour >= 0 && hour < 7) return CAPACIDADES_COLACION['madrugada'];
            return CAPACIDADES_COLACION[String(hour)] || 99;
        } else {
            if (hour >= 0 && hour < 7) return 1; 
            if (hour >= 21) return 5; 
            return 3; 
        }
    };

    const colTracker = {}, brkTracker = {};
    for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 15) { 
        const t = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; 
        colTracker[t] = 0; brkTracker[t] = 0; 
    }

    const agentesActivos = dayData.filter(a => (a.Estado === 'Activo') && (a.Servicio||'').includes('Masivo'));

    agentesActivos.forEach(agent => {
        const ini = formatTime(agent.Ini), fin = formatTime(agent.FIN);
        const dur = parseInt(agent.Dur_Colac || 0);
        if (!ini || !fin || !dur) return;

        const win = VENTANAS_COLACION[`${ini}-${fin}`] || VENTANAS_COLACION['fallback'];
        let cands = [], curr = win.start;
        
        while(curr < win.end) {
            if (curr < ini) { curr = addMinutes(curr, 15); continue; }
            const mins = parseInt(curr.split(':')[1], 10);
            if (dur === 60 && mins !== 0) { curr = addMinutes(curr, 15); continue; }
            if (dur === 30 && mins !== 0 && mins !== 30) { curr = addMinutes(curr, 15); continue; }

            let endCol = addMinutes(curr, dur);
            if (endCol <= fin || fin==='00:00') {
                let cong = 0, valid = true;
                for(let i=0; i<dur; i+=15) { 
                    const t=addMinutes(curr, i); 
                    cong += colTracker[t]||0; 
                    if((colTracker[t]||0) >= getCapacityForTime(t, 'colacion')) valid=false; 
                }
                cands.push({t:curr, cong, valid});
            }
            curr = addMinutes(curr, 15);
        }
        const best = cands.filter(c=>c.valid).sort((a,b)=>a.cong-b.cong)[0] || cands.sort((a,b)=>a.cong-b.cong)[0];
        
        if (best) {
            agent.colacionAsignada = best.t;
            for(let i=0; i<dur; i+=15) {
                const t = addMinutes(best.t, i);
                if(colTracker[t] !== undefined) colTracker[t]++;
            }
        }
    });

    ['break1', 'break2'].forEach(bkType => {
        agentesActivos.forEach(agent => {
            const ini = formatTime(agent.Ini);
            if(!ini) return;
            const turnoKey = `${ini}-${formatTime(agent.FIN)}`;
            const ventanasTurno = VENTANAS_BREAKS[turnoKey];
            
            if (!ventanasTurno || !ventanasTurno[bkType]) {
                agent[bkType === 'break1' ? 'Break1Str' : 'Break2Str'] = '';
                return;
            }

            const win = ventanasTurno[bkType];
            let mejor = null;
            let cands = [];

            let curr = win.start;
            while(curr < win.end) {
                 if (curr < ini) { curr = addMinutes(curr, 15); continue; }
                 cands.push({ t: curr, cong: brkTracker[curr] || 0 });
                 curr = addMinutes(curr, 15);
            }

            if(cands.length > 0) {
                cands.sort((a,b) => a.cong - b.cong);
                const op = cands[0].t;
                if((brkTracker[op]||0) < getCapacityForTime(op, 'break')) {
                    mejor = op;
                }
            }

            if(mejor) {
                agent[bkType === 'break1' ? 'Break1Str' : 'Break2Str'] = mejor;
                if(brkTracker[mejor] !== undefined) brkTracker[mejor]++;
            } else {
                 agent[bkType === 'break1' ? 'Break1Str' : 'Break2Str'] = '';
            }
        });
    });

    dayData.forEach(original => {
        const processed = agentesActivos.find(a => a === original);
        if(processed && processed.colacionAsignada) {
            const dur = parseInt(processed.Dur_Colac);
            if(dur === 30) { original.Colacion30 = processed.colacionAsignada; original.Colacion60 = 'x'; }
            else if(dur === 60) { original.Colacion60 = processed.colacionAsignada; original.Colacion30 = 'x'; }
        } else {
            original.Colacion30 = 'x'; original.Colacion60 = 'x';
        }
        if(!processed) {
            original.Break1Str = '';
            original.Break2Str = '';
        }
    });

    return dayData;
};

export default function TurnoDiarioManager() {
  const [loading, setLoading] = useState(false);
  const [weeksOptions, setWeeksOptions] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [permanenciaText, setPermanenciaText] = useState('');
  const [conDescansos, setConDescansos] = useState(true);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const initWeeks = async () => {
      try {
        const res = await fetch('/api/turnos?get_dates=true');
        const dates = await res.json();
        
        const weeksMap = new Map();
        dates.forEach(row => {
          if (!row.fecha) return;
          const parts = row.fecha.split('-');
          const d = new Date(parts[0], parts[1] - 1, parts[2]); // Fecha Local
          const monday = getMonday(d);
          const key = formatDateDB(monday);

          if (!weeksMap.has(key)) {
            const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
            const label = `Semana del ${monday.getDate()} al ${sunday.getDate()} de ${monday.toLocaleString('es-ES', {month:'long'})}`;
            weeksMap.set(key, { id: key, label, start: formatDateDB(monday), end: formatDateDB(sunday), mondayDate: monday });
          }
        });

        const sorted = Array.from(weeksMap.values()).sort((a, b) => b.id.localeCompare(a.id));
        setWeeksOptions(sorted);
        if (sorted.length > 0) setSelectedWeekId(sorted[0].id);

      } catch (err) { console.error(err); }
    };
    initWeeks();
  }, []);

  const handleGenerate = async () => {
      if (!selectedWeekId) return alert("Selecciona una semana.");
      setLoading(true);

      try {
          const weekObj = weeksOptions.find(w => w.id === selectedWeekId);
          const res = await fetch(`/api/turnos?start=${weekObj.start}&end=${weekObj.end}`);
          const rawData = await res.json();

          if (!rawData || rawData.length === 0) throw new Error("No hay turnos para la semana seleccionada.");

          const weekData = rawData.map(row => ({
              Nombre: row.nombre,
              Fecha: parseTimeStr(row.fecha, "00:00"), 
              Ini: parseTimeStr(row.fecha, row.ini), // Si row.ini es 'LIBRE' -> Ini será null
              FIN: parseTimeStr(row.fecha, row.fin), // Si row.fin es 'LIBRE' -> FIN será null
              Dur_Colac: row.dur_cola || 0,
              Estado: row.estado,
              Servicio: row.servicio,
              Lugar: String(row.lugar || row.Lugar || '').trim().toUpperCase(),
              Break1Str: '', Break2Str: '', Colacion30: '', Colacion60: ''
          }));

          const workbook = new ExcelJS.Workbook();
          const sheetNames = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
          const jsDays = [1, 2, 3, 4, 5, 6, 0]; 

          let generatedSheets = 0;

          sheetNames.forEach((sheetName, idx) => {
              const targetDay = jsDays[idx];
              // --- CORRECCIÓN FINAL: FILTRO DE "LIBRES" ---
              // Filtramos no solo por día, sino que exigimos que Ini y FIN existan (no sean null).
              // Como parseTimeStr devuelve null si dice 'LIBRE', esto los elimina automáticamente.
              let dayData = weekData.filter(d => 
                  d.Fecha && 
                  d.Fecha.getDay() === targetDay &&
                  d.Ini && 
                  d.FIN
              );
              
              if (dayData.length > 0) {
                  const ws = workbook.addWorksheet(sheetName);
                  createStyledSheet(ws, dayData, dayData[0].Fecha);
                  generatedSheets++;
              }
          });

          if (generatedSheets === 0) throw new Error("No se encontraron turnos válidos con horarios (quizás todos son Libres).");

          const buffer = await workbook.xlsx.writeBuffer();
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          saveAs(blob, `Turno_Diario_${weekObj.id}.xlsx`);
          setNotification({ type: 'success', message: 'Reporte generado correctamente.' });

      } catch (e) {
          console.error(e);
          setNotification({ type: 'error', message: e.message });
      } finally {
          setLoading(false);
          setTimeout(() => setNotification(null), 3000);
      }
  };

  const createStyledSheet = (worksheet, dayData, fechaDia) => {
      if (conDescansos) {
          dayData = asignarDescansosSegunPlan(dayData);
      } else {
        dayData.forEach(agent => {
            agent.Break1Str = '';
            agent.Break2Str = '';
            const dur = parseInt(agent.Dur_Colac || 0);
            if(dur === 30) { agent.Colacion30 = 30; agent.Colacion60 = 'x'; }
            else if(dur === 60) { agent.Colacion30 = 'x'; agent.Colacion60 = 60; }
            else { agent.Colacion30 = 'x'; agent.Colacion60 = 'x'; }
        });
      }

      worksheet.columns = [ { width: 39.5 }, { width: 10.5 }, { width: 10.5 }, { width: 10.5 }, { width: 10.5 }, { width: 10.5 }, { width: 10.5 }, { width: 10.5 }, { width: 10.5 }, { width: 10.5 }, { width: 10 } ];
      
      let r = 1;
      const r1 = worksheet.getRow(r);
      r1.getCell(1).value = 'FECHA'; r1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3041' } }; r1.getCell(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
      
      const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
      r1.getCell(2).value = fechaDia.toLocaleDateString('es-ES', options).toUpperCase();
      worksheet.mergeCells(r, 2, r, 4);
      
      r1.getCell(5).value = 'Permanencia'; r1.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3041' } }; r1.getCell(5).font = { color: { argb: 'FFFFFFFF' }, bold: true };
      worksheet.mergeCells(r, 5, r, 6);
      r1.getCell(7).value = permanenciaText; r1.getCell(7).font = { bold: true };
      worksheet.mergeCells(r, 7, r, 10);
      r++;

      const renderBlock = (title, color, data, isInactive = false) => {
          if (data.length === 0) return;
          const headRow = worksheet.getRow(r);
          const headers = [title, 'HORA INGRESO', 'FURGON', 'INICIO TURNO', 'Break1', '30 MIN COL', '60 MIN COL', 'Break2', 'TERMINO TURNO', 'HORA SALIDA'];
          
          headers.forEach((h, i) => {
              const c = headRow.getCell(i+1); c.value = h; 
              c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
              c.font = { color: { argb: isInactive ? 'FF000000' : 'FFFFFFFF' }, bold: true, size: 10 };
              c.alignment = { horizontal: 'center', wrapText: true };
              c.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          });
          if (title === 'INACTIVO') worksheet.mergeCells(r, 1, r, 10); 
          r++;

          data.sort((a,b) => (a.Ini?.getTime()||0) - (b.Ini?.getTime()||0)).forEach(row => {
              const excelRow = worksheet.getRow(r);
              excelRow.getCell(1).value = row.Nombre;
              excelRow.getCell(4).value = formatTime(row.Ini);
              
              if (isInactive) {
                  excelRow.getCell(5).value = ''; 
                  excelRow.getCell(6).value = 'X';
                  excelRow.getCell(7).value = 'X';
                  excelRow.getCell(8).value = '';
              } else {
                  excelRow.getCell(5).value = row.Break1Str;
                  excelRow.getCell(6).value = row.Colacion30;
                  excelRow.getCell(7).value = row.Colacion60;
                  excelRow.getCell(8).value = row.Break2Str;
              }
              
              excelRow.getCell(9).value = formatTime(row.FIN);
              
              for(let i=1; i<=10; i++) {
                  excelRow.getCell(i).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                  if(i>1) excelRow.getCell(i).alignment = { horizontal: 'center' };
              }
              r++;
          });
      };

      // --- FILTRADO CORREGIDO PARA EXCEL ---
      
      const sups = dayData.filter(d => (d.Servicio||'').includes('Staff') && d.Estado === 'Activo');
      renderBlock('SUPERVISOR / ANALISTA', 'FF104862', sups);

      const site = dayData.filter(d => (d.Servicio||'').includes('Masivo') && d.Estado === 'Activo' && d.Lugar !== 'TT');
      renderBlock('AGENTE MASIVO', 'FF1F5A87', site);

      const tt = dayData.filter(d => (d.Servicio||'').includes('Masivo') && d.Estado === 'Activo' && d.Lugar === 'TT');
      
      if (tt.length > 0) {
          const ttHead = worksheet.getRow(r);
          worksheet.mergeCells(r, 1, r, 10);
          ttHead.getCell(1).value = 'TELETRABAJO';
          ttHead.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
          ttHead.getCell(1).font = { color: { argb: 'FFFFFFFF' }, bold: true, alignment: { horizontal: 'center' } };
          r++;
          renderBlock('TELETRABAJO', 'FF1F5A87', tt);
      }

      const inactivos = dayData.filter(d => d.Estado !== 'Activo');
      if (inactivos.length > 0) {
          renderBlock('INACTIVO', 'FFFFFF00', inactivos, true);
      }

      const nightShifts = dayData.filter(d => d.Ini && d.Ini.getHours() === 0 && d.Ini.getMinutes() === 0);
      if (nightShifts.length > 0) {
          r = 2; 
          
          const titleCell = worksheet.getRow(1).getCell(12);
          titleCell.value = `Turno de madrugada ${formatDate(fechaDia)}`;
          titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5A87' } };
          titleCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
          worksheet.mergeCells(1, 12, 1, 16);

          const subHead = worksheet.getRow(2);
          ['Nombre', 'Break 1', 'Colación 30', 'Colación 60', 'Break 2'].forEach((h, i) => {
              const c = subHead.getCell(12 + i);
              c.value = h;
              c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5A87' } };
              c.font = { color: { argb: 'FFFFFFFF' }, bold: true };
              c.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          });
          r++;

          nightShifts.forEach(row => {
              const excelRow = worksheet.getRow(r);
              excelRow.getCell(12).value = row.Nombre;
              excelRow.getCell(13).value = row.Break1Str;
              excelRow.getCell(14).value = row.Colacion30 || 'X';
              excelRow.getCell(15).value = row.Colacion60 || 'X';
              excelRow.getCell(16).value = row.Break2Str;
              for(let i=0; i<5; i++) excelRow.getCell(12+i).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
              r++;
          });
          
          [35, 10, 10, 10, 10].forEach((w, i) => worksheet.getColumn(12+i).width = w);
      }
  };

  return (
    <div className="section-container">
      {notification && (
        <div style={{
          position: 'fixed', bottom: '30px', right: '30px', 
          background: notification.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: notification.type === 'error' ? '#991b1b' : '#166534',
          padding: '12px 24px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', 
          display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '600', zIndex: 1000
        }}>
          {notification.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle size={20}/>}
          {notification.message}
        </div>
      )}

      <div className="top-bar" style={{justifyContent: 'space-between', marginBottom: '20px'}}>
        <h1 style={{margin:0, fontSize:'1.5rem', fontWeight:'700', color:'#0f172a', display:'flex', alignItems:'center', gap:'10px'}}>
            <FileSpreadsheet color="#3b82f6" /> Generador de Turno Diario
        </h1>
      </div>

      <div className="table-card" style={{padding:'30px', maxWidth:'800px', margin:'0 auto'}}>
          <h3 style={{marginTop:0, marginBottom:'20px', color:'#334155'}}>Configuración de Reporte</h3>
          
          <div style={{marginBottom:'20px'}}>
              <label className="control-label">1. Semana a Procesar</label>
              <div style={{position:'relative'}}>
                  <Calendar size={18} style={{position:'absolute', left:'12px', top:'12px', color:'#64748b'}}/>
                  <select className="input-modern" style={{width:'100%', paddingLeft:'38px'}} value={selectedWeekId} onChange={e=>setSelectedWeekId(e.target.value)}>
                      {weeksOptions.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                  </select>
              </div>
          </div>

          <div style={{display:'flex', gap:'20px', marginBottom:'20px'}}>
              <div style={{flex:1}}>
                  <label className="control-label">2. Texto Permanencia</label>
                  <input className="input-modern" style={{width:'100%'}} placeholder="nombres" value={permanenciaText} onChange={e=>setPermanenciaText(e.target.value)}/>
              </div>
              <div style={{flex:1}}>
                  <label className="control-label">3. Modo</label>
                  <div style={{display:'flex', gap:'15px', marginTop:'8px'}}>
                      <label style={{display:'flex', alignItems:'center', gap:'5px', cursor:'pointer'}}>
                          <input type="radio" checked={conDescansos} onChange={()=>setConDescansos(true)}/> con descansos
                      </label>
                      <label style={{display:'flex', alignItems:'center', gap:'5px', cursor:'pointer'}}>
                          <input type="radio" checked={!conDescansos} onChange={()=>setConDescansos(false)}/> sin descansos
                      </label>
                  </div>
              </div>
          </div>

          <button 
              className="btn btn-primary" 
              style={{width:'100%', height:'50px', fontSize:'1rem', justifyContent:'center'}}
              onClick={handleGenerate}
              disabled={loading}
          >
              {loading ? <Loader2 className="spin"/> : <><Download size={20}/> Generar Excel Diario</>}
          </button>
      </div>
      <style>{` .spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } } `}</style>
    </div>
  );
}
