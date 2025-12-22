-- Creación de tabla para historial de cambios de turno
CREATE TABLE IF NOT EXISTS cambios_turnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rut TEXT NOT NULL,
    nombre TEXT,
    semana_id TEXT NOT NULL, -- Identificador de la semana (ej: fecha del lunes)
    fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
    estado TEXT DEFAULT 'Aplicado', -- 'Pendiente', 'Aplicado'
    turno_original TEXT, -- Guardaremos el JSON del horario original
    turno_modificado TEXT -- Guardaremos el JSON del horario nuevo
);

-- Índice para búsquedas rápidas por semana o RUT
CREATE INDEX IF NOT EXISTS idx_cambios_semana ON cambios_turnos(semana_id);
CREATE INDEX IF NOT EXISTS idx_cambios_rut ON cambios_turnos(rut);
