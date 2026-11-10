-- Los textos legales no van al menú de arriba por defecto (se tildan a mano si se quieren ahí)
UPDATE "Page" SET "showInMenu" = false WHERE "slug" IN ('terminos-y-condiciones', 'politica-de-privacidad', 'cambios-y-devoluciones', 'envios');
