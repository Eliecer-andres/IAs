// API Backend - Historial de Cambios de Turno
// Ruta: functions/api/cambios-turnos.js

export async function onRequestGet(context) {
    try {
        const db = context.env.DB;
        const url = new URL(context.request.url);
        const semanaId = url.searchParams.get('semana_id');
        const rut = url.searchParams.get('rut');

        let query = "SELECT * FROM cambios_turnos WHERE 1=1";
        const params = [];

        if (semanaId) {
            query += " AND semana_id = ?";
            params.push(semanaId);
        }

        if (rut) {
            query += " AND rut = ?";
            params.push(rut);
        }

        query += " ORDER BY fecha_solicitud DESC";

        const { results } = await db.prepare(query).bind(...params).all();

        return new Response(JSON.stringify(results), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const db = context.env.DB;
        const body = await context.request.json();

        const {
            rut, nombre, semana_id, estado,
            turno_original, turno_modificado
        } = body;

        if (!rut || !semana_id) {
            return new Response(JSON.stringify({ message: "Faltan datos obligatorios (RUT, Semana)" }), { status: 400 });
        }

        // Insertar registro de cambio
        await db.prepare(`
            INSERT INTO cambios_turnos (
                rut, nombre, semana_id, estado, 
                turno_original, turno_modificado, fecha_solicitud
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
            rut,
            nombre || 'Desconocido',
            semana_id,
            estado || 'Pendiente',
            typeof turno_original === 'string' ? turno_original : JSON.stringify(turno_original),
            typeof turno_modificado === 'string' ? turno_modificado : JSON.stringify(turno_modificado)
        ).run();

        return new Response(JSON.stringify({ message: "Cambio registrado exitosamente" }), { status: 201 });

    } catch (e) {
        return new Response(JSON.stringify({ error: "Error guardando cambio: " + e.message }), { status: 500 });
    }
}

export async function onRequestPut(context) {
    try {
        const db = context.env.DB;
        const body = await context.request.json();
        const { rut, semana_id, estado, turno_modificado } = body;

        if (!rut || !semana_id) {
            return new Response(JSON.stringify({ message: "RUT y Semana requeridos para actualizar" }), { status: 400 });
        }

        let query = "UPDATE cambios_turnos SET ";
        const params = [];
        const updates = [];

        if (estado) {
            updates.push("estado = ?");
            params.push(estado);
        }

        if (turno_modificado) {
            updates.push("turno_modificado = ?");
            params.push(typeof turno_modificado === 'string' ? turno_modificado : JSON.stringify(turno_modificado));
        }

        if (updates.length > 0) {
            query += updates.join(", ") + " WHERE rut = ? AND semana_id = ?";
            params.push(rut, semana_id);
            await db.prepare(query).bind(...params).run();
        }

        return new Response(JSON.stringify({ message: "Cambio actualizado exitosamente" }), { status: 200 });

    } catch (e) {
        return new Response(JSON.stringify({ error: "Error actualizando cambio: " + e.message }), { status: 500 });
    }
}

export async function onRequestDelete(context) {
    try {
        const db = context.env.DB;
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');
        const rut = url.searchParams.get('rut');
        const semanaId = url.searchParams.get('semana_id');

        if (id) {
            await db.prepare("DELETE FROM cambios_turnos WHERE id = ?").bind(id).run();
        } else if (rut && semanaId) {
            // Borrar todos los cambios (ej. limpiar mesa de trabajo) de un usuario en una semana
            await db.prepare("DELETE FROM cambios_turnos WHERE rut = ? AND semana_id = ?").bind(rut, semanaId).run();
        } else {
            return new Response(JSON.stringify({ message: "ID o (RUT + Semana) requeridos" }), { status: 400 });
        }

        return new Response(JSON.stringify({ message: "Registro eliminado" }), { status: 200 });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
