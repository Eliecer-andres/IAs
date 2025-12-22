-- Tabla para el módulo de Cartas de Amonestación/Compromiso
CREATE TABLE IF NOT EXISTS cartas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rut TEXT NOT NULL,
    nombre TEXT NOT NULL,
    fecha DATE NOT NULL,
    inicio_turno TEXT,
    fin_turno TEXT,
    incidencia TEXT,        -- 'Atrasos', 'Ausencia', 'Abandono', 'Otro'
    atraso TEXT,            -- Tiempo de atraso (Ej: 00:15)
    tipo_carta TEXT,        -- 'Amonestacion', 'Compromiso', 'Justificacion'
    observacion TEXT,
    duracion TEXT,          -- Duración en texto (Ej: '15 minutos')
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cartas_fecha ON cartas(fecha);
CREATE INDEX IF NOT EXISTS idx_cartas_rut ON cartas(rut);
