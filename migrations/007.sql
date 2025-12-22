-- Tabla para configuración de Teletrabajo por Agente
CREATE TABLE IF NOT EXISTS distribucion_tt (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rut TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    modalidad TEXT,            -- '4x1', '3x2', 'Especial'
    condicion_1 TEXT,          -- 'primer', 'segundo', etc.
    condicion_2 TEXT,
    condicion_3 TEXT,
    condicion_especial TEXT,   -- 'pm_tt,noche_tt', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para historial de reportes generados (Gestión TT)
-- MODIFICADO: Agregamos UNIQUE a semana y columna de datos_generados
CREATE TABLE IF NOT EXISTS historico_tt (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    semana TEXT NOT NULL UNIQUE, -- Clave única para permitir sobrescritura (REPLACE)
    datos_generados TEXT,        -- JSON con el detalle generado (RUT, Días, Estado)
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_generador TEXT,    -- Quién generó el reporte
    cantidad_agentes INTEGER   -- Cuántos agentes se procesaron
);
