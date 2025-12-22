export async function onRequestGet(context) {
    try {
        const db = context.env.DB;
        // Obtenemos todas las confirmaciones ordenadas por fecha de creación (más nuevas primero)
        const { results } = await db.prepare(
            "SELECT * FROM confirmaciones ORDER BY created_at DESC"
        ).all();

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
            semana, rut, nombre, 
            lunes, martes, miercoles, jueves, viernes, sabado, domingo 
        } = body;

        if (!semana || !rut) {
            return new Response(JSON.stringify({ message: "Faltan datos (Semana y RUT obligatorios)" }), { status: 400 });
        }

        // Insertamos la confirmación (convertimos booleanos a 1/0 para SQLite)
        await db.prepare(`
            INSERT INTO confirmaciones (semana, rut, nombre, lunes, martes, miercoles, jueves, viernes, sabado, domingo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            semana, rut, nombre,
            lunes ? 1 : 0, martes ? 1 : 0, miercoles ? 1 : 0,
            jueves ? 1 : 0, viernes ? 1 : 0, sabado ? 1 : 0, domingo ? 1 : 0
        ).run();

        return new Response(JSON.stringify({ message: "Solicitud guardada con éxito" }), { status: 201 });

    } catch (e) {
        return new Response(JSON.stringify({ error: "Error guardando: " + e.message }), { status: 500 });
    }
}
