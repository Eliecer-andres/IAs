-- Tabla de Direcciones para Transporte
CREATE TABLE IF NOT EXISTS direccion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rut TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    direccion TEXT,
    fono TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
