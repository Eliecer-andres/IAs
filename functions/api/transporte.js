/**
 * API Modular - Gestión de Transporte
 * Ruta: functions/api/transporte.js
 */

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    const db = env.DB;

    try {
        if (search) {
            const cleanSearch = search.trim();
            // Buscamos también por correo si es necesario
            const query = "SELECT * FROM direccion WHERE nombre LIKE ? OR rut LIKE ? OR correo LIKE ? ORDER BY nombre ASC";
            const { results } = await db.prepare(query)
                .bind(`%${cleanSearch}%`, `%${cleanSearch}%`, `%${cleanSearch}%`)
                .all();
            return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
        } else {
            const { results } = await db.prepare("SELECT * FROM direccion ORDER BY id DESC").all();
            return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
        }
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

// Crear nuevo (Unitario o Masivo)
export async function onRequestPost(context) {
    try {
        const db = context.env.DB;
        const body = await context.request.json();
        
        const data = Array.isArray(body) ? body : [body];
        const statements = [];

        // ACTUALIZADO: Incluye correo
        const sql = `
            INSERT INTO direccion (rut, nombre, direccion, fono, correo) 
            VALUES (?, ?, ?, ?, ?) 
            ON CONFLICT(rut) DO UPDATE SET 
                nombre = excluded.nombre,
                direccion = excluded.direccion,
                fono = excluded.fono,
                correo = excluded.correo
        `;

        for (const item of data) {
            let rutVal = null, nombreVal = null, dirVal = null, fonoVal = null, correoVal = null;

            // Mapeo Inteligente
            Object.keys(item).forEach(key => {
                const k = key.trim().toLowerCase();
                const v = item[key] ? String(item[key]).trim() : "";

                if (k === 'rut' || k === 'run' || k === 'identificador') rutVal = v;
                else if (k.includes('nombre') || k === 'trabajador') nombreVal = v;
                else if (k.includes('direccion') || k.includes('domicilio') || k === 'calle') dirVal = v;
                else if (k.includes('fono') || k.includes('telefono') || k.includes('celular')) fonoVal = v;
                else if (k === 'correo' || k === 'email' || k === 'mail') correoVal = v; // Nuevo
            });

            if (rutVal && nombreVal) {
                statements.push(db.prepare(sql).bind(
                    rutVal, 
                    nombreVal, 
                    dirVal || '', 
                    fonoVal || '',
                    correoVal || '' // Guardamos el correo
                ));
            }
        }

        if (statements.length > 0) {
            await db.batch(statements);
            return new Response(JSON.stringify({ message: "Procesado con éxito", count: statements.length }), { status: 201 });
        } else {
             return new Response(JSON.stringify({ message: "Datos inválidos (RUT y Nombre requeridos)" }), { status: 400 });
        }

    } catch (e) {
        return new Response(JSON.stringify({ error: "Error: " + e.message }), { status: 500 });
    }
}

// Editar (PUT)
export async function onRequestPut(context) {
    try {
        const db = context.env.DB;
        const body = await context.request.json();
        // Recibimos correo también
        const { id, rut, nombre, direccion, fono, correo } = body;

        if (!id) return new Response(JSON.stringify({ message: "ID requerido" }), { status: 400 });

        await db.prepare("UPDATE direccion SET rut=?, nombre=?, direccion=?, fono=?, correo=? WHERE id=?")
            .bind(rut, nombre, direccion, fono, correo, id)
            .run();

        return new Response(JSON.stringify({ message: "Actualizado con éxito" }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

// Eliminar (DELETE)
export async function onRequestDelete(context) {
    try {
        const db = context.env.DB;
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');

        if (!id) return new Response(JSON.stringify({ message: "ID requerido" }), { status: 400 });

        await db.prepare("DELETE FROM direccion WHERE id = ?").bind(id).run();
        
        return new Response(JSON.stringify({ message: "Eliminado con éxito" }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
