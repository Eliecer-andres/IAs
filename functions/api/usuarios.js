export async function onRequestGet(context) {
    const db = context.env.DB;
    // Seleccionamos todo de la tabla direccion
    const { results } = await db.prepare("SELECT * FROM direccion ORDER BY nombre ASC").all();
    return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
}

export async function onRequestPost(context) {
    // Crear nuevo usuario manualmente
    try {
        const db = context.env.DB;
        const { rut, nombre, correo, password, rol, direccion, fono } = await context.request.json();
        const cleanRut = rut.replace(/[\.\-]/g, '');

        await db.prepare(`
            INSERT INTO direccion (rut, nombre, correo, password, rol, direccion, fono) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(cleanRut, nombre, correo, password, rol || 'agente', direccion || '', fono || '').run();

        return new Response(JSON.stringify({ message: "Usuario creado" }), { status: 201 });
    } catch (e) {
        return new Response(JSON.stringify({ error: "Error: RUT duplicado o datos inválidos." }), { status: 500 });
    }
}

export async function onRequestPut(context) {
    // Editar usuario existente
    try {
        const db = context.env.DB;
        const body = await context.request.json();
        const { id, nombre, direccion, fono, correo, rol, password } = body;

        let query = "UPDATE direccion SET nombre=?, direccion=?, fono=?, correo=?, rol=? WHERE id=?";
        const params = [nombre, direccion, fono, correo, rol, id];

        // Si viene password, lo actualizamos también (Reset de contraseña)
        if (password) {
            query = "UPDATE direccion SET nombre=?, direccion=?, fono=?, correo=?, rol=?, password=? WHERE id=?";
            params.splice(5, 0, password); // Insertamos password en los params
        }

        await db.prepare(query).bind(...params).run();

        return new Response(JSON.stringify({ message: "Datos actualizados" }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function onRequestDelete(context) {
    const db = context.env.DB;
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    
    // Eliminación física del registro
    await db.prepare("DELETE FROM direccion WHERE id = ?").bind(id).run();
    return new Response(JSON.stringify({ message: "Registro eliminado" }));
}
