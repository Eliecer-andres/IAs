// API Backend - Gestiona la base de datos D1
// Ruta de archivo: functions/api/turnos.js

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const getDates = url.searchParams.get('get_dates');

  try {
    const db = env.DB;

    // 1. Obtener lista de fechas disponibles para selectores
    if (getDates) {
        const { results } = await db.prepare("SELECT DISTINCT fecha FROM turnos WHERE fecha IS NOT NULL AND fecha != '' ORDER BY fecha DESC").all();
        return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    }

    // 2. Filtrar turnos por rango de fecha
    if (start && end) {
        const query = "SELECT * FROM turnos WHERE fecha >= ? AND fecha <= ? ORDER BY nombre ASC, fecha ASC";
        const { results } = await db.prepare(query).bind(start, end).all();
        return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

// Guardar turnos (Carga Masiva o Individual)
export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    const body = await context.request.json();
    
    const data = Array.isArray(body) ? body : [body];
    const statements = [];

    const sql = `
      INSERT INTO turnos (rut, lugar, nombre, estado, fecha, dia, ini, fin, dur_tur, desc_1, ini_cola, fin_cola, desc_2, dur_cola, hc, encargado, servicio)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM turnos WHERE rut = ? AND fecha = ?)
    `;

    for (const d of data) {
        if (!d.rut || !d.fecha) continue; 

        statements.push(db.prepare(sql).bind(
            d.rut, d.lugar || null, d.nombre || null, d.estado || 'Activo', d.fecha,
            d.dia || null, d.ini || null, d.fin || null, d.dur_tur || 0,
            d.desc_1 || null, d.ini_cola || null, d.fin_cola || null,
            d.desc_2 || null, d.dur_cola || 0, d.hc || 0, d.encargado || null, d.servicio || null,
            d.rut, d.fecha
        ));
    }

    if (statements.length === 0) {
        return new Response(JSON.stringify({ message: "No hay registros válidos para insertar o ya existían." }), { status: 400 });
    }

    await db.batch(statements);
    return new Response(JSON.stringify({ message: "Procesado correctamente", count: statements.length }), { status: 201 });

  } catch (e) {
    return new Response(JSON.stringify({ error: "Error en servidor: " + e.message }), { status: 500 });
  }
}

// --- NUEVO: ACTUALIZAR TURNO (PUT) ---
// Esto soluciona que la tabla de turnos no se actualice al aplicar cambios
export async function onRequestPut(context) {
    try {
        const db = context.env.DB;
        const body = await context.request.json();
        
        // Extraemos solo lo necesario para actualizar el horario
        // id es obligatorio para saber qué fila tocar
        const { id, ini, fin, dur_cola, estado } = body;

        if (!id) {
            return new Response(JSON.stringify({ error: "ID de turno requerido para actualizar" }), { status: 400 });
        }

        // Construcción dinámica de la query para permitir actualizar solo estado o solo horario
        let query = "UPDATE turnos SET ";
        const params = [];
        const updates = [];

        if (ini !== undefined) { updates.push("ini = ?"); params.push(ini); }
        if (fin !== undefined) { updates.push("fin = ?"); params.push(fin); }
        if (dur_cola !== undefined) { updates.push("dur_cola = ?"); params.push(dur_cola); }
        if (estado !== undefined) { updates.push("estado = ?"); params.push(estado); }

        if (updates.length === 0) {
            return new Response(JSON.stringify({ message: "Nada que actualizar" }), { status: 200 });
        }

        query += updates.join(", ") + " WHERE id = ?";
        params.push(id);

        await db.prepare(query).bind(...params).run();

        return new Response(JSON.stringify({ message: "Turno actualizado correctamente" }), { status: 200 });

    } catch (e) {
        return new Response(JSON.stringify({ error: "Error actualizando turno: " + e.message }), { status: 500 });
    }
}

// Eliminar Turno
export async function onRequestDelete(context) {
    try {
        const db = context.env.DB;
        const url = new URL(context.request.url);
        
        const id = url.searchParams.get('id');
        const fecha = url.searchParams.get('fecha'); 
        const start = url.searchParams.get('start');
        const end = url.searchParams.get('end');

        if (id) {
            await db.prepare("DELETE FROM turnos WHERE id = ?").bind(id).run();
        } else if (start && end) {
            await db.prepare("DELETE FROM turnos WHERE fecha >= ? AND fecha <= ?").bind(start, end).run();
        } else if (fecha) {
            await db.prepare("DELETE FROM turnos WHERE fecha = ?").bind(fecha).run();
        } else {
             return new Response(JSON.stringify({ message: "Parámetros insuficientes para eliminar" }), { status: 400 });
        }
        
        return new Response(JSON.stringify({ message: "Eliminado con éxito" }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
