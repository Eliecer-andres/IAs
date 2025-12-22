// Utilerías de tiempo extraídas de tu turnos.html
const timeToMinutes = (timeStr) => {
    if (!timeStr || timeStr === 'LIBRE') return null;
    // Soporta formatos HH:mm y HH:mm:ss
    const parts = timeStr.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
};
  
const minutesToTime = (minutes) => {
    if (minutes === null) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const addMinutes = (timeStr, minsToAdd) => {
    const total = timeToMinutes(timeStr);
    if (total === null) return '';
    return minutesToTime(total + minsToAdd);
};

// Reglas de negocio (Basadas en tu HTML)
const CONFIG = {
    CAPACIDAD_COLACION: 5,  // Máximo personas comiendo al mismo tiempo
    CAPACIDAD_BREAK: 5,     // Máximo personas en break
    DURACION_BREAK: 15,     // Minutos de break
    RANGO_COLACION_INICIO: 4, // Horas después del ingreso para empezar a comer
    RANGO_COLACION_FIN: 2,    // Horas antes de la salida para terminar de comer
};

// Función principal que recibe TODOS los turnos y los procesa día por día
export const processBreaksLogic = (turnos) => {
    // 1. Agrupar turnos por fecha (La capacidad es por día)
    const turnosPorDia = {};
    
    turnos.forEach(t => {
        // Normalizar fecha para agrupar
        let fechaKey = t.fecha || t.Fecha;
        if(!fechaKey) return;
        
        // Si es objeto fecha, convertir a string YYYY-MM-DD
        if (typeof fechaKey === 'object') {
             try { fechaKey = fechaKey.toISOString().split('T')[0]; } catch(e) {}
        }
        
        if (!turnosPorDia[fechaKey]) {
            turnosPorDia[fechaKey] = [];
        }
        turnosPorDia[fechaKey].push({ ...t }); // Copia del objeto para no mutar directo
    });

    const turnosProcesados = [];

    // 2. Procesar cada día independientemente
    Object.keys(turnosPorDia).forEach(dia => {
        const turnosDelDia = turnosPorDia[dia];
        
        // Trackers de capacidad para ESTE día
        const colacionCapacity = {}; // { "13:00": 3, "13:30": 2 ... }
        const breakCapacity = {};

        // Función auxiliar para verificar disponibilidad
        const checkSlot = (tracker, startMinutes, duration, maxCap) => {
            for (let i = 0; i < duration; i += 30) { // Revisamos cada 30 min
                const time = minutesToTime(startMinutes + i);
                if ((tracker[time] || 0) >= maxCap) return false;
            }
            return true;
        };

        const fillSlot = (tracker, startMinutes, duration) => {
            for (let i = 0; i < duration; i += 30) {
                const time = minutesToTime(startMinutes + i);
                tracker[time] = (tracker[time] || 0) + 1;
            }
        };

        // Procesar cada agente del día
        turnosDelDia.forEach(agente => {
            // Validar que tenga horario
            const ini = agente.ini || agente.Ini;
            const fin = agente.fin || agente.FIN;
            
            if (!ini || !fin || ini === 'LIBRE') {
                turnosProcesados.push(agente);
                return;
            }

            const iniMin = timeToMinutes(ini);
            const finMin = timeToMinutes(fin);
            let duracionJornada = (finMin - iniMin) / 60; // En horas
            if (duracionJornada < 0) duracionJornada += 24; // Turnos noche

            // Lógica de Colación (30 o 60 min)
            let duracionColacion = 0;
            if (duracionJornada >= 9) duracionColacion = 60;
            else if (duracionJornada >= 5) duracionColacion = 30;

            if (duracionColacion > 0) {
                // Definir ventana posible para colación
                const ventanaInicio = iniMin + (CONFIG.RANGO_COLACION_INICIO * 60);
                const ventanaFin = finMin - (CONFIG.RANGO_COLACION_FIN * 60) - duracionColacion;
                
                let mejorHoraInicio = null;

                // Buscar hueco disponible cada 30 min
                for (let t = ventanaInicio; t <= ventanaFin; t += 30) {
                    if (checkSlot(colacionCapacity, t, duracionColacion, CONFIG.CAPACIDAD_COLACION)) {
                        mejorHoraInicio = t;
                        break; // Encontramos el primer hueco disponible
                    }
                }

                // Si no hay hueco, forzamos el primero de la ventana (fallback)
                if (mejorHoraInicio === null) mejorHoraInicio = ventanaInicio;

                // Asignar y marcar ocupación
                fillSlot(colacionCapacity, mejorHoraInicio, duracionColacion);
                
                // Guardar en el objeto agente
                agente.ini_cola = minutesToTime(mejorHoraInicio);
                agente.fin_cola = minutesToTime(mejorHoraInicio + duracionColacion);
                agente.dur_cola = duracionColacion;
            }

            // Lógica de Breaks (15 min)
            // Break 1: Entre llegada y colación
            // Break 2: Entre colación y salida
            if (duracionJornada >= 9) {
                const colaIniMin = timeToMinutes(agente.ini_cola);
                
                // Calcular Break 1 (Idealmente 2 horas después de entrar)
                let b1Time = iniMin + 120; 
                // Ajustar si choca con colación
                if (b1Time + 15 >= colaIniMin) b1Time = iniMin + 60;
                
                agente.desc_1 = minutesToTime(b1Time);

                // Calcular Break 2 (Idealmente 2 horas después de colación)
                let b2Time = timeToMinutes(agente.fin_cola) + 120;
                // Ajustar si se pasa de la salida
                if (b2Time + 15 >= finMin) b2Time = finMin - 60;

                agente.desc_2 = minutesToTime(b2Time);
            }
            
            // Agregar al resultado final
            turnosProcesados.push(agente);
        });
    });

    return turnosProcesados;
};
