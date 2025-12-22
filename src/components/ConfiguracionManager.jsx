import React, { useState, useEffect } from 'react';
import { Settings, Trash2, Calendar, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

// --- UTILIDADES ---
const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const formatDateDB = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function ConfiguracionManager() {
  const [weeksList, setWeeksList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null); // ID de la semana que se está borrando
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchWeeks();
  }, []);

  const fetchWeeks = async () => {
    setLoading(true);
    try {
        // 1. Obtener todas las fechas distintas de la BD
        const res = await fetch('/api/turnos?get_dates=true');
        const dates = await res.json();
        
        const weeksMap = new Map();
        
        // 2. Agrupar fechas en semanas
        dates.forEach(d => {
            if(!d.fecha) return;
            // Ajuste zona horaria seguro
            const dateObj = new Date(d.fecha.length === 10 ? d.fecha + 'T00:00:00' : d.fecha);
            const monday = getMonday(dateObj);
            const key = formatDateDB(monday); // La clave es el Lunes
            
            if (!weeksMap.has(key)) {
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                
                const label = `Semana del ${monday.getDate()} al ${sunday.getDate()} de ${monday.toLocaleString('es-ES', {month:'long'})} ${monday.getFullYear()}`;
                
                weeksMap.set(key, { 
                    id: key, 
                    label, 
                    start: formatDateDB(monday), 
                    end: formatDateDB(sunday),
                    year: monday.getFullYear()
                });
            }
        });

        // Convertir a array y ordenar (más recientes primero)
        const sortedWeeks = Array.from(weeksMap.values()).sort((a,b) => b.id.localeCompare(a.id));
        setWeeksList(sortedWeeks);

    } catch (error) {
        console.error(error);
        setNotification({ type: 'error', message: 'Error cargando datos.' });
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteWeek = async (weekObj) => {
      const confirmMsg = `⚠️ PELIGRO ⚠️\n\n¿Estás seguro de que quieres ELIMINAR TODOS LOS TURNOS de la ${weekObj.label}?\n\nEsta acción no se puede deshacer.`;
      
      if (!window.confirm(confirmMsg)) return;

      setDeletingId(weekObj.id);
      
      try {
          const res = await fetch(`/api/turnos?start=${weekObj.start}&end=${weekObj.end}`, {
              method: 'DELETE'
          });

          if (res.ok) {
              setNotification({ type: 'success', message: 'Semana eliminada correctamente.' });
              // Recargar la lista
              await fetchWeeks();
          } else {
              throw new Error("Error en el servidor al eliminar.");
          }
      } catch (error) {
          setNotification({ type: 'error', message: error.message });
      } finally {
          setDeletingId(null);
          setTimeout(() => setNotification(null), 4000);
      }
  };

  return (
    <div className="section-container">
      {notification && (
        <div style={{
          position: 'fixed', bottom: '30px', right: '30px', zIndex: 1000,
          background: notification.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: notification.type === 'success' ? '#166534' : '#991b1b',
          padding: '12px 24px', borderRadius: '8px', fontWeight: '600',
          display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {notification.message}
        </div>
      )}

      <div className="top-bar" style={{justifyContent: 'space-between', marginBottom: '20px'}}>
        <h1 style={{margin:0, fontSize:'1.5rem', fontWeight:'700', color:'#0f172a', display:'flex', alignItems:'center', gap:'10px'}}>
            <Settings color="#3b82f6" /> Configuración del Sistema
        </h1>
      </div>

      <div className="table-card">
        <div className="top-bar" style={{margin:0, borderBottom:'1px solid #e2e8f0', borderRadius:0, padding:'20px', background:'#fff'}}>
            <h3 style={{margin:0, fontSize:'1.1rem', display:'flex', alignItems:'center', gap:'10px'}}>
                <Calendar size={20} className="text-slate-500"/> 
                Gestión de Semanas Cargadas
            </h3>
            <p style={{margin:'5px 0 0 30px', color:'#64748b', fontSize:'0.9rem'}}>
                Aquí puedes eliminar semanas completas de turnos si fueron cargadas por error o son antiguas.
            </p>
        </div>

        <div className="table-wrapper">
          <table className="modern-table">
            <thead>
                <tr>
                    <th>Semana Identificada</th>
                    <th>Inicio (Lunes)</th>
                    <th>Fin (Domingo)</th>
                    <th>Año</th>
                    <th style={{textAlign:'center'}}>Acciones</th>
                </tr>
            </thead>
            <tbody>
                {loading ? (
                    <tr><td colSpan="5" style={{textAlign:'center', padding:'40px'}}><Loader2 className="spin" style={{margin:'0 auto'}}/></td></tr>
                ) : weeksList.length === 0 ? (
                    <tr><td colSpan="5" style={{textAlign:'center', padding:'40px', color:'#94a3b8'}}>No hay turnos cargados en el sistema.</td></tr>
                ) : (
                    weeksList.map(week => (
                        <tr key={week.id} className="hover-row">
                            <td style={{fontWeight:'500'}}>{week.label}</td>
                            <td style={{fontFamily:'monospace', color:'#64748b'}}>{week.start}</td>
                            <td style={{fontFamily:'monospace', color:'#64748b'}}>{week.end}</td>
                            <td>{week.year}</td>
                            <td style={{textAlign:'center'}}>
                                <button 
                                    onClick={() => handleDeleteWeek(week)}
                                    disabled={deletingId === week.id}
                                    className="btn btn-danger"
                                    style={{padding:'8px 12px', fontSize:'0.85rem', display:'inline-flex', gap:'6px'}}
                                >
                                    {deletingId === week.id ? <Loader2 className="spin" size={16}/> : <Trash2 size={16}/>}
                                    {deletingId === week.id ? 'Eliminando...' : 'Eliminar Semana'}
                                </button>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
          </table>
        </div>
      </div>
      <style>{` .spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } } `}</style>
    </div>
  );
}
