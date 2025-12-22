export async function onRequestGet(context) {
    try {
        const db = context.env.DB;
        const url = new URL(context.request.url);
        const start = url.searchParams.get('start');
        const end = url.searchParams.get('end');

        let query = "SELECT * FROM cartas";
        const params = [];

        if (start && end) {
            query += " WHERE fecha BETWEEN ? AND ?";
            params.push(start, end);
        }
        
        query += " ORDER BY fecha DESC, id DESC";

        const { results } = await db.prepare(query).bind(...params).all();
        return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const db = context.env.DB;
        const body = await context.request.json();
        
        const { 
            rut, nombre, fecha, inicio_turno, fin_turno, 
            incidencia, atraso, tipo_carta, observacion, duracion 
        } = body;

        // Limpieza básica
        const cleanRut = rut.replace(/[\.\-]/g, '').trim().toLowerCase();

        await db.prepare(`
            INSERT INTO cartas (rut, nombre, fecha, inicio_turno, fin_turno, incidencia, atraso, tipo_carta, observacion, duracion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            cleanRut, nombre, fecha, inicio_turno, fin_turno, 
            incidencia, atraso, tipo_carta, observacion, duracion
        ).run();

        return new Response(JSON.stringify({ message: "Carta registrada con éxito" }), { status: 201 });

    } catch (e) {
        return new Response(JSON.stringify({ error: "Error guardando: " + e.message }), { status: 500 });
    }
}

export async function onRequestDelete(context) {
    try {
        const db = context.env.DB;
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');

        if (!id) return new Response(JSON.stringify({ message: "ID requerido" }), { status: 400 });

        await db.prepare("DELETE FROM cartas WHERE id = ?").bind(id).run();
        
        return new Response(JSON.stringify({ message: "Eliminado con éxito" }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
