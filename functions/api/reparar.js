export async function onRequestGet(context) {
    try {
        const db = context.env.DB;

        // 1. FORZAR LA CREACIÓN DEL USUARIO QUE ESTÁ INTENTANDO USAR
        // Insertamos o Actualizamos el usuario 192699654
        await db.prepare(`
            INSERT INTO direccion (rut, nombre, correo, password, rol)
            VALUES ('192699654', 'Usuario Rescate', 'rescate@prueba.cl', '192699654', 'admin')
            ON CONFLICT(rut) DO UPDATE SET 
                password = '192699654',
                rol = 'admin'
        `).run();

        // 2. LEER QUÉ HAY REALMENTE EN LA BASE DE DATOS
        const { results } = await db.prepare("SELECT * FROM direccion").all();

        return new Response(JSON.stringify({
            status: "Éxito - Usuario 192699654 creado/restaurado",
            mensaje: "Ahora puedes ir al login e ingresar.",
            datos_reales_en_base_de_datos: results
        }, null, 2), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
