export async function onRequestPost(context) {
    try {
        const db = context.env.DB;
        const body = await context.request.json();
        const { updates } = body; // Array de { rut, fecha, lugar }

        if (!updates || updates.length === 0) {
            return new Response(JSON.stringify({ message: "No hay actualizaciones pendientes." }), { status: 200 });
        }

        // Preparamos las sentencias SQL
        // Usamos LIKE en la fecha para ser tolerantes con formatos que incluyan hora (YYYY-MM-DD%)
        const statements = updates.map(u => {
            return db.prepare("UPDATE turnos SET lugar = ? WHERE rut = ? AND fecha LIKE ?")
                     .bind(u.lugar, u.rut, `${u.fecha}%`);
        });

        // Ejecutamos en lote (Batch)
        // Nota: D1 tiene límites de tamaño de batch, si son más de 100 actualizaciones, 
        // Cloudflare recomienda dividirlas. Aquí hacemos un manejo básico de chunks por seguridad.
        
        const chunkSize = 50;
        for (let i = 0; i < statements.length; i += chunkSize) {
            const chunk = statements.slice(i, i + chunkSize);
            await db.batch(chunk);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Se actualizaron ${updates.length} registros en la tabla Turnos.` 
        }), { status: 200 });

    } catch (e) {
        return new Response(JSON.stringify({ error: "Error actualizando turnos: " + e.message }), { status: 500 });
    }
}
