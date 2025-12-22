export async function onRequest(context) {
    // 1. Manejo de CORS (Preflight)
    if (context.request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        });
    }

    // 2. Encabezados de respuesta estándar
    const responseHeaders = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
    };

    try {
        // 3. Validación de Método
        if (context.request.method !== "POST") {
            return new Response(JSON.stringify({
                success: false,
                message: `Método ${context.request.method} no permitido. Use POST.`
            }), { status: 405, headers: responseHeaders });
        }

        const db = context.env.DB;

        // 4. Validación de D1 Database binding
        if (!db) {
            return new Response(JSON.stringify({
                success: false,
                message: "Error Crítico: No se detecta la base de datos (DB binding is null)."
            }), { status: 500, headers: responseHeaders });
        }

        // 5. Parseo del Body
        let body;
        try {
            body = await context.request.json();
        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                message: "Error al parsear JSON del body.",
                error: e.message
            }), { status: 400, headers: responseHeaders });
        }

        // 6. Lógica de Login (Existente)
        const datoUsuario = body.email || body.rut || body.correo || body.usuario || body.username;
        const datoPassword = body.password || body.clave || body.pass;

        if (!datoUsuario || !datoPassword) {
            return new Response(JSON.stringify({
                success: false,
                message: "Faltan datos de credenciales."
            }), { status: 400, headers: responseHeaders });
        }

        const rutLimpio = datoUsuario.toString().replace(/[^0-9kK]/g, '').toLowerCase();
        const passLimpia = datoPassword.toString().trim();

        // Query
        const { results } = await db.prepare("SELECT * FROM direccion").all();

        const usuario = results.find(u => {
            const uRut = (u.rut || '').toString().replace(/[^0-9kK]/g, '').toLowerCase();
            return uRut === rutLimpio;
        });

        if (usuario) {
            const passBD = (usuario.password || '').toString();
            if (passBD === passLimpia || passBD === rutLimpio) {
                return new Response(JSON.stringify({
                    success: true,
                    user: { ...usuario, password: '' }
                }), { status: 200, headers: responseHeaders });
            }
        }

        return new Response(JSON.stringify({
            success: false,
            message: "Datos incorrectos.",
            debug: { recibido: rutLimpio }
        }), { status: 401, headers: responseHeaders });

    } catch (e) {
        // 7. Catch Global: Asegura que NUNCA devuelva HTML, siempre JSON
        return new Response(JSON.stringify({
            success: false,
            message: "Error Interno del Servidor",
            error: e.message,
            stack: e.stack
        }), { status: 500, headers: responseHeaders });
    }
}
