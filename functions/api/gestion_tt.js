export async function onRequestGet(context) {
    try {
        const db = context.env.DB;
        const url = new URL(context.request.url);
        const semana = url.searchParams.get('semana');

        if (semana) {
             // Obtener detalle completo (con JSON grande) si se pide una semana específica
             const { results } = await db.prepare("SELECT * FROM historico_tt WHERE semana = ?").bind(semana).all();
             return new Response(JSON.stringify(results[0] || null), { headers: { "Content-Type": "application/json" } });
        } else {
             // Listado ligero para la tabla (sin el JSON pesado)
             const { results } = await db.prepare("SELECT id, semana, fecha_generacion, usuario_generador, cantidad_agentes FROM historico_tt ORDER BY fecha_generacion DESC LIMIT 50").all();
             return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
        }
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const db = context.env.DB;
        const body = await context.request.json();
        const { semana, usuario, cantidad, datos } = body;

        // INSERT OR REPLACE: Si la semana ya existe (por el UNIQUE), la actualiza.
        await db.prepare(`
            INSERT OR REPLACE INTO historico_tt (semana, usuario_generador, cantidad_agentes, datos_generados, fecha_generacion) 
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `)
        .bind(semana, usuario || 'Sistema', cantidad || 0, JSON.stringify(datos))
        .run();

        return new Response(JSON.stringify({ message: "Historial registrado y datos guardados." }), { status: 201 });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
