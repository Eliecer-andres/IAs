-- 1. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nombre TEXT,
    rol TEXT DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserción del usuario Admi solicitado
INSERT OR IGNORE INTO usuarios (email, password, nombre, rol) 
VALUES ('admin@pureba.cl', '12345678', 'Administrador', 'admin');

-- 2. Tabla de Turnos (Estructura basada en imagen)
CREATE TABLE IF NOT EXISTS turnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rut TEXT,
    lugar TEXT,
    nombre TEXT,
    estado TEXT,
    fecha TEXT,
    dia TEXT,
    ini TEXT,
    fin TEXT,
    dur_tur REAL,
    desc_1 TEXT,
    ini_cola TEXT,
    fin_cola TEXT,
    desc_2 TEXT,
    dur_cola REAL,
    hc INTEGER,
    encargado TEXT,
    servicio TEXT
);
