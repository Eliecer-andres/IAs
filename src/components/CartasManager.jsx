import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { 
  FileText, Plus, Search, Trash2, Calendar, Clock, AlertTriangle, Download, Loader2, User, Save, X 
} from 'lucide-react';

// --- UTILIDADES ---
const cleanRut = (rut) => rut ? rut.toString().replace(/[\.\-]/g, "").trim().toLowerCase() : "";
const formatDateDB = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().slice(0, 10);
};
const toProperCase = (str) => { 
    return !str ? '' : str.toString().toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); 
};

// Función para calcular diferencia de horas
const calculateDelay = (startStr, arrivalStr) => {
    if (!startStr || !arrivalStr) return { atraso: '', texto: '' };
    
    const [h1, m1] = startStr.split(':').map(Number);
    const [h2, m2] = arrivalStr.split(':').map(Number);
    
    let startMin = h1 * 60 + m1;
    let arrivalMin = h2 * 60 + m2;
    
    // Manejo de cambio de día
    if (arrivalMin < startMin) arrivalMin += 24 * 60;
    
    const diff = arrivalMin - startMin;
    if (diff <= 0) return { atraso: '00:00', texto: 'Sin atraso' };
    
    const hDiff = Math.floor(diff / 60);
    const mDiff = diff % 60;
    
    const atrasoStr = `${String(hDiff).padStart(2,'0')}:${String(mDiff).padStart(2,'0')}`;
    
    let textoStr = "";
    if (hDiff > 0) textoStr += `${hDiff} hora${hDiff > 1 ? 's' : ''} `;
    if (hDiff > 0 && mDiff > 0) textoStr += "y ";
    if (mDiff > 0) textoStr += `${mDiff} minuto${mDiff !== 1 ? 's' : ''}`;
    
    return { atraso: atrasoStr, texto: textoStr.trim() };
};

export default function CartasManager() {
  const [cartas, setCartas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Estados para formulario
  const [formData, setFormData] = useState({
    rut: '', nombre: '', fecha: formatDateDB(new Date()), 
    inicio_turno: '', fin_turno: '', 
    hora_llegada: '', // Campo temporal para cálculo
    incidencia: 'Atrasos', 
    atraso: '', tipo_carta: 'Amonestacion', observacion: '', duracion: ''
  });

  // Buscador Agentes
  const [searchTerm, setSearchTerm] = useState('');
  const [foundAgents, setFoundAgents] = useState([]);
  const [searchingShift, setSearchingShift] = useState(false);

  useEffect(() => {
    fetchCartas();
  }, []);

  const fetchCartas = async () => {
    setLoading(true);
    try {
        const res = await fetch('/api/cartas'); 
        if(res.ok) setCartas(await res.json());
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  // --- BUSCADOR DINÁMICO ---
  useEffect(() => {
      const delayDebounceFn = setTimeout(() => {
          if (searchTerm.length >= 3) {
              searchAgentsInTurnos(searchTerm);
          } else {
              setFoundAgents([]);
          }
      }, 300);
      return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const searchAgentsInTurnos = async (query) => {
      const now = new Date();
      const start = new Date(now); start.setDate(now.getDate() - 30);
      const end = new Date(now); end.setDate(now.getDate() + 30);
      
      try {
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
      } catch (e) { console.error(e); }
  };

  const handleSelectAgent = (agent) => {
      setFormData(prev => ({ ...prev, rut: agent.rut, nombre: agent.nombre }));
      setFoundAgents([]);
      setSearchTerm(''); 
      if (formData.fecha) findTurnoForAgent(agent.rut, formData.fecha);
  };

  // --- LÓGICA AUTO-COMPLETAR TURNO ---
  const findTurnoForAgent = async (rut, fecha) => {
      if (!rut || !fecha) return;
      setSearchingShift(true);
      try {
          const res = await fetch(`/api/turnos?start=${fecha}&end=${fecha}`);
          const data = await res.json();
          const turno = data.find(t => cleanRut(t.rut) === cleanRut(rut));
          if (turno) {
              setFormData(prev => ({ ...prev, inicio_turno: turno.ini || '', fin_turno: turno.fin || '' }));
          }
      } catch (e) { console.error(e); }
      finally { setSearchingShift(false); }
  };

  useEffect(() => {
      if (modalOpen && formData.rut && formData.fecha) {
          const timer = setTimeout(() => findTurnoForAgent(formData.rut, formData.fecha), 500);
          return () => clearTimeout(timer);
      }
  }, [formData.fecha, formData.rut, modalOpen]);

  // --- CÁLCULO AUTOMÁTICO DE ATRASO ---
  useEffect(() => {
      if (formData.incidencia === 'Atrasos' && formData.inicio_turno && formData.hora_llegada) {
          const { atraso, texto } = calculateDelay(formData.inicio_turno, formData.hora_llegada);
          setFormData(prev => ({ ...prev, atraso: atraso, duracion: texto }));
      }
  }, [formData.inicio_turno, formData.hora_llegada, formData.incidencia]);

  // --- CRUD ---
  const handleSubmit = async (e) => {
      e.preventDefault();
      const dataToSend = { ...formData };
      // Limpiar campos si es ausencia
      if (dataToSend.incidencia === 'Ausencia') {
          dataToSend.atraso = '';
          dataToSend.duracion = '';
          dataToSend.hora_llegada = '';
      }

      const res = await fetch('/api/cartas', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(dataToSend)
      });
      if(res.ok) {
          setModalOpen(false);
          resetForm();
          fetchCartas();
      } else {
          alert("Error al guardar");
      }
  };

  const handleDelete = async (id) => {
      if(!confirm("¿Eliminar registro?")) return;
      await fetch(`/api/cartas?id=${id}`, { method: 'DELETE' });
      fetchCartas();
  };

  const resetForm = () => {
      setFormData({
        rut: '', nombre: '', fecha: formatDateDB(new Date()), 
        inicio_turno: '', fin_turno: '', hora_llegada: '',
        incidencia: 'Atrasos', atraso: '', tipo_carta: 'Amonestacion', observacion: '', duracion: ''
      });
      setSearchTerm('');
  };

  // --- LOGICA DE GENERACIÓN DE WORD (PORTADA EXACTA DE CARTAS.HTML) ---
  
  const generateZip = async () => {
      if(cartas.length === 0) return;
      setGenerating(true);
      try {
          const zip = new JSZip();
          for (const item of cartas) {
              const htmlContent = createWordDocument([item]); 
              const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
              
              const cleanName = item.nombre.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
              const fileName = `${item.tipo_carta}_${item.incidencia}_${item.rut}_${cleanName}_${item.id}.doc`;
              
              zip.file(fileName, blob);
          }
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          saveAs(zipBlob, `Cartas_${new Date().toISOString().slice(0,10)}.zip`);
      } catch (err) { console.error(err); alert("Error generando ZIP"); } 
      finally { setGenerating(false); }
  };

  const createWordDocument = (incidentGroup) => {
      const data = incidentGroup[0];
      const isPlural = incidentGroup.length > 1;
      
      // Fecha actual en formato "09 de diciembre de 2025"
      const today = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
      
      const headerHtml = `<div style='font-family: Calibri, sans-serif; color: #1f4e9b; font-weight: bold; font-size: 18pt;'>Konecta</div><div style='font-family: Calibri, sans-serif; font-size: 10pt; line-height: 1.2;'><b>KALLPLAT CHILE LIMITADA</b><br>RUT: 76.071.717-7<br>Giro: Actividades de Call Center<br>Calle Rodrigo de Araya Nº 1045, Macul. Santiago.</div>`;
      
      let bodyHtml;
      const tipoNormalizado = data.tipo_carta.toLowerCase();
      const esCompromiso = tipoNormalizado.includes('compromiso');
      const incidenciaNormalizada = data.incidencia.toLowerCase();

      // --- CASO 1: ABANDONO ---
      if (incidenciaNormalizada.includes('abandono')) {
          const titulo = esCompromiso ? 'Carta de Compromiso' : 'Carta de Amonestación';
          const parrafoInspeccion = esCompromiso ? '' : ' De acuerdo a lo anterior, esta amonestación será informada a la Inspección del Trabajo y quedará una copia en su carpeta personal.';
          const textoCC = esCompromiso ? 'CC. Carpeta personal' : 'CC. Carpeta personal<br>Inspección del Trabajo';
          
          const datesString = incidentGroup.map(d => {
              // Ajuste de zona horaria manual para visualización
              const f = new Date(d.fecha); f.setMinutes(f.getMinutes() + f.getTimezoneOffset());
              return f.toLocaleDateString('es-CL', { day: '2-digit', month: 'long' });
          }).join(', ');
          
          const dayText = isPlural ? `los días ${datesString}` : `el día ${datesString}`;
          const shiftText = isPlural 
              ? `durante sus jornadas de trabajo` 
              : `durante su jornada de trabajo desde las ${data.inicio_turno} a ${data.fin_turno} horas`;

          const page1 = `<table style='width: 100%; border-collapse: collapse;'>
                          <tr><td style='padding-bottom: 10px;'>${headerHtml}</td></tr>
                          <tr>
                              <td>
                                  <p style='text-align: right; padding-top:20px;'>Osorno, ${today}</p>
                                  <p style='text-align: center; font-weight: bold; text-decoration: underline; padding-top:30px;'>${titulo}</p>
                                  <br><br>
                                  <p style='margin-bottom: 20px;'><b>Señor (a):</b> ${toProperCase(data.nombre)}<br><b>Rut:</b> ${data.rut}</p>
                                  <p style='margin-bottom: 20px;'><b>Presente.</b></p>
                                  <p style='margin-bottom: 20px;'>De mi consideración:</p>
                                  <p style='text-align: justify; margin-bottom: 12px; line-height: 1.4;'>Cumplo con informarle a Ud. que es su obligación cumplir en forma íntegra su jornada laboral, para poder desempeñar en forma correcta las funciones para las que fue contratado, ${dayText}, sin justificación alguna y sin autorización de su jefatura directa se ha ausentado ${shiftText} y al ser buscado en plataforma Genesys iCloud no pudo ser ubicada en conexión desde su modalidad de teletrabajo.</p>
                              </td>
                          </tr>
                      </table>`;
          
          const page2 = `<table style='width: 100%; border-collapse: collapse;'>
                          <tr><td style='padding-bottom: 10px;'>${headerHtml}</td></tr>
                          <tr>
                              <td style='padding-top: 20px;'>
                                  <p style='text-align: justify; margin-bottom: 12px; line-height: 1.4;'>Le recordamos que debe respetar la letra A) del Reglamento Interno de Orden Higiene y Seguridad que en el apartado referido a las Prohibiciones en el Titulo XV en su artículo 87, indica …” Abandonar el trabajo o ausentarse intempestivamente del recinto en que éste se desarrolla durante la jornada laboral sin justificación y/o autorización.</p>
                                  <p style='text-align: justify; margin-bottom: 12px; line-height: 1.4;'>En atención a lo señalado con anterioridad se le solicita encarecidamente, que tome las medidas pertinentes para solucionar estas dificultades que entorpecen el normal funcionamiento de nuestra empresa, a fin de evitar sanciones posteriores.${parrafoInspeccion}</p>
                                  <p style='margin-top: 30px;'>Sin otro particular,</p>
                                  <p style='margin-top: 10px; margin-bottom: 80px;'>Le saluda atentamente,</p>
                                  <table style="width:100%;"><tr><td style="text-align:left; vertical-align:bottom;"><b>Jefe de Servicios</b></td><td style="text-align:right; vertical-align:bottom;"><b>Nombre:</b> ${toProperCase(data.nombre)}<br><b>Rut:</b> ${data.rut}</td></tr></table>
                                  <div style='margin-top: 50px; font-weight: bold;'>${textoCC}</div>
                              </td>
                          </tr>
                         </table>`;
          bodyHtml = `${page1}<br clear=all style='mso-special-character:line-break; page-break-before:always'>${page2}`;

      // --- CASO 2: AUSENCIA ---
      } else if (incidenciaNormalizada.includes('ausencia')) {
          const titulo = esCompromiso ? 'Carta de Compromiso' : 'Carta de Amonestación';
          const parrafoInspeccion = esCompromiso ? '' : ' De acuerdo con lo anterior, esta amonestación será informada a la Inspección del Trabajo y quedará una copia en su carpeta personal.';
          const textoCC = esCompromiso ? 'CC. Carpeta personal' : 'CC. Carpeta personal<br>Inspección del Trabajo';
          
          let incidentDetails;
          if (isPlural) {
              const datesString = incidentGroup.map(d => {
                  const f = new Date(d.fecha); f.setMinutes(f.getMinutes() + f.getTimezoneOffset());
                  return f.toLocaleDateString('es-CL', { day: '2-digit', month: 'long' });
              }).join(', ');
              const shiftsString = incidentGroup.map(d => `turno de ${d.inicio_turno} a ${d.fin_turno} horas`).join(', ');
              incidentDetails = `los días en que ha dejado de prestar sus funciones injustificadamente ${datesString} en sus respectivos turnos (${shiftsString})`;
          } else {
              const f = new Date(data.fecha); f.setMinutes(f.getMinutes() + f.getTimezoneOffset());
              const incidentDate = f.toLocaleDateString('es-CL', { day: '2-digit', month: 'long' });
              incidentDetails = `el día en que ha dejado de prestar sus funciones injustificadamente ${incidentDate} en su turno programado de ${data.inicio_turno} a ${data.fin_turno} horas.`;
          }

          const page1 = `<table style='width: 100%; border-collapse: collapse;'><tr><td style='padding-bottom: 10px;'>${headerHtml}</td></tr><tr><td><p style='text-align: right; padding-top:20px;'>Osorno, ${today}</p><p style='text-align: center; text-decoration: underline; font-weight:bold; padding-top:30px;'>${titulo}</p><br><br><p><b>Señor(a):</b> ${toProperCase(data.nombre)}</p><p><b>RUT:</b> ${data.rut}</p><p style='font-weight: bold; margin-bottom: 20px;'>Presente</p><p style='margin-bottom: 20px;'>De nuestra consideración:</p><p style='text-align: justify; margin-bottom: 12px; line-height: 1.4;'>Cumplo con informarle a Ud. que, según lo dispuesto en su contrato individual de trabajo, usted debe entregar una atención de calidad al momento de realizar las atenciones.</p><p style='text-align: justify; margin-bottom: 12px; line-height: 1.4;'>Le recordamos que debe respetar la Cláusula Primera y Cuarta de su Contrato Individual de trabajo... ${incidentDetails}, debe cumplir con lo establecido en el Reglamento Interno...</p></td></tr></table>`;
          const page2 = `<table style='width: 100%; border-collapse: collapse;'><tr><td style='padding-bottom: 10px;'>${headerHtml}</td></tr><tr><td style='padding-top: 20px;'><p style='text-align: justify; margin-bottom: 12px; line-height: 1.4;'>Con el objeto de que Ud. se comprometa a no presentar Alguna Ausencia y Cumplir con su Turno, se efectúa esta carta de Amonestación.</p><p style='text-align: justify; margin-bottom: 12px; line-height: 1.4;'>En atención a los puntos señalados con anterioridad se le solicita encarecidamente, que tome las medidas pertinentes para solucionar estas dificultades que entorpecen el normal funcionamiento de sus deberes laborales en nuestra empresa, a fin de evitar sanciones posteriores.${parrafoInspeccion}</p><p style='margin-top: 30px;'>Sin otro particular, le saluda atentamente,</p><br><br><br><br><table style="width:100%;"><tr><td style="text-align:left; vertical-align:bottom;"><b>Jefe de Servicio</b><br>Konecta Chile Limitada.</td><td style="text-align:right; vertical-align:bottom;"><b>Nombre del Trabajador:</b> ${toProperCase(data.nombre)}<br>${data.rut}</td></tr></table><div style='margin-top: 50px; font-weight: bold;'>${textoCC}</div></td></tr></table>`;
          bodyHtml = `${page1}<br clear=all style='mso-special-character:line-break; page-break-before:always'>${page2}`;

      // --- CASO 3: ATRASOS (DEFAULT) ---
      } else { 
          const titulo = esCompromiso ? 'Carta de Compromiso' : 'Carta de Amonestación';
          const parrafoInspeccion = esCompromiso ? '' : ' De acuerdo con lo anterior, esta amonestación será informada a la Inspección del Trabajo y quedará una copia en su carpeta personal.';
          const textoCC = esCompromiso ? 'CC. Carpeta personal' : 'CC. Carpeta personal<br>Inspección del Trabajo';
          
          let parrafoPrincipal;
          if (isPlural) {
              const incidentsHtml = incidentGroup.map(incident => {
                  const f = new Date(incident.fecha); f.setMinutes(f.getMinutes() + f.getTimezoneOffset());
                  const incidentDate = f.toLocaleDateString('es-CL', { day: '2-digit', month: 'long' });
                  const duracionTexto = incident.duracion ? `de una duración de ${incident.duracion} ` : ``;
                  return `El día ${incidentDate}, presenta un atraso injustificado, ${duracionTexto}ya que su turno programado para ese día era a partir de las ${incident.inicio_turno} horas.`;
              }).join('<br>');

              parrafoPrincipal = `<p style='text-align: justify; margin-bottom: 12px; line-height: 1.4;'>${incidentsHtml}</p>
                                <p style='text-align: justify; margin-bottom: 12px; line-height: 1.4;'>Al presentar estos atrasos en su hora de ingreso, perjudica el normal funcionamiento de la plataforma, que necesita contar con una cantidad de ejecutivos disponibles para atender en el horario en que su turno fue programado, perjudicando gravemente los niveles de servicio de la compañía y la calidad de atención a nuestros clientes.</p>`;
          } else {
              const f = new Date(data.fecha); f.setMinutes(f.getMinutes() + f.getTimezoneOffset());
              const incidentDate = f.toLocaleDateString('es-CL', { day: '2-digit', month: 'long' });
              const duracionTexto = data.duracion ? `de una duración de ${data.duracion} ` : `de una duración de ${data.atraso || 'XX minutos'} `;
              parrafoPrincipal = `<p style='text-align: justify; margin-bottom: 12px; line-height: 1.4;'>El día ${incidentDate}, presenta un atraso injustificado, ${duracionTexto}ya que su turno programado para ese día era a partir de las ${data.inicio_turno} horas, al presentar este atraso en su hora de ingreso, perjudica el normal funcionamiento de la plataforma, que necesita contar con una cantidad de ejecutivos disponibles para atender en el horario en que su turno fue programado, perjudicando gravemente los niveles de servicio de la compañía y la calidad de atención a nuestros clientes.</p>`;
          }
          
          const parrafoReglamento = `<p style='text-align: justify; margin-bottom: 12px; line-height: 1.4;'>Le recordamos que debe respetar la <b>letra b)</b> del Reglamento Interno de Orden Higiene y Seguridad que en el apartado referido a las prohibiciones en el Titulo XV en su artículo 87, indica …” llegar atrasado o registrar en forma reiterada, atrasos en su hora de ingreso…”. En atención a lo señalado con anterioridad se le solicita encarecidamente, que tome las medidas pertinentes para solucionar estas dificultades que entorpecen el normal funcionamiento de nuestra empresa, a fin de evitar sanciones posteriores.${parrafoInspeccion}</p>`;
          
          const page1 = `<table style='width: 100%; border-collapse: collapse;'>
                          <tr><td style='padding-bottom: 10px;'>${headerHtml}</td></tr>
                          <tr>
                              <td>
                                  <p style='text-align: right; padding-top:20px;'>Osorno, ${today}</p>
                                  <p style='text-align: center; font-weight: bold; text-decoration: underline; padding-top:30px;'>${titulo}</p>
                                  <br><br>
                                  <p style='margin-bottom: 20px;'><b>Señor (a):</b> ${toProperCase(data.nombre)}<br><b>Rut:</b> ${data.rut}</p>
                                  <p style='margin-bottom: 20px;'><b>Presente.</b></p>
                                  <p style='margin-bottom: 20px;'>De mi consideración:</p>
                                  <p style='text-align: justify; margin-bottom: 12px; line-height: 1.4;'>Cumplo con informarle a Ud. que es su obligación cumplir en forma íntegra su jornada laboral.</p>
                                  ${parrafoPrincipal}
                              </td>
                          </tr>
                      </table>`;
          const page2 = `<table style='width: 100%; border-collapse: collapse;'><tr><td style='padding-bottom: 10px;'>${headerHtml}</td></tr><tr><td style='padding-top: 20px;'>${parrafoReglamento}<p style='margin-top: 30px;'>Sin otro particular,</p><p style='margin-top: 10px; margin-bottom: 80px;'>Le saluda atentamente,</p><table style="width:100%;"><tr><td style="text-align:left; vertical-align:bottom;"><b>Jefe de Servicios</b></td><td style="text-align:right; vertical-align:bottom;"><b>Nombre:</b> ${toProperCase(data.nombre)}<br><b>Rut:</b> ${data.rut}</td></tr></table><div style='margin-top: 50px; font-weight: bold;'>${textoCC}</div></td></tr>
                      </table>`;
          bodyHtml = `${page1}<br clear=all style='mso-special-character:line-break; page-break-before:always'>${page2}`;
      }

      return `<html xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Carta</title></head><body style='font-family: Calibri, sans-serif; font-size: 11pt;'>${bodyHtml}</body></html>`;
  };

  return (
    <div className="section-container">
      <div className="top-bar">
        <h1 style={{margin:0, fontSize:'1.5rem', fontWeight:'700', color:'#0f172a', display:'flex', alignItems:'center', gap:'10px'}}>
            <FileText color="#3b82f6" /> Gestión de Cartas
        </h1>
        <div style={{marginLeft:'auto', display:'flex', gap:'10px'}}>
             <button className="btn btn-primary" onClick={() => { resetForm(); setModalOpen(true); }}>
                <Plus size={18}/> Agregar Carta
             </button>
             <button className="btn btn-outline" onClick={generateZip} disabled={generating || cartas.length === 0}>
                {generating ? <Loader2 className="spin" size={18}/> : <><Download size={18}/> Descargar Todo (ZIP)</>}
             </button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-wrapper">
          <table className="modern-table">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Agente</th>
                    <th>Incidencia</th>
                    <th>Tipo</th>
                    <th>Turno</th>
                    <th>Detalle</th>
                    <th>Obs</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                {cartas.map(c => (
                    <tr key={c.id} className="hover-row">
                        <td>{c.fecha}</td>
                        <td><div style={{fontWeight:'500'}}>{c.nombre}</div><div style={{fontSize:'0.75rem', color:'#64748b'}}>{c.rut}</div></td>
                        <td>{c.incidencia}</td>
                        <td><span className={`badge ${c.tipo_carta === 'Amonestacion' ? 'badge-inactive' : 'badge-active'}`}>{c.tipo_carta}</span></td>
                        <td style={{fontSize:'0.85rem'}}>{c.inicio_turno} - {c.fin_turno}</td>
                        <td>{c.incidencia === 'Ausencia' ? '-' : (c.duracion || c.atraso)}</td>
                        <td style={{maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={c.observacion}>{c.observacion}</td>
                        <td><button onClick={() => handleDelete(c.id)} className="btn btn-danger" style={{padding:'6px'}}><Trash2 size={16}/></button></td>
                    </tr>
                ))}
                {cartas.length === 0 && <tr><td colSpan="8" style={{textAlign:'center', padding:'20px', color:'#94a3b8'}}>No hay registros</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth:'700px'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                    <h3>Nueva Carta</h3>
                    <button onClick={() => setModalOpen(false)} style={{border:'none', background:'none', cursor:'pointer'}}><X/></button>
                </div>

                <form onSubmit={handleSubmit} className="form-grid" style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                    
                    <div style={{position:'relative'}}>
                        <label className="control-label">Buscar Agente (Escribe nombre)</label>
                        <input className="input-modern" style={{width:'100%'}} placeholder="Ej: Juan Perez..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        {foundAgents.length > 0 && (
                            <div style={{position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1px solid #e2e8f0', zIndex:10, maxHeight:'150px', overflowY:'auto', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}>
                                {foundAgents.map(a => (
                                    <div key={a.rut} onClick={() => handleSelectAgent(a)} style={{padding:'10px', cursor:'pointer', borderBottom:'1px solid #f1f5f9'}}><strong>{a.nombre}</strong> ({a.rut})</div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{display:'flex', gap:'10px'}}>
                        <div style={{flex:1}}><label className="control-label">Nombre</label><input className="input-modern" style={{width:'100%'}} value={formData.nombre} readOnly required /></div>
                        <div style={{flex:1}}><label className="control-label">RUT</label><input className="input-modern" style={{width:'100%'}} value={formData.rut} readOnly required /></div>
                    </div>

                    <div style={{display:'flex', gap:'10px', alignItems:'flex-end'}}>
                        <div style={{flex:1}}>
                            <label className="control-label">Fecha Incidencia</label>
                            <input type="date" className="input-modern" style={{width:'100%'}} value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} required />
                        </div>
                        <div style={{flex:1, display:'flex', gap:'5px'}}>
                            <div style={{flex:1}}>
                                <label className="control-label">Inicio Turno</label>
                                <div style={{position:'relative'}}>
                                    <input className="input-modern" style={{width:'100%'}} value={formData.inicio_turno} onChange={e => setFormData({...formData, inicio_turno: e.target.value})} placeholder="HH:MM" />
                                    {searchingShift && <Loader2 className="spin" size={14} style={{position:'absolute', right:5, top:12}}/>}
                                </div>
                            </div>
                            <div style={{flex:1}}>
                                <label className="control-label">Fin Turno</label>
                                <input className="input-modern" style={{width:'100%'}} value={formData.fin_turno} onChange={e => setFormData({...formData, fin_turno: e.target.value})} placeholder="HH:MM" />
                            </div>
                        </div>
                    </div>

                    <div style={{display:'flex', gap:'10px'}}>
                        <div style={{flex:1}}>
                            <label className="control-label">Incidencia</label>
                            <select className="input-modern" style={{width:'100%'}} value={formData.incidencia} onChange={e => setFormData({...formData, incidencia: e.target.value})}>
                                <option value="Atrasos">Atrasos</option><option value="Ausencia">Ausencia</option><option value="Abandono">Abandono</option><option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div style={{flex:1}}>
                            <label className="control-label">Tipo Carta</label>
                            <select className="input-modern" style={{width:'100%'}} value={formData.tipo_carta} onChange={e => setFormData({...formData, tipo_carta: e.target.value})}>
                                <option value="Amonestacion">Amonestación</option><option value="Compromiso">Compromiso</option><option value="Justificacion">Justificación</option>
                            </select>
                        </div>
                    </div>

                    {formData.incidencia === 'Atrasos' && (
                        <div style={{display:'flex', gap:'10px', background:'#f0f9ff', padding:'10px', borderRadius:'8px', border:'1px solid #bae6fd'}}>
                            <div style={{flex:1}}>
                                <label className="control-label" style={{color:'#0284c7'}}>Hora Llegada Real</label>
                                <input type="time" className="input-modern" style={{width:'100%', borderColor:'#38bdf8'}} value={formData.hora_llegada} onChange={e => setFormData({...formData, hora_llegada: e.target.value})} />
                            </div>
                            <div style={{flex:1}}>
                                <label className="control-label">Tiempo Atraso</label>
                                <input className="input-modern" style={{width:'100%', background:'#e0f2fe'}} value={formData.atraso} readOnly placeholder="Auto" />
                            </div>
                            <div style={{flex:2}}>
                                <label className="control-label">Duración Texto</label>
                                <input className="input-modern" style={{width:'100%', background:'#e0f2fe'}} value={formData.duracion} readOnly placeholder="Calculado automáticamente" />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="control-label">Observación</label>
                        <textarea className="input-modern" style={{width:'100%', height:'60px'}} value={formData.observacion} onChange={e => setFormData({...formData, observacion: e.target.value})} />
                    </div>

                    <div style={{display:'flex', justifyContent:'flex-end', marginTop:'10px'}}>
                        <button type="submit" className="btn btn-primary"><Save size={18}/> Guardar Carta</button>
                    </div>
                </form>
            </div>
        </div>
      )}
      <style>{` .spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } } `}</style>
    </div>
  );
}
