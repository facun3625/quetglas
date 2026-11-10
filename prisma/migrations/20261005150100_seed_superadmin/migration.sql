-- El superadministrador de la instalación. Entra con Google (sin contraseña propia): al iniciar sesión con ese email,
-- la app reutiliza esta cuenta y respeta el rol guardado acá.
INSERT INTO "User" ("id", "name", "email", "role", "updatedAt")
VALUES ('superadmin-facundo', 'Facundo Arteaga', 'facundoarteagasola@gmail.com', 'superadmin', CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO UPDATE SET "role" = 'superadmin';
