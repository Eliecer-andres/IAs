export async function onRequest(context) {
    return new Response(JSON.stringify({ message: "pong", time: new Date().toISOString() }), {
        headers: { "Content-Type": "application/json" }
    });
}
