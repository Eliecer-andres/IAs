import React, { useState, useMemo, useEffect } from 'react';
import ExcelJS from 'exceljs'; 
import { 
  Search, Plus, MapPin, Phone, User, 
  CheckSquare, List, Calendar, Send, CheckCircle, AlertCircle, BookOpen, Loader2, FileDown, Settings, Users, MousePointerClick, Edit, Trash2, X, Save
} from 'lucide-react';

// --- UTILIDADES DE FECHA SEGURAS ---

const normalizeString = (str) => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const cleanRut = (rut) => {
    if (!rut) return "";
    return rut.toString().replace(/[\.\-]/g, "").trim().toLowerCase();
}

// FIX: Usar fecha local para evitar desfases por zona horaria (UTC vs Local)
const formatDateDB = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// FIX: Obtener el Lunes de una fecha dada (Hora 00:00:00)
const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

// Semanas estáticas solo para el formulario de solicitud (Agentes)
const getSmartFormWeeks = () => {
    const weeks = [];
    const now = new Date();
    const currentDay = now.getDay(); 
    const currentHour = now.getHours();

    const diffToNextMonday = (currentDay === 0 ? 1 : 8 - currentDay);
    let targetMonday = new Date(now);
    targetMonday.setDate(now.getDate() + diffToNextMonday);
    targetMonday.setHours(0,0,0,0); 

    const isLate = (currentDay === 5 && currentHour >= 16) || currentDay === 6 || currentDay === 0;

    if (isLate) {
        targetMonday.setDate(targetMonday.getDate() + 7);
    }

    for (let i = 0; i < 4; i++) {
        const monday = new Date(targetMonday);
        monday.setDate(targetMonday.getDate() + (i * 7));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        const d1 = String(monday.getDate()).padStart(2,'0');
        const d2 = String(sunday.getDate()).padStart(2,'0');
        const monthName = months[sunday.getMonth()];

        const label = `Semana del ${d1} al ${d2} de ${monthName}`;

        weeks.push({
            id: formatDateDB(monday), 
            label: label,
            mondayDate: monday
        });
    }
    return weeks;
};

// --- COMPONENTE PRINCIPAL ---

export default function TransporteManager({ currentUser }) {
  const isAgent = currentUser?.rol !== 'admin' && currentUser?.rol !== 'supervisor';

  const [activeTab, setActiveTab] = useState(isAgent ? 'formulario' : 'confirmacion'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [searchGestion, setSearchGestion] = useState('');
  
  const [addressBook, setAddressBook] = useState([]);
  const [confirmations, setConfirmations] = useState([]); 
  
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [loadingConf, setLoadingConf] = useState(false);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [sending, setSending] = useState(false);

  const [reportWeeks, setReportWeeks] = useState([]); 
  const [formWeeks, setFormWeeks] = useState([]);     
  
  const [formSemana, setFormSemana] = useState('');
  const [formDias, setFormDias] = useState({
    lunes: false, martes: false, miercoles: false, jueves: false, viernes: false, sabado: false, domingo: false
  });
  
  const [reportWeekId, setReportWeekId] = useState('');
  const [processedTransport, setProcessedTransport] = useState({ confirmed: [], unconfirmed: [] });
  const [groupedData, setGroupedData] = useState({ confirmed: [], unconfirmed: [] });
  
  const [feriados, setFeriados] = useState({}); 
  const [showFeriadosModal, setShowFeriadosModal] = useState(false);
  
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null); 
  const [addressForm, setAddressForm] = useState({ rut: '', nombre: '', direccion: '', fono: '', correo: '' });

  const [notification, setNotification] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false); 

  // --- EFECTOS ---

  useEffect(() => {
    // Inicializar semanas del formulario (Lógica inteligente para agentes)
    const smartWeeks = getSmartFormWeeks();
    setFormWeeks(smartWeeks);
    if (smartWeeks.length > 0) setFormSemana(smartWeeks[0].id);
    
    // Cargar semanas disponibles en BD para gestión (Supervisores)
    if (!isAgent) {
        fetchAvailableWeeks();
    } else {
        // Si es agente, usamos las smart weeks para reportes simples si fuera necesario
        setReportWeeks(smartWeeks);
        setReportWeekId(smartWeeks[0]?.id || '');
    }
    
    fetchAddresses();
    fetchConfirmations();
  }, [isAgent]);

  useEffect(() => {
    if (!isAgent && activeTab === 'confirmacion' && reportWeekId && addressBook.length > 0) {
        generatePreviewData();
    }
  }, [reportWeekId, addressBook, confirmations, feriados, activeTab]);

  // --- NUEVA FUNCIÓN: Cargar semanas reales desde la BD ---
  const fetchAvailableWeeks = async () => {
      try {
          const res = await fetch('/api/turnos?get_dates=true');
          const dates = await res.json();
          
          const weeksMap = new Map();
          
          dates.forEach(d => {
              if(!d.fecha) return;
              // Parseo seguro de fecha local (YYYY-MM-DD)
              const parts = d.fecha.split('-');
              const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
              
              const monday = getMonday(dateObj);
              const key = formatDateDB(monday);
              
              if (!weeksMap.has(key)) {
                  const sunday = new Date(monday);
                  sunday.setDate(monday.getDate() + 6);
                  
                  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
                  const d1 = String(monday.getDate()).padStart(2,'0');
                  const d2 = String(sunday.getDate()).padStart(2,'0');
                  const monthName = months[sunday.getMonth()];
                  
                  const label = `Semana del ${d1} al ${d2} de ${monthName} ${sunday.getFullYear()}`;
                  
                  weeksMap.set(key, { 
                      id: key, 
                      label, 
                      mondayDate: monday, 
                      sundayDate: sunday 
                  });
              }
          });

          // Ordenar descendente (más reciente primero)
          const sortedWeeks = Array.from(weeksMap.values()).sort((a,b) => b.id.localeCompare(a.id));
          setReportWeeks(sortedWeeks);

          // LÓGICA DE SELECCIÓN POR DEFECTO
          if (sortedWeeks.length > 0) {
              // Calculamos cuál es el "Lunes Siguiente" (lógica de negocio actual)
              const today = new Date();
              const currentDay = today.getDay(); 
              const diffToNextMonday = (currentDay === 0 ? 1 : 8 - currentDay); 
              const nextMondayDate = new Date(today);
              nextMondayDate.setDate(today.getDate() + diffToNextMonday);
              const nextMondayStr = formatDateDB(nextMondayDate);

              // Buscamos si esa semana existe en la BD
              const targetWeek = sortedWeeks.find(w => w.id === nextMondayStr);

              if (targetWeek) {
                  setReportWeekId(targetWeek.id);
              } else {
                  // Si no existe (no se han cargado turnos aún), seleccionamos la más reciente disponible
                  setReportWeekId(sortedWeeks[0].id);
              }
          }

      } catch (error) {
          console.error("Error obteniendo semanas:", error);
      }
  };

  const fetchAddresses = async () => {
    setLoadingAddress(true);
    try {
        const res = await fetch('/api/transporte');
        if (res.ok) setAddressBook(await res.json());
    } catch (e) { console.error(e); } 
    finally { setLoadingAddress(false); }
  };

  const fetchConfirmations = async () => {
    setLoadingConf(true);
    try {
        const res = await fetch('/api/confirmaciones');
        if (res.ok) setConfirmations(await res.json());
    } catch (e) { console.error("Error cargando confirmaciones", e); }
    finally { setLoadingConf(false); }
  };

  const fetchTurnosForWeek = async (start, end) => {
      try {
          const res = await fetch(`/api/turnos?start=${start}&end=${end}`);
          if (res.ok) return await res.json();
          return [];
      } catch (e) {
          console.error("Error fetching turnos", e);
          return [];
      }
  };

  const myAddressInfo = useMemo(() => {
      if (!currentUser || !addressBook.length) return null;
      const userRutLimpio = cleanRut(currentUser.rut);
      return addressBook.find(addr => cleanRut(addr.rut) === userRutLimpio);
  }, [currentUser, addressBook]);

  const handleManualConfirm = async (personaRow) => {
    if (isAgent) return; 

    const confirmMsg = `¿Deseas confirmar manualmente a ${personaRow.nombre} para toda la semana?`;
    if (!window.confirm(confirmMsg)) return;

    try {
        const payload = {
            semana: reportWeekId,
            rut: personaRow.rut,
            nombre: personaRow.nombre,
            lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: true, domingo: true
        };

        const res = await fetch('/api/confirmaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            setNotification({ type: 'success', message: `Confirmado manualmente: ${personaRow.nombre}` });
            await fetchConfirmations(); 
            setTimeout(() => setNotification(null), 2000);
        } else {
            throw new Error("Error al guardar");
        }
    } catch (error) {
        setNotification({ type: 'error', message: 'Error al confirmar manualmente.' });
    }
  };

  const openAddressModal = (address = null) => {
      if (address) {
          setEditingAddress(address);
          setAddressForm({ ...address }); 
      } else {
          setEditingAddress(null);
          setAddressForm({ rut: '', nombre: '', direccion: '', fono: '', correo: '' });
      }
      setShowAddressModal(true);
  };

  const handleSaveAddress = async () => {
      setSavingAddress(true);
      try {
          let url = '/api/transporte';
          let method = 'POST';
          let body = addressForm;

          if (editingAddress) {
              method = 'PUT';
              body = { id: editingAddress.id, ...addressForm };
          }

          const res = await fetch(url, {
              method: method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });

          if (res.ok) {
              setNotification({ type: 'success', message: editingAddress ? 'Dirección actualizada' : 'Dirección creada/actualizada' });
              setShowAddressModal(false);
              await fetchAddresses(); 
          } else {
              const errData = await res.json();
              throw new Error(errData.message || 'Error en el servidor');
          }
      } catch (error) {
          console.error("Error guardando:", error);
          setNotification({ type: 'error', message: 'Error: ' + error.message });
      } finally {
          setSavingAddress(false);
          setTimeout(() => setNotification(null), 3000);
      }
  };

  const handleDeleteAddress = async () => {
      if (!editingAddress || !editingAddress.id) return;
      if (!window.confirm(`¿Seguro que deseas eliminar la dirección de ${editingAddress.nombre}?`)) return;
      
      setSavingAddress(true);
      try {
          const res = await fetch(`/api/transporte?id=${editingAddress.id}`, {
              method: 'DELETE'
          });

          if (res.ok) {
              setNotification({ type: 'success', message: 'Dirección eliminada correctamente' });
              setShowAddressModal(false);
              await fetchAddresses(); 
          } else {
              const errData = await res.json();
              throw new Error(errData.message || 'Error al eliminar');
          }
      } catch (error) {
          console.error("Error eliminando:", error);
          setNotification({ type: 'error', message: 'Error: ' + error.message });
      } finally {
          setSavingAddress(false);
          setTimeout(() => setNotification(null), 3000);
      }
  };

  const generatePreviewData = async () => {
      setLoadingReporte(true);
      try {
          const weekObj = reportWeeks.find(w => w.id === reportWeekId);
          if (!weekObj) return;

          const turnos = await fetchTurnosForWeek(formatDateDB(weekObj.mondayDate), formatDateDB(weekObj.sundayDate));
          const transportList = [];
          
          turnos.forEach(row => {
              const estado = (row.estado || row.Estado || '').toLowerCase();
              const lugar = (row.lugar || row.Lugar || '').toLowerCase();
              
              if (estado !== 'activo' || lugar === 'tt' || !row.fecha) return;

              // Parseo seguro de fecha local
              const parts = row.fecha.split('-');
              const fechaObj = new Date(parts[0], parts[1] - 1, parts[2]);
              const fechaStr = row.fecha; // Ya viene YYYY-MM-DD del backend

              const diaSemana = fechaObj.getDay(); 
              const isWeekend = diaSemana === 0 || diaSemana === 6;
              const isHoliday = !!feriados[fechaStr];

              const rutLimpio = cleanRut(row.rut);
              const personaInfo = addressBook.find(a => cleanRut(a.rut) === rutLimpio) || {};
              const nombre = row.nombre || row.Nombre;

              const ini = row.ini || row.Ini;
              const fin = row.fin || row.Fin || row.FIN;
              
              const baseItem = {
                  fechaRaw: fechaStr,
                  fecha: fechaObj, 
                  fechaStr: fechaObj.toLocaleDateString('es-CL', {day:'2-digit', month:'2-digit', year:'numeric'}), 
                  rut: row.rut,
                  nombre: nombre,
                  direccion: personaInfo.direccion || 'Sin dirección registrada',
                  fono: personaInfo.fono || '',
                  servicio: 'Saesa'
              };

              let horaArribo = null;
              if (ini) {
                  const iniH = parseInt(ini.split(':')[0], 10);
                  if (iniH === 0) horaArribo = '00:00';
                  else if (iniH === 7 && !isWeekend && !isHoliday) horaArribo = '07:00';
                  else if (iniH === 8 && (isWeekend || isHoliday)) horaArribo = '08:00';
              }
              if (horaArribo) transportList.push({ ...baseItem, sentido: 'Arribo', hora: horaArribo });

              let horaZarpe = null;
              if (fin) {
                  const finH = parseInt(fin.split(':')[0], 10);
                  if (finH === 22) horaZarpe = '22:00';
                  else if (finH === 0 || finH === 24) horaZarpe = '00:00';
              }
              if (horaZarpe) transportList.push({ ...baseItem, sentido: 'Zarpe', hora: horaZarpe });
          });

          const confirmed = [];
          const unconfirmed = [];

          transportList.forEach(item => {
              const conf = confirmations.find(c => c.semana === reportWeekId && cleanRut(c.rut) === cleanRut(item.rut));
              let isConfirmed = false;
              let motivo = 'No Confirmado';

              if (conf) {
                  const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
                  const dayName = days[item.fecha.getDay()];
                  if (conf[dayName]) {
                      isConfirmed = true;
                      motivo = 'Confirmado';
                  }
              }
              const finalItem = { ...item, confirmacion: motivo };
              if (isConfirmed) confirmed.push(finalItem);
              else unconfirmed.push(finalItem);
          });

          const orderLogic = { 'Arribo-00:00': 1, 'Arribo-07:00': 2, 'Arribo-08:00': 3, 'Zarpe-22:00': 4, 'Zarpe-00:00': 5 };
          const sortFn = (a, b) => {
              if (a.fechaRaw !== b.fechaRaw) return a.fechaRaw.localeCompare(b.fechaRaw);
              const orderA = orderLogic[`${a.sentido}-${a.hora}`] || 99;
              const orderB = orderLogic[`${b.sentido}-${b.hora}`] || 99;
              if (orderA !== orderB) return orderA - orderB;
              return a.nombre.localeCompare(b.nombre);
          };

          const sortedConfirmed = confirmed.sort(sortFn);
          const sortedUnconfirmed = unconfirmed.sort(sortFn);

          setProcessedTransport({ confirmed: sortedConfirmed, unconfirmed: sortedUnconfirmed });

          const groupData = (list) => {
            const map = {};
            list.forEach(item => {
                const key = cleanRut(item.rut);
                if (!map[key]) {
                    map[key] = { rut: item.rut, nombre: item.nombre, direccion: item.direccion, count: 0 };
                }
                map[key].count++;
            });
            return Object.values(map).sort((a,b) => a.nombre.localeCompare(b.nombre));
          };

          setGroupedData({ confirmed: groupData(sortedConfirmed), unconfirmed: groupData(sortedUnconfirmed) });
      } catch (err) { console.error("Error generando reporte preview:", err); } 
      finally { setLoadingReporte(false); }
  };

  const filteredGroupedData = useMemo(() => {
      if (!searchGestion) return groupedData;
      const q = normalizeString(searchGestion); 
      return {
          confirmed: groupedData.confirmed.filter(p => normalizeString(p.nombre).includes(q)),
          unconfirmed: groupedData.unconfirmed.filter(p => normalizeString(p.nombre).includes(q))
      };
  }, [groupedData, searchGestion]);

  const handleDownloadExcel = async () => {
      if (processedTransport.confirmed.length === 0 && processedTransport.unconfirmed.length === 0) {
          setNotification({ type: 'error', message: 'No hay datos para generar.' });
          setTimeout(() => setNotification(null), 3000);
          return;
      }

      const workbook = new ExcelJS.Workbook();
      const columns = [ 
          { header: 'Transporte', key: 'transporteId', width: 12 }, 
          { header: 'Sentido del viaje', key: 'sentido', width: 20 }, 
          { header: 'Fecha', key: 'fechaStr', width: 15 }, 
          { header: 'Hora', key: 'hora', width: 15 }, 
          { header: 'Servicio', key: 'servicio', width: 15 }, 
          { header: 'RUT', key: 'rut', width: 15 }, 
          { header: 'Nombre', key: 'nombre', width: 40 }, 
          { header: 'Direcciones', key: 'direccion', width: 50 }, 
          { header: 'Fono', key: 'fono', width: 15 }, 
          { header: 'Confirmacion', key: 'confirmacion', width: 25 } 
      ];
      const styleHeaderRow = (row) => row.eachCell(cell => { 
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5A87' } }; 
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }; 
          cell.alignment = { vertical: 'middle', horizontal: 'center' }; 
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; 
      });

      const weekObj = reportWeeks.find(w => w.id === reportWeekId);
      const sheetName = weekObj ? weekObj.label.replace('Semana', 'semana') : 'Confirmados';
      // Limitar nombre de hoja a 31 caracteres (límite Excel)
      const cleanSheetName = sheetName.substring(0, 31).replace(/[\\/?*\[\]]/g, '');

      if (processedTransport.confirmed.length > 0) {
        const worksheet = workbook.addWorksheet(cleanSheetName || 'Confirmados');
        worksheet.columns = columns; 
        styleHeaderRow(worksheet.getRow(1));
        let transportCounter = 1;
        let currentDay = null;

        processedTransport.confirmed.forEach(item => {
            if (currentDay && currentDay !== item.fechaRaw) { 
                styleHeaderRow(worksheet.addRow(worksheet.columns.map(c => c.header))); 
                transportCounter = 1; 
            }
            currentDay = item.fechaRaw;
            const row = worksheet.addRow({ transporteId: transportCounter++, ...item });
            const colors = { 'Arribo-00:00': 'FFFBE2D5', 'Arribo-07:00': 'FFF2CEEF', 'Arribo-08:00': 'FFF2CEEF', 'Zarpe-22:00': 'FFDAE9F8', 'Zarpe-00:00': 'FFDAF2D0' };
            const rowColor = colors[`${item.sentido}-${item.hora}`];
            if (rowColor) row.eachCell({ includeEmpty: true }, c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } });
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => { 
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; 
                if (['transporteId', 'sentido', 'fechaStr', 'hora', 'servicio', 'confirmacion'].includes(worksheet.columns[colNumber - 1].key)) {
                    cell.alignment = { horizontal: 'center' }; 
                }
            });
        });
        worksheet.eachRow((row, rowNumber) => { 
            if (rowNumber > 1 && row.getCell(1).value) row.getCell(10).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Confirmado,No Confirmado"'] }; 
        });
      }

      if (processedTransport.unconfirmed.length > 0) {
          const unconfirmedSheet = workbook.addWorksheet('No Confirmados');
          unconfirmedSheet.columns = columns; 
          styleHeaderRow(unconfirmedSheet.getRow(1));
          let unconfirmedCounter = 1; 
          let unconfirmedCurrentDay = null;
          const uniqueUnconfirmedNames = [...new Set(processedTransport.unconfirmed.map(item => item.nombre))].sort();

          processedTransport.unconfirmed.forEach(item => {
              if (unconfirmedCurrentDay && unconfirmedCurrentDay !== item.fechaRaw) { 
                  styleHeaderRow(unconfirmedSheet.addRow(columns.map(c => c.header))); 
                  unconfirmedCounter = 1; 
              }
              unconfirmedCurrentDay = item.fechaRaw;
              const row = unconfirmedSheet.addRow({ transporteId: unconfirmedCounter++, ...item });
              const colors = { 'Arribo-00:00': 'FFFBE2D5', 'Arribo-07:00': 'FFF2CEEF', 'Arribo-08:00': 'FFF2CEEF', 'Zarpe-22:00': 'FFDAE9F8', 'Zarpe-00:00': 'FFDAF2D0' };
              const rowColor = colors[`${item.sentido}-${item.hora}`];
              if (rowColor) row.eachCell({ includeEmpty: true }, c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } });
              row.eachCell({ includeEmpty: true }, (cell, colNumber) => { 
                  cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; 
                  if (['transporteId', 'sentido', 'fechaStr', 'hora', 'servicio', 'confirmacion'].includes(unconfirmedSheet.columns[colNumber - 1].key)) {
                      cell.alignment = { horizontal: 'center' }; 
                  }
              });
          });

          const listHeaderCell = unconfirmedSheet.getCell('L1');
          listHeaderCell.value = 'Agentes No confirmados';
          listHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5A87' } }; 
          listHeaderCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
          listHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' }; 
          listHeaderCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          unconfirmedSheet.getColumn('L').width = 40;
          uniqueUnconfirmedNames.forEach((name, index) => { 
              const cell = unconfirmedSheet.getCell(`L${index + 2}`); 
              cell.value = name; 
              cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; 
          });
      }

      const rutsConTurno = new Set([...processedTransport.confirmed, ...processedTransport.unconfirmed].map(i => cleanRut(i.rut)));
      const notFoundList = confirmations.filter(c => c.semana === reportWeekId && !rutsConTurno.has(cleanRut(c.rut))).map(c => ({ rut: c.rut, nombre: c.nombre }));

      if (notFoundList.length > 0) {
          const notFoundSheet = workbook.addWorksheet('Confirmados No Encontrados');
          notFoundSheet.columns = [ { header: 'RUT', key: 'rut', width: 20 }, { header: 'Nombre', key: 'nombre', width: 45 } ];
          styleHeaderRow(notFoundSheet.getRow(1)); 
          notFoundSheet.addRows(notFoundList);
          notFoundSheet.eachRow({ includeHeader: false }, (row, rowNumber) => { 
              if(rowNumber > 1) { row.eachCell(c => c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }); } 
          });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = `Transporte_${reportWeekId}.xlsx`;
      document.body.appendChild(a); 
      a.click(); 
      document.body.removeChild(a); 
      URL.revokeObjectURL(url);
  };

  const handleFormSubmit = async () => {
    const hasDays = Object.values(formDias).some(val => val);
    if (!hasDays) {
      setNotification({ type: 'error', message: 'Selecciona al menos un día.' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setSending(true);
    try {
        const payload = {
            semana: formSemana,
            rut: currentUser.rut,
            nombre: currentUser.nombre,
            ...formDias
        };

        const res = await fetch('/api/confirmaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            setNotification({ type: 'success', message: 'Solicitud enviada correctamente.' });
            setFormDias({ lunes: false, martes: false, miercoles: false, jueves: false, viernes: false, sabado: false, domingo: false });
            await fetchConfirmations(); 
            setTimeout(() => {
                setNotification(null);
                if (isAgent) setActiveTab('confirmacion'); 
            }, 1500);
        } else {
            throw new Error("Error al guardar");
        }
    } catch (error) {
        setNotification({ type: 'error', message: 'Error de conexión.' });
    } finally {
        setSending(false);
    }
  };

  const filteredAddresses = useMemo(() => {
    if (!searchTerm) return addressBook;
    const busqueda = normalizeString(searchTerm);
    return addressBook.filter(item => 
      normalizeString(item.nombre || '').includes(busqueda) || 
      normalizeString(item.rut || '').includes(busqueda)
    );
  }, [addressBook, searchTerm]);

  const tabs = isAgent ? [
      { id: 'formulario', label: 'Solicitar Transporte', icon: Calendar, highlight: true },
      { id: 'confirmacion', label: 'Mis Solicitudes', icon: CheckSquare }
  ] : [
      { id: 'confirmacion', label: 'Gestión Transporte', icon: CheckSquare }, 
      { id: 'direcciones', label: 'Direcciones', icon: BookOpen },
      { id: 'formulario', label: 'Solicitud Manual', icon: Calendar }
  ];

  return (
    <div className="section-container" style={{overflowX: 'hidden'}}> 
      {notification && (
        <div style={{
          position: 'fixed', bottom: '30px', right: '30px', zIndex: 1000,
          background: notification.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: notification.type === 'success' ? '#166534' : '#991b1b',
          padding: '12px 24px', borderRadius: '8px', fontWeight: '600',
          display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {notification.message}
        </div>
      )}

      <div style={{marginBottom: '24px'}}>
        <h1 style={{margin:'0 0 16px 0', fontSize:'1.8rem', fontWeight:'700', color:'#0f172a'}}>
            {isAgent ? 'Mi Transporte' : 'Gestión de Transporte'}
        </h1>
        
        <div style={{display:'flex', gap:'4px', borderBottom:'2px solid #e2e8f0', overflowX: 'auto'}}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px',
                background: activeTab === tab.id ? '#fff' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                marginBottom: '-2px',
                color: activeTab === tab.id ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === tab.id ? '600' : '500',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                backgroundColor: tab.highlight && activeTab === tab.id ? '#eff6ff' : 'transparent'
              }}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'formulario' && (
        <div style={{maxWidth: '800px', margin: '0 auto', width: '100%'}}>
           <div style={{background: '#fff', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0'}}>
              <div style={{display:'flex', alignItems:'center', gap:'16px', marginBottom:'24px', paddingBottom:'24px', borderBottom:'1px solid #f1f5f9', flexWrap: 'wrap'}}>
                  <div style={{width:'50px', height:'50px', borderRadius:'50%', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', color:'#2563eb'}}>
                      <User size={24} />
                  </div>
                  <div>
                      <h2 style={{margin:0, fontSize:'1.2rem', color:'#1e293b'}}>Hola, {currentUser.nombre}</h2>
                      {myAddressInfo ? (
                          <p style={{margin:0, color:'#16a34a', fontSize:'0.9rem', display:'flex', alignItems:'center', gap:'4px', flexWrap: 'wrap'}}>
                              <MapPin size={14}/> Dirección: <strong>{myAddressInfo.direccion}</strong>
                          </p>
                      ) : (
                          <p style={{margin:0, color:'#ca8a04', fontSize:'0.9rem', display:'flex', alignItems:'center', gap:'4px', flexWrap: 'wrap'}}>
                              <AlertCircle size={14}/> No tienes dirección registrada. Contacta a un supervisor.
                          </p>
                      )}
                  </div>
              </div>

              <div style={{marginBottom: '24px'}}>
                  <label className="control-label" style={{display:'block', marginBottom:'8px'}}>¿Para qué semana necesitas transporte?</label>
                  <div style={{position:'relative'}}>
                      <Calendar size={18} style={{position:'absolute', left:'14px', top:'14px', color:'#64748b'}} />
                      <select 
                        className="input-modern" 
                        value={formSemana} 
                        onChange={(e) => setFormSemana(e.target.value)}
                        style={{width:'100%', paddingLeft:'40px', fontSize:'1rem'}}
                      >
                          {formWeeks.map(w => (
                              <option key={w.id} value={w.id}>{w.label}</option>
                          ))}
                      </select>
                  </div>
                  <p style={{marginTop:'8px', fontSize:'0.8rem', color:'#64748b'}}>
                     * Las solicitudes para la próxima semana se cierran los viernes a las 16:00 hrs.
                  </p>
              </div>

              <div style={{marginBottom: '32px'}}>
                  <label className="control-label" style={{display:'block', marginBottom:'12px'}}>Selecciona los días</label>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(100px, 1fr))', gap:'12px'}}>
                      {['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'].map(dia => {
                          const key = normalizeString(dia);
                          return (
                              <label key={key} style={{
                                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                                  padding:'16px', borderRadius:'12px', cursor:'pointer',
                                  border: formDias[key] ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                                  background: formDias[key] ? '#eff6ff' : '#fff',
                                  transition: 'all 0.2s'
                              }}>
                                  <input 
                                    type="checkbox" 
                                    checked={formDias[key]} 
                                    onChange={(e) => setFormDias({...formDias, [key]: e.target.checked})}
                                    style={{marginBottom:'8px', width:'18px', height:'18px', accentColor:'#2563eb'}}
                                  />
                                  <span style={{fontWeight:'600', color: formDias[key] ? '#1e293b' : '#64748b'}}>{dia}</span>
                              </label>
                          )
                      })}
                  </div>
              </div>

              <div style={{display:'flex', justifyContent:'flex-end'}}>
                  <button onClick={handleFormSubmit} disabled={sending} className="btn btn-primary" style={{padding:'12px 32px', fontSize:'1rem'}}>
                      {sending ? <Loader2 className="spin" size={18}/> : <><Send size={18} style={{marginRight:'8px'}} /> Confirmar Solicitud</>}
                  </button>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'confirmacion' && (
        <>
        {isAgent ? (
             <div className="table-card">
                <div className="top-bar" style={{marginBottom: '0', padding: '16px', borderBottom:'1px solid #e2e8f0'}}>
                   <h3 style={{margin:0, fontSize:'1.1rem', color:'#334155'}}>Historial de Solicitudes</h3>
                </div>
               <div className="table-wrapper">
                 <table className="modern-table">
                   <thead>
                     <tr>
                       <th>Semana</th>
                       <th style={{textAlign:'center', width:'40px'}}>L</th>
                       <th style={{textAlign:'center', width:'40px'}}>M</th>
                       <th style={{textAlign:'center', width:'40px'}}>M</th>
                       <th style={{textAlign:'center', width:'40px'}}>J</th>
                       <th style={{textAlign:'center', width:'40px'}}>V</th>
                       <th style={{textAlign:'center', width:'40px'}}>S</th>
                       <th style={{textAlign:'center', width:'40px'}}>D</th>
                       <th>Estado</th>
                     </tr>
                   </thead>
                   <tbody>
                     {confirmations.filter(c => cleanRut(c.rut) === cleanRut(currentUser.rut)).length === 0 ? (
                         <tr><td colSpan={9} style={{textAlign:'center', padding:'40px', color:'#94a3b8'}}>No has realizado solicitudes aún.</td></tr>
                     ) : (
                         confirmations.filter(c => cleanRut(c.rut) === cleanRut(currentUser.rut)).map((item) => (
                         <tr key={item.id}>
                             <td style={{color:'#64748b', fontSize:'0.9rem'}}>{item.semana}</td>
                             {['lunes','martes','miercoles','jueves','viernes','sabado','domingo'].map(day => (
                                 <td key={day} style={{textAlign:'center'}}>
                                     {item[day] ? <span style={{color:'#166534', fontWeight:'bold'}}>✓</span> : <span style={{color:'#e2e8f0'}}>·</span>}
                                 </td>
                             ))}
                             <td><span className="badge badge-active">Enviada</span></td>
                         </tr>
                         ))
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
        ) : (
            <div style={{display:'flex', flexDirection:'column', gap:'20px', height:'100%'}}>
                <div style={{background:'#fff', padding:'20px', borderRadius:'12px', border:'1px solid #e2e8f0', display:'flex', gap:'20px', alignItems:'end', flexWrap:'wrap'}}>
                    <div style={{flex:1, minWidth:'250px'}}>
                        <label className="control-label" style={{marginBottom:'8px', display:'block'}}>Semana a Gestionar</label>
                        <select className="input-modern" style={{width:'100%'}} value={reportWeekId} onChange={e => setReportWeekId(e.target.value)}>
                            {reportWeeks.length === 0 ? (
                                <option>Cargando semanas...</option>
                            ) : (
                                reportWeeks.map(w => <option key={w.id} value={w.id}>{w.label}</option>)
                            )}
                        </select>
                    </div>
                    
                    <div style={{flex:1, minWidth:'200px'}}>
                        <label className="control-label" style={{marginBottom:'8px', display:'block'}}>Filtrar Personal</label>
                        <div style={{position:'relative'}}>
                            <Search size={16} style={{position:'absolute', left:'12px', top:'12px', color:'#94a3b8'}}/>
                            <input 
                              type="text" 
                              className="input-modern" 
                              placeholder="Buscar por nombre..." 
                              style={{width:'100%', paddingLeft:'36px'}} 
                              value={searchGestion} 
                              onChange={(e) => setSearchGestion(e.target.value)} 
                            />
                        </div>
                    </div>

                    <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                        <button className="btn btn-outline" onClick={() => setShowFeriadosModal(true)}>
                            <Settings size={18}/> <span style={{display: 'none', '@media (min-width: 600px)': { display: 'inline' } }}>Configurar</span> Feriados
                        </button>
                        <button className="btn btn-primary" onClick={handleDownloadExcel} disabled={processedTransport.confirmed.length === 0 && processedTransport.unconfirmed.length === 0}>
                            <FileDown size={18}/> Descargar Excel
                        </button>
                    </div>
                </div>

                <div style={{display:'flex', gap:'20px', flex:1, minHeight:0, flexWrap: 'wrap', overflowY: 'auto'}}>
                    <div className="table-card" style={{flex: '1 1 500px', minHeight: '400px', display:'flex', flexDirection:'column'}}>
                        <div className="top-bar" style={{borderRadius:'0', borderBottom:'1px solid #e2e8f0', marginBottom:0, padding:'12px 16px', background:'#f0fdf4'}}>
                            <h3 style={{margin:0, fontSize:'1rem', color:'#166534', display:'flex', alignItems:'center', gap:'8px'}}>
                                <CheckCircle size={16}/> Confirmados ({filteredGroupedData.confirmed.length})
                            </h3>
                        </div>
                        <div className="table-wrapper" style={{overflowY:'auto', flex:1}}>
                            <table className="modern-table" style={{width:'100%', tableLayout:'fixed', minWidth: 'auto'}}>
                                <thead>
                                    <tr>
                                        <th style={{width:'50%'}}>Nombre</th>
                                        <th style={{width:'30%'}}>RUT</th>
                                        <th style={{textAlign:'center', width:'20%'}}>Viajes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingReporte ? (
                                        <tr><td colSpan={3} style={{textAlign:'center', padding:'20px'}}><Loader2 className="spin"/></td></tr>
                                    ) : filteredGroupedData.confirmed.map((row, i) => (
                                        <tr key={i}>
                                            <td style={{fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={row.nombre}>{row.nombre}</td>
                                            <td style={{fontSize:'0.85rem', color:'#64748b', fontFamily:'monospace'}}>{row.rut}</td>
                                            <td style={{textAlign:'center'}}>
                                                <span className="badge badge-active" style={{fontSize:'0.9rem'}}>{row.count}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="table-card" style={{flex: '1 1 500px', minHeight: '400px', display:'flex', flexDirection:'column'}}>
                        <div className="top-bar" style={{borderRadius:'0', borderBottom:'1px solid #e2e8f0', marginBottom:0, padding:'12px 16px', background:'#fef2f2', justifyContent:'space-between', flexWrap: 'wrap'}}>
                            <h3 style={{margin:0, fontSize:'1rem', color:'#991b1b', display:'flex', alignItems:'center', gap:'8px'}}>
                                <AlertCircle size={16}/> Pendientes ({filteredGroupedData.unconfirmed.length})
                            </h3>
                            <span style={{fontSize:'0.75rem', color:'#991b1b', display:'flex', alignItems:'center', gap:'4px'}}>
                                <MousePointerClick size={12}/> Doble clic para confirmar
                            </span>
                        </div>
                        <div className="table-wrapper" style={{overflowY:'auto', flex:1}}>
                            <table className="modern-table" style={{width:'100%', tableLayout:'fixed', minWidth: 'auto'}}>
                                <thead>
                                    <tr>
                                        <th style={{width:'50%'}}>Nombre</th>
                                        <th style={{width:'30%'}}>RUT</th>
                                        <th style={{textAlign:'center', width:'20%'}}>Pendientes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingReporte ? (
                                        <tr><td colSpan={3} style={{textAlign:'center', padding:'20px'}}><Loader2 className="spin"/></td></tr>
                                    ) : filteredGroupedData.unconfirmed.map((row, i) => (
                                        <tr 
                                            key={i} 
                                            onDoubleClick={() => handleManualConfirm(row)}
                                            style={{cursor:'pointer'}}
                                            title="Doble clic para confirmar manualmente"
                                            className="hover-row"
                                        >
                                            <td style={{fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{row.nombre}</td>
                                            <td style={{fontSize:'0.85rem', color:'#64748b', fontFamily:'monospace'}}>{row.rut}</td>
                                            <td style={{textAlign:'center'}}>
                                                <span className="badge badge-inactive" style={{fontSize:'0.9rem'}}>{row.count}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
      )}

      {activeTab === 'direcciones' && !isAgent && (
        <>
          <div className="top-bar">
            <div className="control-group" style={{flex: 1}}>
              <span className="control-label">Buscar Dirección</span>
              <div style={{position:'relative'}}>
                <Search size={16} style={{position:'absolute', left:'12px', top:'12px', color:'#94a3b8'}}/>
                <input 
                  type="text" className="input-modern" placeholder="Nombre o RUT..." 
                  style={{width:'100%', paddingLeft:'36px'}} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => openAddressModal()}>
                <Plus size={18} /> 
                <span style={{marginLeft:8}}>Crear</span>
            </button>
          </div>
          <div className="table-card">
            <div className="table-wrapper">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>RUT</th>
                    <th>Nombre</th>
                    <th>Dirección</th>
                    <th>Fono</th>
                    <th>Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAddresses.map((item, i) => (
                    <tr 
                        key={i} 
                        onDoubleClick={() => openAddressModal(item)} 
                        className="hover-row" 
                        style={{cursor:'pointer'}}
                        title="Doble clic para editar o eliminar"
                    >
                      <td style={{fontFamily: 'monospace'}}>{item.rut}</td>
                      <td>{item.nombre}</td>
                      <td>{item.direccion}</td>
                      <td>{item.fono}</td>
                      <td>{item.correo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showFeriadosModal && (
          <div className="modal-overlay">
              <div className="modal-content">
                  <h3>Configurar Feriados de la Semana</h3>
                  <p style={{color:'#64748b', fontSize:'0.9rem', marginBottom:'15px'}}>Selecciona qué días de esta semana son feriados para aplicar horario de fin de semana (08:00 AM).</p>
                  <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                      {(() => {
                          const w = reportWeeks.find(week => week.id === reportWeekId);
                          if (!w) return null;
                          const days = [];
                          for(let i=0; i<7; i++) {
                              const d = new Date(w.mondayDate);
                              d.setDate(d.getDate() + i);
                              const fStr = formatDateDB(d);
                              days.push(
                                  <label key={fStr} style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px', background:'#f8fafc', borderRadius:'8px', cursor:'pointer'}}>
                                      <input 
                                        type="checkbox" 
                                        checked={!!feriados[fStr]} 
                                        onChange={e => setFeriados({...feriados, [fStr]: e.target.checked})}
                                        style={{width:'18px', height:'18px'}}
                                      />
                                      <span>{d.toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long'})}</span>
                                  </label>
                              );
                          }
                          return days;
                      })()}
                  </div>
                  <div style={{marginTop:'20px', textAlign:'right'}}>
                      <button className="btn btn-primary" onClick={() => setShowFeriadosModal(false)}>Guardar Configuración</button>
                  </div>
              </div>
          </div>
      )}

      {showAddressModal && (
          <div className="modal-overlay">
              <div className="modal-content" style={{maxWidth:'500px'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                    <h3 style={{margin:0}}>{editingAddress ? 'Editar Dirección' : 'Crear Dirección'}</h3>
                    <button onClick={() => setShowAddressModal(false)} style={{background:'transparent', border:'none', cursor:'pointer'}}><X size={20}/></button>
                  </div>
                  
                  <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
                      <div>
                          <label className="control-label">RUT</label>
                          <input type="text" className="input-modern" style={{width:'100%'}} 
                                 value={addressForm.rut} onChange={e => setAddressForm({...addressForm, rut: e.target.value})} 
                                 disabled={!!editingAddress} 
                          />
                      </div>
                      <div>
                          <label className="control-label">Nombre</label>
                          <input type="text" className="input-modern" style={{width:'100%'}} 
                                 value={addressForm.nombre} onChange={e => setAddressForm({...addressForm, nombre: e.target.value})} />
                      </div>
                      <div>
                          <label className="control-label">Dirección</label>
                          <input type="text" className="input-modern" style={{width:'100%'}} 
                                 value={addressForm.direccion} onChange={e => setAddressForm({...addressForm, direccion: e.target.value})} />
                      </div>
                      <div style={{display:'flex', gap:'10px'}}>
                          <div style={{flex:1}}>
                              <label className="control-label">Teléfono</label>
                              <input type="text" className="input-modern" style={{width:'100%'}} 
                                     value={addressForm.fono} onChange={e => setAddressForm({...addressForm, fono: e.target.value})} />
                          </div>
                          <div style={{flex:1}}>
                              <label className="control-label">Correo</label>
                              <input type="text" className="input-modern" style={{width:'100%'}} 
                                     value={addressForm.correo} onChange={e => setAddressForm({...addressForm, correo: e.target.value})} />
                          </div>
                      </div>
                  </div>

                  <div style={{marginTop:'24px', display:'flex', justifyContent:'space-between'}}>
                      {editingAddress ? (
                          <button onClick={handleDeleteAddress} disabled={savingAddress} style={{background:'#fee2e2', color:'#991b1b', border:'none', padding:'10px 20px', borderRadius:'8px', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px'}}>
                              {savingAddress ? <Loader2 size={18} className="spin"/> : <Trash2 size={18}/>} Eliminar
                          </button>
                      ) : <div></div>}
                      
                      <button className="btn btn-primary" onClick={handleSaveAddress} disabled={savingAddress}>
                          {savingAddress ? <Loader2 size={18} className="spin"/> : <><Save size={18} style={{marginRight:'8px'}}/> Guardar</>}
                      </button>
                  </div>
              </div>
          </div>
      )}

      <style>{` .spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } } .hover-row:hover { background-color: #fef2f2 !important; transition: background 0.2s; } `}</style>
    </div>
  );
}
