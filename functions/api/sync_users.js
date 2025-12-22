export async function onRequestPost(context) {
    try {
        const db = context.env.DB;

        // 1. Obtener todos los usuarios actuales (solo sus RUTs para comparar)
        // Usamos una limpieza básica en SQL si es posible, o traemos todo y filtramos en JS.
        const usersResult = await db.prepare("SELECT rut FROM usuarios").all();
        const existingRuts = new Set(usersResult.results.map(u => u.rut ? u.rut.replace(/[\.\-]/g, '') : ''));

        // 2. Obtener todas las direcciones (posibles nuevos usuarios)
        const dirResult = await db.prepare("SELECT rut, nombre, correo FROM direccion WHERE rut IS NOT NULL").all();

        const newUsers = [];
        const statements = [];

        // 3. Detectar quién falta
        for (const persona of dirResult.results) {
            const rawRut = persona.rut;
            const cleanRut = rawRut.replace(/[\.\-]/g, ''); // Quitamos puntos y guión

            if (cleanRut.length > 3 && !existingRuts.has(cleanRut)) {
                // Si no existe, preparamos la inserción
                // Contraseña inicial = RUT limpio
                statements.push(
                    db.prepare("INSERT INTO usuarios (rut, nombre, email, password, rol) VALUES (?, ?, ?, ?, ?)")
                    .bind(cleanRut, persona.nombre, persona.correo || '', cleanRut, 'agente')
                );
                existingRuts.add(cleanRut); // Evitar duplicados en la misma ejecución
                newUsers.push(persona.nombre);
            }
        }

        // 4. Ejecutar inserciones masivas si hay nuevos
        if (statements.length > 0) {
            await db.batch(statements);
            return new Response(JSON.stringify({ 
                message: "Sincronización completada", 
                added: statements.length, 
                details: newUsers 
            }), { status: 200 });
        } else {
            return new Response(JSON.stringify({ 
                message: "No hay usuarios nuevos para migrar", 
                added: 0 
            }), { status: 200 });
        }

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
