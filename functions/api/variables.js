export async function onRequest(context) {
    const db = context.env.DB;
    const { request } = context;

    try {
        // --- GET: OBTENER VARIABLES ---
        if (request.method === "GET") {
            const url = new URL(request.url);
            const rut = url.searchParams.get("rut"); // Si viene rut, filtramos (vista agente)
            const mes = url.searchParams.get("mes");
            const anio = url.searchParams.get("anio");

            let query = "SELECT * FROM variables WHERE 1=1";
            const params = [];

            if (rut) {
                query += " AND rut = ?";
                params.push(rut);
            }
            if (mes) {
                query += " AND mes = ?";
                params.push(mes);
            }
            if (anio) {
                query += " AND anio = ?";
                params.push(anio);
            }

            query += " ORDER BY id DESC";

            const { results } = await db.prepare(query).bind(...params).all();
            return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
        }

        // --- POST: CARGA MASIVA (Solo Supervisor) ---
        if (request.method === "POST") {
            const data = await request.json();
            // data debe ser un array: [{ rut, nombre, mes, anio, tipo_bono, meta_monto, porcentaje, pago_real }, ...]

            if (!data || data.length === 0) {
                return new Response("No hay datos para guardar", { status: 400 });
            }

            // Construimos una inserción masiva (Batch Insert)
            // Nota: SQLite tiene límites, así que insertamos uno por uno en un batch para seguridad
            const stmt = db.prepare(`
                INSERT INTO variables (rut, nombre, mes, anio, tipo_bono, meta_monto, porcentaje, pago_real)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const batch = data.map(row => stmt.bind(
                row.rut, 
                row.nombre, 
                row.mes, 
                row.anio, 
                row.tipo_bono, 
                row.meta_monto, 
                row.porcentaje, 
                row.pago_real
            ));

            await db.batch(batch);

            return new Response(JSON.stringify({ success: true, count: data.length }), { 
                headers: { "Content-Type": "application/json" } 
            });
        }

        // --- DELETE: ELIMINAR REGISTROS (Por mes/año para limpiar cargas erróneas) ---
        if (request.method === "DELETE") {
            const url = new URL(request.url);
            const mes = url.searchParams.get("mes");
            const anio = url.searchParams.get("anio");
            
            if(!mes || !anio) return new Response("Falta mes/anio", { status: 400 });

            await db.prepare("DELETE FROM variables WHERE mes = ? AND anio = ?").bind(mes, anio).run();
            
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        }

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
