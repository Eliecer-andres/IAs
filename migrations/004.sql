-- Migración para adaptar usuarios a login con RUT y Email Opcional

-- 1. Desactivar constraints de claves foráneas temporalmente
PRAGMA foreign_keys=off;

-- 2. Renombrar la tabla actual para respaldar datos
ALTER TABLE usuarios RENAME TO usuarios_old;

-- 3. Crear la nueva tabla con la estructura ideal
CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rut TEXT UNIQUE,          -- Nuevo: RUT único (clave de login para agentes)
    email TEXT,               -- Modificado: Ya no es NOT NULL (permite agentes sin correo)
    password TEXT NOT NULL,
    nombre TEXT,
    rol TEXT DEFAULT 'agente', -- Modificado: Default ahora es 'agente'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Migrar los datos antiguos a la nueva tabla
-- Nota: Solo migramos las columnas que existían en la tabla 0001
INSERT INTO usuarios (id, email, password, nombre, rol, created_at)
SELECT id, email, password, nombre, rol, created_at FROM usuarios_old;

-- 5. Eliminar la tabla antigua
DROP TABLE usuarios_old;

-- 6. Crear índices para búsquedas rápidas en login
CREATE INDEX IF NOT EXISTS idx_usuarios_rut ON usuarios(rut);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- 7. Asegurar que el Admin tenga un RUT (Genérico) para que pueda entrar
-- Actualiza esto con el RUT real del administrador si lo conoces
UPDATE usuarios SET rut = '111111111' WHERE email = 'admin@pureba.cl';

-- Reactivar constraints
PRAGMA foreign_keys=on;
