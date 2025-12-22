-- Agregar columna RUT a la tabla de usuarios
ALTER TABLE usuarios ADD COLUMN rut TEXT;

-- (Opcional) Actualizar al admin por defecto con un RUT genérico si lo deseas
UPDATE usuarios SET rut = '11.111.111-1' WHERE email = 'admin@pureba.cl';
