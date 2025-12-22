import React, { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { 
  Calendar, Settings, Download, Plus, Search, Trash2, Edit, Save, X, FileSpreadsheet, Loader2
} from 'lucide-react';

// --- UTILIDADES ---
const cleanRut = (rut) => rut ? rut.toString().replace(/[\.\-]/g, "").trim().toLowerCase() : "";
const formatDateDB = (date) => date.toISOString().slice(0, 10);
const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
  return new Date(date.setDate(diff));
};

export default function TeletrabajoManager({ currentUser }) {
  const [activeTab, setActiveTab] = useState('gestion'); 
  const [configs, setConfigs] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Formulario Config
  const [formData, setFormData] = useState({
    rut: '', nombre: '', modalidad: '4x1',
    condicion_1: '', condicion_2: '', condicion_3: '',
    condicion_especial: [] 
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [foundAgents, setFoundAgents] = useState([]);

  // Estados Gestión
  const [weeksOptions, setWeeksOptions] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [history, setHistory] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState(''); 

  useEffect(() => {
    fetchConfigs();
    fetchHistory();
    loadWeeks();
  }, []);

  const fetchConfigs = async () => {
    try {
        const res = await fetch('/api/distribucion_tt');
        if (res.ok) setConfigs(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchHistory = async () => {
    try {
        const res = await fetch('/api/gestion_tt');
        if (res.ok) setHistory(await res.json());
    } catch (e) { console.error(e); }
  };

  const loadWeeks = async () => {
    try {
        const res = await fetch('/api/turnos?get_dates=true');
        const dates = await res.json();
        const weeksMap = new Map();
        dates.forEach(d => {
            if(!d.fecha) return;
            const dateObj = new Date(d.fecha.length === 10 ? d.fecha + 'T00:00:00' : d.fecha);
            const monday = getMonday(dateObj);
            const key = formatDateDB(monday);
            if (!weeksMap.has(key)) {
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                const label = `Semana del ${monday.getDate()} al ${sunday.getDate()} de ${monday.toLocaleString('es-ES', {month:'long'})}`;
                weeksMap.set(key, { id: key, label, monday, sunday });
            }
        });
        const sortedWeeks = Array.from(weeksMap.values()).sort((a,b) => b.id.localeCompare(a.id));
        setWeeksOptions(sortedWeeks);
        const currentMonday = formatDateDB(getMonday(new Date()));
        const hasCurrent = sortedWeeks.find(w => w.id === currentMonday);
        setSelectedWeek(hasCurrent ? currentMonday : sortedWeeks[0]?.id || '');
    } catch (e) { console.error(e); }
  };

  // --- CRUD CONFIGURACIÓN ---
  const searchAgentsInTurnos = async (query) => {
      if (query.length < 3) return;
      const now = new Date();
      const start = new Date(now); start.setDate(now.getDate() - 30);
      const end = new Date(now); end.setDate(now.getDate() + 30);
      const res = await fetch(`/api/turnos?start=${formatDateDB(start)}&end=${formatDateDB(end)}`);
      const data = await res.json();
      const unique = new Map();
      const q = query.toLowerCase();
      data.forEach(t => {
          if (t.nombre && t.nombre.toLowerCase().includes(q)) {
              const rut = cleanRut(t.rut);
              if (!unique.has(rut)) unique.set(rut, { rut: rut, nombre: t.nombre });
          }
      });
      setFoundAgents(Array.from(unique.values()));
  };

  const handleSelectAgent = (agent) => {
      setFormData(prev => ({ ...prev, rut: agent.rut, nombre: agent.nombre }));
      setFoundAgents([]);
      setSearchTerm('');
  };

  const handleSaveConfig = async () => {
      const payload = { ...formData, condicion_especial: formData.condicion_especial.join(',') };
      const res = await fetch('/api/distribucion_tt', {
          method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
      });
      if (res.ok) { fetchConfigs(); setModalOpen(false); resetForm(); } else { alert("Error al guardar"); }
  };

  const handleEdit = (item) => {
      setEditingId(item.id);
      setFormData({
          rut: item.rut, nombre: item.nombre, modalidad: item.modalidad || '4x1',
          condicion_1: item.condicion_1 || '', condicion_2: item.condicion_2 || '', condicion_3: item.condicion_3 || '',
          condicion_especial: item.condicion_especial ? item.condicion_especial.split(',') : []
      });
      setModalOpen(true);
  };

  const handleDelete = async (id) => {
      if(!confirm("¿Eliminar configuración?")) return;
      await fetch(`/api/distribucion_tt?id=${id}`, { method: 'DELETE' });
      fetchConfigs();
  };

  const resetForm = () => {
      setFormData({ rut: '', nombre: '', modalidad: '4x1', condicion_1: '', condicion_2: '', condicion_3: '', condicion_especial: [] });
      setEditingId(null); setFoundAgents([]);
  };

  // --- LÓGICA DE NEGOCIO ---

  const isLibre = (row) => {
      if (!row) return true;
      const ini = (row.ini || row.Ini || '').toString().toUpperCase();
      return ini.includes('LIBRE') || !ini; 
  };
  const getDayPosition = (dayName) => { const p = { 'primer': 1, 'segundo': 2, 'tercer': 3, 'cuarto': 4, 'quinto': 5 }; return p[dayName] || 0; };
  
  const calculateDailyStatus = (shift, config, dayIndex, sortedShiftsOfWeek) => {
      if (!shift || isLibre(shift)) return 'LIBRE';
      if (!config) return 'SITE'; // Sin config = Site

      // Lógica Especial
      if (config.modalidad.toLowerCase() === 'especial') {
          const conditions = config.condicion_especial ? config.condicion_especial.split(',') : [];
          const iniStr = shift.ini || '';
          const hour = parseInt(iniStr.split(':')[0] || '0');
          const dayDate = new Date(shift.fecha.length === 10 ? shift.fecha + 'T00:00:00' : shift.fecha);
          const isWeekendOrFestivo = dayDate.getDay() === 0 || dayDate.getDay() === 6;
          
          let shiftType = (hour < 7) ? 'noche' : (hour < 12) ? 'am' : 'pm';

          if (isWeekendOrFestivo) {
              if (conditions.includes('weekend_festivos_tt')) return 'TT';
              if (conditions.includes('weekend_festivos_site')) return 'SITE';
          }
          if (conditions.includes(`${shiftType}_tt`)) return 'TT';
          if (conditions.includes(`${shiftType}_site`)) return 'SITE';
          return 'SITE';
      } 
      
      // Lógica 4x1 / 3x2 (Posicional)
      const condArray = [config.condicion_1, config.condicion_2, config.condicion_3].filter(Boolean);
      const shiftPosition = sortedShiftsOfWeek.findIndex(s => s.fecha === shift.fecha) + 1;
      
      const otherConditions = condArray.filter(c => c !== 'quinto');
      let sitePositions = otherConditions.map(getDayPosition).filter(p => p > 0);
      
      if (condArray.includes('quinto')) {
          const lastPos = sortedShiftsOfWeek.length;
          if (lastPos > 0 && !sitePositions.includes(lastPos)) sitePositions.push(lastPos);
      }
      
      return sitePositions.includes(shiftPosition) ? 'SITE' : 'TT';
  };

  // --- GENERACIÓN Y ACTUALIZACIÓN ---

  const generateReport = async () => {
    if (!selectedWeek) return;
    setGenerating(true);
    setStatusMsg('Obteniendo turnos...');

    try {
        const weekObj = weeksOptions.find(w => w.id === selectedWeek);
        const start = formatDateDB(weekObj.monday);
        const end = formatDateDB(weekObj.sunday);

        const res = await fetch(`/api/turnos?start=${start}&end=${end}`);
        const turnosData = await res.json();
        if (turnosData.length === 0) { alert("No hay turnos."); setGenerating(false); return; }

        setStatusMsg('Calculando distribución...');

        const agentsMap = new Map();
        turnosData.forEach(t => {
            const r = cleanRut(t.rut);
            if (!agentsMap.has(r)) agentsMap.set(r, { rut: t.rut, nombre: t.nombre, shifts: [] });
            agentsMap.get(r).shifts.push(t);
        });

        const updatesForTurnos = [];
        const dataToSaveHistory = []; 

        for (const agent of agentsMap.values()) {
            const config = configs.find(c => cleanRut(c.rut) === cleanRut(agent.rut));
            const workingShifts = agent.shifts.filter(s => !isLibre(s)).sort((a,b) => a.fecha.localeCompare(b.fecha));
            
            let agentResult = null;
            if (config) {
                agentResult = { rut: agent.rut, nombre: agent.nombre, dias: {} };
            }

            for (let i = 0; i < 7; i++) {
                const d = new Date(weekObj.monday); d.setDate(d.getDate() + i);
                const dayStr = formatDateDB(d);
                const shift = agent.shifts.find(s => s.fecha && s.fecha.startsWith(dayStr));

                let excelStatus = 'LIBRE'; 

                if (shift) {
                    excelStatus = calculateDailyStatus(shift, config, i, workingShifts);
                    let dbLugar = 'Site'; 
                    if (excelStatus === 'TT') { dbLugar = 'TT'; }
                    
                    updatesForTurnos.push({
                        rut: agent.rut,
                        fecha: dayStr,
                        lugar: dbLugar
                    });

                    if (agentResult) agentResult.dias[i] = excelStatus;
                } else {
                     if (agentResult) agentResult.dias[i] = 'LIBRE';
                }
            }
            if (agentResult) dataToSaveHistory.push(agentResult);
        }

        setStatusMsg(`Actualizando ${updatesForTurnos.length} registros a Site/TT...`);
        if (updatesForTurnos.length > 0) {
            await fetch('/api/apply_tt_to_turnos', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ updates: updatesForTurnos })
            });
        }

        setStatusMsg('Generando Excel...');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Calendario TT');
        const weekDays = Array.from({length:7}, (_, i) => { const d = new Date(weekObj.monday); d.setDate(d.getDate()+i); return d; });
        const monthName = weekObj.monday.toLocaleString('es-ES', { month: 'long' }).toUpperCase();
        const fileName = `Calendario TT ${monthName} Semana ${weekDays[0].getDate()}-${weekDays[6].getDate()}.xlsx`;

        worksheet.columns = [ { width: 5 }, { width: 35 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 60 } ];
        const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3041' } };
        const headerFont = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Calibri' };
        
        let r = 1;
        worksheet.getCell(r,1).value = `CALENDARIO TT ${monthName} ${weekObj.monday.getFullYear()}`;
        worksheet.mergeCells(r, 1, r, 10); worksheet.getCell(r,1).fill = headerFill; worksheet.getCell(r,1).font = {...headerFont, size:14}; r+=2;
        
        const headers = ['N°', 'NOMBRE', ...weekDays.map(d => `${d.getDate()}`), 'CONDICIONES'];
        const hRow = worksheet.getRow(r++);
        headers.forEach((h,i) => { 
            const c = hRow.getCell(i+1); c.value=h; c.fill=headerFill; c.font=headerFont; c.alignment={horizontal:'center'};
        });

        const sortedConfigs = configs.sort((a,b) => a.nombre.localeCompare(b.nombre));
        let idx = 1;
        
        for (const conf of sortedConfigs) {
            const calculated = dataToSaveHistory.find(d => cleanRut(d.rut) === cleanRut(conf.rut));
            if (calculated) {
                const row = worksheet.getRow(r++);
                row.getCell(1).value = idx++;
                row.getCell(2).value = conf.nombre;
                
                weekDays.forEach((_, i) => {
                    const status = calculated.dias[i] || 'LIBRE';
                    const cell = row.getCell(3+i);
                    cell.value = status;
                    cell.alignment = { horizontal: 'center' };
                    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                    if (status === 'TT') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                    if (status === 'SITE') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
                });
                row.getCell(10).value = conf.modalidad;
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a);

        await fetch('/api/gestion_tt', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                semana: selectedWeek, usuario: currentUser.nombre, cantidad: sortedConfigs.length, datos: dataToSaveHistory
            })
        });
        fetchHistory();
        setStatusMsg('');

    } catch (err) { console.error(err); alert("Error generando reporte"); setStatusMsg(''); } 
    finally { setGenerating(false); }
  };

  // Definición de las Pestañas (Igual que Transporte)
  const tabs = [
      { id: 'gestion', label: 'Gestión TT', icon: FileSpreadsheet },
      { id: 'distribucion', label: 'Distribución TT', icon: Settings }
  ];

  return (
    <div className="section-container">
      {/* HEADER CON PESTAÑAS ESTILO TRANSPORTE */}
      <div style={{marginBottom: '24px'}}>
        <h1 style={{margin:'0 0 16px 0', fontSize:'1.8rem', fontWeight:'700', color:'#0f172a', display:'flex', alignItems:'center', gap:'10px'}}>
            <Calendar color="#3b82f6" /> Calendario Teletrabajo
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
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
              }}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENIDO PESTAÑAS */}
      {activeTab === 'gestion' && (
        <div className="form-grid" style={{display:'flex', gap:'20px', flexDirection:'column'}}>
            <div style={{background:'#fff', padding:'24px', borderRadius:'12px', border:'1px solid #e2e8f0', display:'flex', gap:'20px', alignItems:'end', flexWrap:'wrap'}}>
                <div style={{flex:1, minWidth:'250px'}}>
                    <label className="control-label">Seleccionar Semana</label>
                    <select className="input-modern" style={{width:'100%'}} value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
                        {weeksOptions.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                    </select>
                </div>
                <button className="btn btn-primary" onClick={generateReport} disabled={generating}>
                    {generating ? <div style={{display:'flex', gap:'8px'}}><Loader2 className="spin" size={18}/><span>{statusMsg || 'Procesando...'}</span></div> : <><Download size={18}/> Ejecutar Proceso Completo</>}
                </button>
            </div>
            <div className="table-card">
                <div className="top-bar" style={{margin:0, borderBottom:'1px solid #e2e8f0', padding:'16px'}}><h3 style={{margin:0, fontSize:'1.1rem'}}>Historial de Ejecuciones</h3></div>
                <div className="table-wrapper">
                    <table className="modern-table">
                        <thead><tr><th>Semana</th><th>Fecha Ejecución</th><th>Generado Por</th><th>Agentes</th></tr></thead>
                        <tbody>{history.map(h => (<tr key={h.id}><td>{h.semana}</td><td>{new Date(h.fecha_generacion).toLocaleString()}</td><td>{h.usuario_generador}</td><td><span className="badge badge-active">{h.cantidad_agentes}</span></td></tr>))}</tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'distribucion' && (
        <>
        <div style={{display:'flex', justifyContent:'flex-end', marginBottom:'20px'}}>
            <button className="btn btn-primary" onClick={() => { resetForm(); setModalOpen(true); }}><Plus size={18}/> Agregar Agente</button>
        </div>
        <div className="table-card">
            <div className="table-wrapper">
                <table className="modern-table">
                    <thead><tr><th>Nombre</th><th>RUT</th><th>Modalidad</th><th>Condiciones</th><th>Cond. Especial</th><th style={{textAlign:'center'}}>Acciones</th></tr></thead>
                    <tbody>{configs.map(c => (
                        <tr key={c.id} onDoubleClick={() => handleEdit(c)} style={{cursor:'pointer'}} className="hover-row">
                            <td style={{fontWeight:'500'}}>{c.nombre}</td><td style={{fontFamily:'monospace', color:'#64748b'}}>{c.rut}</td>
                            <td><span className="badge badge-active">{c.modalidad}</span></td>
                            <td>{[c.condicion_1, c.condicion_2, c.condicion_3].filter(Boolean).join(', ')}</td><td style={{fontSize:'0.85rem'}}>{c.condicion_especial || '-'}</td>
                            <td style={{textAlign:'center', display:'flex', gap:'8px', justifyContent:'center'}}>
                                <button onClick={() => handleEdit(c)} className="btn btn-outline" style={{padding:'6px'}}><Edit size={16}/></button>
                                <button onClick={() => handleDelete(c.id)} className="btn btn-danger" style={{padding:'6px'}}><Trash2 size={16}/></button>
                            </td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
        </div>
        </>
      )}

      {modalOpen && (
        <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth:'600px'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                    <h3>{editingId ? 'Editar Distribución' : 'Nueva Distribución'}</h3>
                    <button onClick={() => setModalOpen(false)} style={{border:'none', background:'none', cursor:'pointer'}}><X/></button>
                </div>
                <div className="form-grid" style={{display:'flex', flexDirection:'column', gap:'16px'}}>
                    {!editingId && (
                        <div style={{position:'relative'}}>
                            <label className="control-label">Buscar Agente (En Turnos)</label>
                            <div style={{display:'flex', gap:'8px'}}>
                                <input className="input-modern" style={{flex:1}} placeholder="Escribe el nombre..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                <button className="btn btn-outline" onClick={() => searchAgentsInTurnos(searchTerm)}><Search size={16}/></button>
                            </div>
                            {foundAgents.length > 0 && (
                                <div style={{position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1px solid #e2e8f0', borderRadius:'8px', zIndex:10, maxHeight:'200px', overflowY:'auto', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}>
                                    {foundAgents.map(a => (<div key={a.rut} onClick={() => handleSelectAgent(a)} style={{padding:'10px', cursor:'pointer', borderBottom:'1px solid #f1f5f9'}}><strong>{a.nombre}</strong> <small>({a.rut})</small></div>))}
                                </div>
                            )}
                        </div>
                    )}
                    <div style={{display:'flex', gap:'10px'}}>
                        <div style={{flex:2}}><label className="control-label">Nombre</label><input className="input-modern" style={{width:'100%'}} value={formData.nombre} readOnly /></div>
                        <div style={{flex:1}}><label className="control-label">RUT</label><input className="input-modern" style={{width:'100%'}} value={formData.rut} readOnly /></div>
                    </div>
                    <div>
                        <label className="control-label">Modalidad</label>
                        <select className="input-modern" style={{width:'100%'}} value={formData.modalidad} onChange={e => setFormData({...formData, modalidad: e.target.value})}>
                            <option value="4x1">4x1</option><option value="3x2">3x2</option><option value="Especial">Especial</option>
                        </select>
                    </div>
                    {formData.modalidad !== 'Especial' ? (
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px'}}>
                            {['condicion_1', 'condicion_2', 'condicion_3'].map((field, i) => (
                                <div key={field}>
                                    <label className="control-label">Condición {i+1}</label>
                                    <select className="input-modern" style={{width:'100%'}} value={formData[field]} onChange={e => setFormData({...formData, [field]: e.target.value})}>
                                        <option value="">- Ninguna -</option>{['primer', 'segundo', 'tercer', 'cuarto', 'quinto'].map(op => (<option key={op} value={op}>{op}</option>))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div>
                            <label className="control-label">Condiciones Especiales</label>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', background:'#f8fafc', padding:'10px', borderRadius:'8px'}}>
                                {['pm_tt', 'am_tt', 'noche_tt', 'weekend_festivos_tt', 'pm_site', 'am_site', 'noche_site', 'weekend_festivos_site'].map(opt => (
                                    <label key={opt} style={{fontSize:'0.9rem', display:'flex', alignItems:'center', gap:'6px'}}>
                                        <input type="checkbox" checked={formData.condicion_especial.includes(opt)} onChange={e => { const current = formData.condicion_especial; const updated = e.target.checked ? [...current, opt] : current.filter(x => x !== opt); setFormData({...formData, condicion_especial: updated}); }} />
                                        {opt}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    <button className="btn btn-primary" style={{marginTop:'10px'}} onClick={handleSaveConfig}><Save size={18}/> Guardar Configuración</button>
                </div>
            </div>
        </div>
      )}
      <style>{` .spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } } `}</style>
    </div>
  );
}
