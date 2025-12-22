-- Tabla para guardar las solicitudes de transporte
CREATE TABLE IF NOT EXISTS confirmaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    semana TEXT NOT NULL,      -- Identificador de la semana (Ej: 2025-10-20)
    rut TEXT NOT NULL,         -- RUT del solicitante
    nombre TEXT,               -- Nombre del solicitante
    lunes INTEGER DEFAULT 0,   -- 1 = Si, 0 = No
    martes INTEGER DEFAULT 0,
    miercoles INTEGER DEFAULT 0,
    jueves INTEGER DEFAULT 0,
    viernes INTEGER DEFAULT 0,
    sabado INTEGER DEFAULT 0,
    domingo INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para buscar rápido por semana o por persona
CREATE INDEX IF NOT EXISTS idx_conf_rut ON confirmaciones(rut);
CREATE INDEX IF NOT EXISTS idx_conf_semana ON confirmaciones(semana);
