-- 1. Agregar columnas de autenticación a la tabla DIRECCION
ALTER TABLE direccion ADD COLUMN password TEXT;
ALTER TABLE direccion ADD COLUMN rol TEXT DEFAULT 'sin_acceso';

-- 2. Migrar credenciales existentes (Si el RUT coincide)
-- Copiamos password y rol de la tabla usuarios a direccion
UPDATE direccion 
SET 
    password = (SELECT password FROM usuarios WHERE usuarios.rut = direccion.rut),
    rol = (SELECT rol FROM usuarios WHERE usuarios.rut = direccion.rut)
WHERE EXISTS (SELECT 1 FROM usuarios WHERE usuarios.rut = direccion.rut);

-- 3. Eliminar la tabla de usuarios antigua (Ya no se necesita)
DROP TABLE usuarios;

-- 4. Asegurar que el Admin tenga acceso (ajusta el RUT si es necesario)
-- Si el admin no estaba en direcciones, insértalo o actualízalo
INSERT INTO direccion (rut, nombre, email, password, rol)
VALUES ('111111111', 'Administrador', 'admin@pureba.cl', '12345678', 'admin')
ON CONFLICT(rut) DO UPDATE SET rol = 'admin', password = '12345678';
