export async function onRequestGet(context) {
    try {
        const db = context.env.DB;
        const { results } = await db.prepare("SELECT * FROM distribucion_tt ORDER BY nombre ASC").all();
        return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const db = context.env.DB;
        const body = await context.request.json();
        const { rut, nombre, modalidad, condicion_1, condicion_2, condicion_3, condicion_especial } = body;

        // Limpieza básica
        const cleanRut = rut.replace(/[\.\-]/g, '').toLowerCase();

        await db.prepare(`
            INSERT INTO distribucion_tt (rut, nombre, modalidad, condicion_1, condicion_2, condicion_3, condicion_especial)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(rut) DO UPDATE SET 
                nombre = excluded.nombre,
                modalidad = excluded.modalidad,
                condicion_1 = excluded.condicion_1,
                condicion_2 = excluded.condicion_2,
                condicion_3 = excluded.condicion_3,
                condicion_especial = excluded.condicion_especial
        `).bind(cleanRut, nombre, modalidad, condicion_1, condicion_2, condicion_3, condicion_especial).run();

        return new Response(JSON.stringify({ message: "Configuración guardada" }), { status: 201 });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function onRequestDelete(context) {
    try {
        const db = context.env.DB;
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');
        
        await db.prepare("DELETE FROM distribucion_tt WHERE id = ?").bind(id).run();
        return new Response(JSON.stringify({ message: "Eliminado" }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
