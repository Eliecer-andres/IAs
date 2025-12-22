import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  Trash2, 
  Search, 
  Download, 
  Database, 
  Filter,
  AlertCircle,
  Calendar,
  UserCheck
} from 'lucide-react';
import './VariablesManager.css';

const VariablesManager = ({ user }) => {
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1);
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear());
  const [busqueda, setBusqueda] = useState('');

  const isAdmin = user?.rol === 'admin' || user?.rol === 'supervisor';

  // --- FUNCIÓN CLAVE PARA EL CRUCE (Limpia puntos y guión) ---
  const limpiarRut = (rutRaw) => {
    if (!rutRaw) return '';
    return rutRaw.toString().replace(/[^0-9kK]/g, '').toLowerCase();
  };

  const userRutLimpio = limpiarRut(user?.rut);

  useEffect(() => {
    cargarVariables();
  }, [filtroMes, filtroAnio]);

  const cargarVariables = async () => {
    setLoading(true);
    try {
      let url = `/api/variables?mes=${filtroMes}&anio=${filtroAnio}`;
      
      // Si es Agente, forzamos su RUT para que solo vea lo suyo
      if (!isAdmin) {
        url += `&rut=${userRutLimpio}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      setVariables(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando variables", error);
    } finally {
      setLoading(false);
    }
  };

  // --- 1. PLANTILLA CON TODOS LOS BONOS ---
  const descargarPlantilla = () => {
    const headers = [
      "RUT", "NOMBRE", 
      "META_ADHERENCIA", "PORC_ADHERENCIA", "PAGO_ADHERENCIA", 
      "META_CALIDAD", "PORC_CALIDAD", "PAGO_CALIDAD",
      "META_PRODUCCION", "PORC_PRODUCCION", "PAGO_PRODUCCION",     // Cols 8,9,10
      "META_PRODUCTIVIDAD", "PORC_PRODUCTIVIDAD", "PAGO_PRODUCTIVIDAD", // Cols 11,12,13 (NUEVO)
      "META_OTROS", "PORC_OTROS", "PAGO_OTROS"                     // Cols 14,15,16 (NUEVO)
    ];

    const data = [
      headers,
      // Ejemplo: Rut, Nombre, Adherencia(3), Calidad(3), Producción(3), Productividad(3), Otros(3)
      ["12345678-9", "Ejemplo Completo", 23000, 100, 2300, 50000, 95, 4500, 100000, 110, 20000, 5000, 100, 5000, 0, 0, 10000]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Ajustar ancho de columnas para que se vea ordenado
    const wchNum = {wch: 15};
    ws['!cols'] = [
      {wch: 12}, {wch: 25}, // ID
      wchNum, wchNum, wchNum, // Adherencia
      wchNum, wchNum, wchNum, // Calidad
      wchNum, wchNum, wchNum, // Producción
      wchNum, wchNum, wchNum, // Productividad
      wchNum, wchNum, wchNum  // Otros
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Variables");
    XLSX.writeFile(wb, "Plantilla_Carga_Variables.xlsx");
  };

  // --- 2. LECTURA DEL EXCEL (TODOS LOS BONOS) ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const workbook = XLSX.read(bstr, { type: 'binary' });
      const wsName = workbook.SheetNames[0];
      const ws = workbook.Sheets[wsName];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const datosProcesados = [];

      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row[0]) continue; 

        const rutFila = limpiarRut(row[0]);
        const nombre = row[1] || 'Sin Nombre';
        const cleanNum = (val) => val ? parseFloat(val) : 0;

        // Función auxiliar para crear objetos de bono
        const addBono = (tipo, idxMeta, idxPorc, idxPago) => {
            // Solo agregamos si existe un valor en el pago o en la meta
            if ((row[idxMeta] !== undefined && row[idxMeta] !== "") || (row[idxPago] !== undefined && row[idxPago] !== "")) {
                datosProcesados.push({
                    rut: rutFila, 
                    nombre, 
                    mes: filtroMes, 
                    anio: filtroAnio,
                    tipo_bono: tipo,
                    meta_monto: cleanNum(row[idxMeta]), 
                    porcentaje: cleanNum(row[idxPorc]), 
                    pago_real: cleanNum(row[idxPago])
                });
            }
        };

        // --- LECTURA DE COLUMNAS ---
        addBono('Bono Adherencia', 2, 3, 4);
        addBono('Bono Calidad', 5, 6, 7);
        addBono('Bono Producción', 8, 9, 10);      // <--- Producción
        addBono('Bono Productividad', 11, 12, 13); // <--- Productividad (NUEVO)
        addBono('Otros', 14, 15, 16);              // <--- Otros (NUEVO)
      }
      enviarAlBackend(datosProcesados);
    };
    reader.readAsBinaryString(file);
  };

  const enviarAlBackend = async (datos) => {
    if(datos.length === 0) return alert("El archivo no contiene datos válidos o está vacío.");
    
    // Mensaje de confirmación con detalle
    if(!confirm(`Se detectaron ${datos.length} registros para ${filtroMes}/${filtroAnio}. ¿Deseas cargarlos?`)) return;

    try {
        const res = await fetch('/api/variables', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(datos)
        });
        if(res.ok) {
            alert("✅ Carga completada con éxito.");
            cargarVariables();
        } else {
            alert("❌ Error al guardar en base de datos.");
        }
    } catch(e) {
        alert("Error de conexión con el servidor.");
    }
  };

  const borrarMesActual = async () => {
    if(!confirm(`⚠️ ATENCIÓN: ¿Estás seguro de BORRAR TODOS los bonos del periodo ${filtroMes}/${filtroAnio}?`)) return;
    await fetch(`/api/variables?mes=${filtroMes}&anio=${filtroAnio}`, { method: 'DELETE' });
    cargarVariables();
  };

  const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

  const variablesFiltradas = variables.filter(v => 
    v.rut.includes(busqueda.toLowerCase()) || 
    (v.nombre && v.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // --- ESTILOS DE BADGES ACTUALIZADOS ---
  const getBadgeClass = (tipo) => {
    const t = tipo.toLowerCase();
    if (t.includes('adherencia')) return 'badge badge-adherencia'; // Azul
    if (t.includes('calidad')) return 'badge badge-calidad';       // Morado
    if (t.includes('producción')) return 'badge badge-prod';       // Verde Esmeralda
    if (t.includes('productividad')) return 'badge badge-prod';    // Verde (o puedes crear uno naranja)
    return 'badge badge-calidad'; // Gris/Default para "Otros"
  };

  return (
    <div className="vm-container">
      {/* HEADER */}
      <div className="vm-header">
        <div className="vm-title">
          <h1><Database size={28} color="#4f46e5" /> {isAdmin ? 'Gestión de Bonos' : 'Mis Variables'}</h1>
          <p className="vm-subtitle">
            {isAdmin 
              ? 'Control de pagos variables (Producción, Calidad, Otros)' 
              : `Bonos asignados al RUT: ${userRutLimpio}`
            }
          </p>
        </div>

        <div className="vm-filters">
            <Calendar size={18} color="#94a3b8"/>
            <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className="vm-select">
                {meses.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <span>|</span>
            <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)} className="vm-select">
                <option value="2024">2024</option>
                <option value="2025">2025</option>
            </select>
        </div>
      </div>

      {/* TARJETAS DE ACCIÓN (SOLO ADMIN) */}
      {isAdmin && (
        <div className="vm-grid-actions">
            
            {/* 1. Descargar */}
            <div className="vm-card green-theme">
                <div className="vm-card-header">
                    <div className="vm-icon-box"><FileSpreadsheet size={24} /></div>
                    <span className="vm-step-badge">Paso 1</span>
                </div>
                <h3>Obtener Formato</h3>
                <p className="vm-subtitle">Plantilla completa (Prod, Productividad, Otros).</p>
                <button onClick={descargarPlantilla} className="vm-btn-action" style={{marginTop: '15px'}}>
                    <Download size={18} /> Descargar Plantilla
                </button>
            </div>

            {/* 2. Subir */}
            <div className="vm-card blue-theme">
                <div className="vm-card-header">
                    <div className="vm-icon-box"><Upload size={24} /></div>
                    <span className="vm-step-badge">Paso 2</span>
                </div>
                <h3>Cargar Datos</h3>
                <p className="vm-subtitle">Sube el Excel completado.</p>
                <label className="vm-btn-action" style={{marginTop: '15px'}}>
                    Subir Archivo Excel
                    <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                </label>
            </div>

            {/* 3. Borrar */}
            <div className="vm-card red-theme">
                <div className="vm-card-header">
                    <div className="vm-icon-box"><Trash2 size={24} /></div>
                    <span className="vm-step-badge">Peligro</span>
                </div>
                <h3>Limpiar Mes</h3>
                <p className="vm-subtitle">Elimina toda la carga del mes actual.</p>
                <button 
                    onClick={borrarMesActual} 
                    disabled={variables.length === 0}
                    className="vm-btn-action" 
                    style={{marginTop: '15px', opacity: variables.length === 0 ? 0.5 : 1}}
                >
                    <Trash2 size={18} /> Borrar Todo
                </button>
            </div>
        </div>
      )}

      {/* TABLA DE RESULTADOS */}
      <div className="vm-table-container">
        <div className="vm-table-header">
            <h3>Detalle de Bonos ({variables.length})</h3>
            
            {isAdmin ? (
               <input 
                  type="text" 
                  placeholder="Buscar RUT..." 
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="vm-search"
              />
            ) : (
              <div style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'0.85rem', color:'#64748b', background:'#f1f5f9', padding:'5px 10px', borderRadius:'6px'}}>
                 <UserCheck size={16}/> Usuario: <strong>{user?.nombre}</strong>
              </div>
            )}
        </div>

        <table className="vm-table">
            <thead>
                <tr>
                    <th>Colaborador</th>
                    <th>Tipo de Bono</th>
                    <th className="text-right">Meta ($)</th>
                    <th className="text-center">% Logro</th>
                    <th className="text-right">Total a Pagar</th>
                </tr>
            </thead>
            <tbody>
                {loading ? (
                    <tr><td colSpan="5" className="text-center">Cargando datos...</td></tr>
                ) : variablesFiltradas.length === 0 ? (
                    <tr><td colSpan="5" className="text-center" style={{padding: '40px'}}>
                        <AlertCircle style={{margin: '0 auto', display:'block', color:'#cbd5e1'}} size={40}/>
                        <p style={{marginTop:'10px', color:'#94a3b8'}}>
                           {isAdmin 
                             ? 'No hay registros cargados para este mes.' 
                             : `No se encontraron bonos para el RUT ${userRutLimpio}.`
                           }
                        </p>
                    </td></tr>
                ) : (
                    variablesFiltradas.map((item, index) => (
                        <tr key={index}>
                            <td>
                                <div className="font-bold">{item.nombre}</div>
                                <div style={{fontSize:'0.8rem', color:'#94a3b8'}}>{item.rut}</div>
                            </td>
                            <td>
                                {/* Badge dinámico según el tipo */}
                                <span className={getBadgeClass(item.tipo_bono)}>
                                    {item.tipo_bono}
                                </span>
                            </td>
                            <td className="text-right">{fmt(item.meta_monto)}</td>
                            <td className="text-center">
                                <span style={{fontWeight:'bold', color: item.porcentaje >= 100 ? '#059669' : '#d97706'}}>
                                    {item.porcentaje}%
                                </span>
                            </td>
                            <td className="text-right font-bold" style={{color: '#1e293b'}}>
                                {fmt(item.pago_real)}
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default VariablesManager;
