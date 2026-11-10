#!/usr/bin/env python3
"""Arma el manual del panel (HTML de un solo archivo, capturas incrustadas) -> src/content/manual-tienda-modelo.html
Uso: python3 docs/manual/build-manual.py
Las capturas salen de docs/manual/shots (ver capturas.cjs / capturas-2.cjs). El texto es genérico: "tienda modelo"."""
import base64, html, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "src", "content", "manual-tienda-modelo.html")
CSS = open(os.path.join(HERE, "manual.css")).read()
used = set()


def webp_size(path):
    from PIL import Image
    with Image.open(path) as im:
        return im.size


def shot(name, path="", cls="", alt=""):
    f = os.path.join(HERE, "shots", name + ".webp")
    if not os.path.exists(f):
        sys.exit("Falta la captura: " + name)
    used.add(name)
    b64 = base64.b64encode(open(f, "rb").read()).decode()
    # medidas reales de la captura: el navegador reserva el alto antes de decodificarla y los enlaces internos caen justo
    w, h = webp_size(f)
    url = f'<span style="margin-left:.6rem;font-size:.7rem;color:rgba(255,255,255,.55)">{html.escape(path)}</span>' if path else ""
    return (f'<div class="shot {cls}"><div class="bar"><span></span><span></span><span></span>{url}</div>'
            f'<img alt="{html.escape(alt or name)}" width="{w}" height="{h}" decoding="async" src="data:image/webp;base64,{b64}"></div>')


def sub(title, desc, name, path="", cls=""):
    return f'<div class="subshot"><h3>{title}</h3><p class="sub-desc">{desc}</p>{shot(name, path, cls, title)}</div>'


def points(items, label="Qué podés hacer"):
    lis = "".join(f"<li>{i}</li>" for i in items)
    return f'<div class="keypoints"><div class="keypoints-label">{label}</div><ul class="checks">{lis}</ul></div>'


def callout(*ps):
    return '<div class="callout">' + "".join(f"<p>{p}</p>" for p in ps) + "</div>"


def steps(items):
    return '<ol class="steps">' + "".join(f"<li>{i}</li>" for i in items) + "</ol>"


def table(head, rows):
    h = "".join(f"<th>{c}</th>" for c in head)
    r = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>" for row in rows)
    return f'<div class="tw"><table class="t"><thead><tr>{h}</tr></thead><tbody>{r}</tbody></table></div>'


def panel(id, title, path, summary, body):
    p = f'<span class="panel-path">{path}</span>' if path else ""
    return (f'<section class="panel" id="{id}"><div class="panel-head"><h2>{title}</h2>{p}</div>'
            f'<p class="panel-summary">{summary}</p>{body}</section>')


# (grupo, [(id, título, es_sub)])
TOC = [("Empezar", [("intro", "Cómo entrar", False)])]
SECTIONS = []
TOC_FLAT = []


def add(group, id, title, path, summary, body, sub_=False):
    TOC_FLAT.append((group, id, title, sub_))
    g = next((x for x in TOC if x[0] == group), None)
    if g is None:
        g = (group, [])
        TOC.append(g)
    g[1].append((id, title, sub_))
    SECTIONS.append((group, id, panel(id, title, path, summary, body)))


G1, G2, G3, G4, G5, G6, G7, G8 = "Empezar", "Catálogo", "Ventas del día a día", "Recuperar clientes", "Reglas de la tienda", "Aspecto y contenido", "Clientes y equipo", "Configuración"
# Segunda parte del manual: lo que hace quien compra (el usuario de la tienda)
G9 = "Lo que hace el comprador"

# ------------------------------------------------------------------ EMPEZAR
add(G1, "inicio", "Inicio", "/admin/inicio",
    "Es lo primero que ves al entrar: cómo viene el día de un vistazo y atajos a lo que más se usa.",
    shot("inicio", "/admin/inicio") + points([
        "Ver las ventas y los pedidos del período, y lo que está pendiente de atender.",
        "Crear un <b>cupón rápido</b> sin salir de la pantalla (porcentaje, vigencia y, si querés, mandarlo por WhatsApp).",
        "Entrar a cualquier sección desde el menú de la izquierda.",
        "Buscar una sección del panel escribiendo su nombre (atajo <code>Ctrl</code>/<code>⌘</code> + <code>K</code>).",
    ]) + callout("<b>El menú está ordenado en grupos que se despliegan:</b> <b>Catálogo</b> (productos, categorías, atributos, etiquetas), <b>Ventas</b>, <b>Estadísticas</b> (de ventas y visitas), <b>Clientes y usuarios</b> (clientes, administradores, segmentos, suscriptores, puntos), <b>Tienda</b> (pagos, envíos, cupones, temas, páginas y contacto) y <b>Recuperar clientes</b> (carritos y lista de espera). Mailing, Notificaciones, Conversaciones IA y Mensajes están sueltos, y Configuración al final. Tocá el nombre de un grupo para abrirlo o cerrarlo: se mantiene abierto uno solo a la vez (al abrir otro, el anterior se cierra) y el panel abre solo el de la pantalla en la que estás. Los números rojos (pedidos nuevos, mensajes, consultas de la IA) se ven siempre.") + sub("Buscador del panel", "Escribí parte del nombre y el panel te lleva directo. Sirve para no recorrer el menú.", "buscador-panel", "", "narrow")
    + sub("La campanita", "Avisa cuando entra un pedido nuevo, un mensaje o una consulta de la vendedora IA. Al abrirla se marcan como vistos.", "campanita", "", "mid"))

add(G9, "pwa", "Descargar la web app", "Botón “Descargar Web App”",
    "La tienda se puede instalar en el celular o en la computadora como una aplicación, sin pasar por ninguna tienda de apps. Se llama web app progresiva (PWA): es la misma tienda, pero con ícono propio, pantalla completa y avisos (notificaciones).",
    shot("tienda-movil", "Tienda en el celular", "narrow") +
    '<h3 class="sec">Cómo la instala el cliente</h3>' + table(["Dispositivo", "Pasos"], [
        ["<b>Android</b> (Chrome)", "Tocar el ícono de descarga que aparece arriba, junto al carrito (“Descargar Web App”) y confirmar <b>Instalar</b>. Chrome también la ofrece desde su menú ⋮ → <i>Instalar app</i>."],
        ["<b>iPhone / iPad</b>", "Abrir la tienda en <b>Safari</b> (desde Chrome o Firefox del iPhone no se puede instalar), tocar el botón <b>Compartir</b> y elegir <b>Agregar a pantalla de inicio</b>. El botón de la tienda muestra este mismo paso a paso."],
        ["<b>Computadora</b> (Chrome / Edge)", "Usar el mismo botón o el ícono de instalar que aparece a la derecha de la barra de direcciones."],
    ]) + callout("Cuando la app ya está instalada, el botón de descarga desaparece y, en su lugar, al final de la página se ve el estado de las notificaciones (más abajo). Si el navegador no permite instalar, la tienda lo avisa en lugar de no hacer nada.") +
    '<h3 class="sec">Ícono y nombre de la app</h3>' + points([
        "<b>El ícono</b> sale del <b>Favicon</b> que cargues en Configuración → General (no del logo del encabezado). La tienda lo adapta sola a todos los tamaños, también para iPhone y para las notificaciones. Subí una imagen cuadrada de 512×512.",
        "<b>El nombre</b> debajo del ícono es el <b>Nombre de la franquicia</b> de Configuración → Franquicia.",
        "Si cambiás el favicon o el nombre, quienes ya instalaron la app lo ven la próxima vez que la abran (a veces hace falta cerrarla del todo y volver a abrirla).",
    ], "Qué usa la app") +
    '<h3 class="sec">Notificaciones: cómo se activan</h3>'
    '<p class="panel-summary">Para recibir avisos, la persona tiene que <b>aceptar el permiso</b> del navegador. Cada celular o computadora que lo acepta es un “suscripto” en <a href="#notificaciones">Notificaciones</a>.</p>' +
    steps([
        "<b>Android y computadora:</b> al tocar <b>Descargar Web App</b>, el navegador pide permiso para mostrar avisos. Si lo acepta, queda suscripto.",
        "<b>iPhone:</b> la persona instala la app (Compartir → Agregar a pantalla de inicio) y la <b>abre desde el ícono</b>. A los pocos segundos aparece el cartelito <i>“¿Querés enterarte de las ofertas?”</i>: al tocar <b>Activar</b>, el iPhone pide el permiso. En iPhone esto es obligatorio: el permiso solo se puede pedir desde dentro de la app instalada y con un toque.",
        "Si toca <b>Ahora no</b>, el cartelito no vuelve a aparecer por 14 días. Puede activarlas cuando quiera con el botón del pie.",
    ]) + sub("El cartelito dentro de la app instalada", "Aparece una sola vez por visita y no tapa el carrito ni el panel.", "pwa-cartelito", "", "narrow") +
    sub("El estado en el pie de la app", "Siempre se puede activar desde acá y sirve para saber en qué estado está cada celular.", "pwa-pie", "", "narrow") +
    table(["Lo que dice el pie", "Qué significa"], [
        ["<b>🔔 Activar notificaciones</b> (botón)", "Todavía no aceptó. Al tocarlo, el dispositivo pide el permiso."],
        ["<b>🔔 Notificaciones activadas</b>", "Todo listo: ese dispositivo recibe los avisos."],
        ["<b>Las notificaciones están bloqueadas…</b>", "Había rechazado el permiso. Hay que cambiarlo en los Ajustes del teléfono → Notificaciones, buscando la app."],
        ["<b>Este dispositivo no permite notificaciones</b>", "En iPhone hace falta iOS 16.4 o más nuevo, y la app instalada desde Safari."],
    ]) +
    '<h3 class="sec">Si una persona no recibe avisos</h3>' + points([
        "Que la app esté <b>instalada</b> y abierta desde el ícono de la pantalla de inicio (en iPhone, no desde Safari).",
        "Que sea <b>iOS 16.4 o más nuevo</b> (Ajustes → General → Información).",
        "Que el permiso no esté bloqueado: mirá el mensaje del pie de la app.",
        "Cerrar la app del todo (deslizar hacia arriba desde el selector de apps) y volver a abrirla, para que cargue la última versión.",
        "En <a href=\"#notificaciones\">Notificaciones</a>, el número de <b>Suscriptos</b> sube cuando alguien acepta. Si sigue en 0, nadie llegó a aceptar el permiso.",
    ], "Revisar") +
    callout("<b>Para el administrador:</b> las claves de envío se generan solas, no hay nada que configurar. Solo hace falta que el sitio use <b>https</b> y que en Configuración haya un mail de contacto o de remitente. Los dispositivos que desinstalan la app o bloquean los avisos se quitan solos de la lista."))

# ------------------------------------------------------------------ TIENDA PÚBLICA
add(G9, "front-navegar", "Navegar y buscar", "/",
    "Así recorre la tienda quien entra sin cuenta: el inicio, las categorías y el buscador. No hace falta registrarse para mirar ni para comprar.",
    shot("tienda-home", "/") + points([
        "<b>Inicio:</b> portada con slider, franja de beneficios, rubros, ofertas y productos destacados. Todo se arma desde el panel (Temas, Configuración y Productos).",
        "<b>Menú de arriba:</b> Inicio, Dónde estamos, Contacto, las páginas que publiques y el botón <b>Tienda</b>. En el celular se abre con el botón de las tres rayitas.",
        "<b>Categorías:</b> en la Tienda, a la izquierda (primero las categorías, con subcategorías que se despliegan), sin mostrar cuántos productos hay en cada una. Los productos con existencia se muestran primero.",
        "<b>Filtros:</b> por categoría, por texto (buscador del listado), por etiqueta (Nuevo, Oferta, Regalo…) y “solo ofertas”.",
    ]) + sub("Buscador con sugerencias", "Al escribir tres letras o más aparecen los productos que coinciden, con su foto y precio. Un toque lleva a la búsqueda.", "front-buscador", "", "mid")
    + sub("Listado de la tienda", "Categorías a la izquierda, buscador y productos en tarjetas con precio y botón para agregar.", "tienda-listado")
    + sub("En el celular", "El menú se abre a pantalla completa, con los datos de contacto y los botones de WhatsApp e Instagram.", "front-menu-movil", "", "narrow"))

add(G9, "front-producto", "Ficha del producto", "/producto/…",
    "La página de cada producto: fotos o video, precio, variantes, existencia y el botón de compra.",
    shot("tienda-ficha", "/producto/mochila-urbana") + points([
        "<b>Galería:</b> varias fotos y, si el producto lo tiene, un <b>video</b>. Se puede ampliar la imagen.",
        "<b>Precio:</b> con el precio anterior tachado cuando hay oferta.",
        "<b>Variantes:</b> si el producto viene en talles o colores, se elige cada opción antes de agregar; el precio y la existencia cambian según la variante elegida.",
        "<b>Cantidad:</b> se elige con los botones − y +, y no deja pasar de la existencia disponible.",
        "<b>Favoritos:</b> el corazón guarda el producto en <b>Mis favoritos</b> (hace falta tener una sesión iniciada).",
        "<b>Productos relacionados</b> al final de la página.",
    ]) + sub("Producto con variantes", "El botón “Elegí una opción” se activa cuando están elegidas todas las opciones.", "front-ficha-variable")
    + sub("Sin existencia: “Avisarme cuando haya stock”", "En un producto agotado el comprador deja nombre, email y, si quiere, teléfono. Queda en la <a href=\"#lista-espera\">lista de espera</a> del panel y se le avisa cuando se repone.", "front-avisarme", "", "mid"))

add(G9, "front-acceso", "Crear cuenta e ingresar", "Ícono de la persona, arriba a la derecha",
    "Se puede comprar sin cuenta, pero con una cuenta el comprador guarda sus pedidos, direcciones, favoritos y puntos.",
    sub("Ingresar", "Con email y contraseña o con un toque en <b>Continuar con Google</b>.", "front-login", "", "narrow")
    + sub("Crear cuenta", "Nombre, email y una contraseña de al menos 8 caracteres; o directamente con Google.", "front-registro", "", "narrow") + points([
        "<b>Con Google:</b> no hace falta crear contraseña. La cuenta queda creada con su mail de Google.",
        "<b>¿Olvidaste tu contraseña?</b> El link del formulario manda un mail para crear una nueva; el enlace dura 1 hora.",
        "Una cuenta creada con Google no tiene contraseña: se entra siempre con Google (o se crea una desde “Olvidé mi contraseña”).",
        "El panel de administración usa las mismas cuentas: si una persona es administradora, ve además un acceso al panel en el menú.",
    ], "Qué hay que saber"))

add(G9, "front-carrito", "Carrito", "Ícono del carrito",
    "Se abre al agregar un producto y se cierra solo a los pocos segundos. Se guarda en el navegador, así que no se pierde al cerrar la página.",
    shot("front-carrito-drawer", "Carrito lateral") + points([
        "Cambiar cantidades con − y +, o quitar un producto. No deja superar la existencia (se muestra “Stock máx.”).",
        "<b>“También te puede gustar”:</b> sugerencias para sumar con un toque.",
        "<b>Finalizar compra</b> lleva a la página del pedido.",
        "Si la persona deja productos sin comprar, el carrito queda en <a href=\"#carritos\">Carritos abandonados</a> y puede recuperarlo desde un link que le llega por mail o WhatsApp: vuelve a cargar los productos, con los precios y la existencia de hoy.",
    ]))

add(G9, "front-comprar", "Finalizar la compra", "/carrito",
    "Todo el pedido en una sola página: datos, medio de pago, envío y cupón, con el resumen y el total a la derecha.",
    shot("front-checkout-b", "/carrito", "") + points([
        "<b>Datos:</b> nombre, email y teléfono. Si tiene sesión iniciada, se completan solos.",
        "<b>Medio de pago:</b> aparecen solo los que estén activos en <a href=\"#pagos\">Pagos</a>: Mercado Pago, tarjeta, transferencia, contra entrega o “coordinar el pago con la tienda”. Cada uno puede traer un descuento (por ejemplo 10% off por transferencia), que se ve en el resumen.",
        "<b>Transferencia:</b> se muestran los datos de la cuenta y hay que adjuntar el comprobante (obligatorio).",
        "<b>Envío:</b> con el código postal se calculan las opciones: OCA a domicilio o a sucursal, retiro en el local, cadetería o envío a acordar. Si la zona está restringida, se avisa que no se puede vender ahí. Quien tiene sesión puede elegir una dirección guardada y tildar “Guardar dirección” para la próxima vez.",
        "<b>Envío gratis:</b> desde el monto que defina la tienda o con un cupón que lo incluya; se ve el aviso en la página.",
        "<b>Cupón:</b> se escribe el código y se aplica; si no sirve para ese medio de pago o ya venció, lo explica.",
        "<b>Resumen:</b> productos, descuentos, envío y <b>total a pagar</b>. <b>Confirmar pedido</b> cierra la compra.",
    ]) + sub("Al abrir la página", "Primero se ven los productos del carrito y el botón Finalizar compra.", "front-checkout-a")
    + sub("Pedido registrado", "Pantalla de agradecimiento con el número de pedido y el mensaje según el medio de pago (se editan en Configuración → Checkout y mensajes). También llega un mail con el detalle.", "front-gracias", "", "mid")
    + callout("<b>Después de comprar:</b> el comprador recibe un mail de confirmación y otro cada vez que el pedido cambia de estado. Si pagó por transferencia, la tienda confirma el pago desde el panel; con Mercado Pago se confirma solo."))

add(G9, "front-mi-cuenta", "Mi cuenta", "/mi-cuenta/…",
    "Con la sesión iniciada, el comprador tiene su propia zona. Se entra desde el ícono de la persona.",
    sub("Mis pedidos", "Historial con fecha, medio de pago, productos, total y estado (pendiente, confirmado, entregado o cancelado). Cuando la tienda carga el seguimiento, aparece el número y el link para ver el envío de OCA.", "front-pedidos")
    + sub("Mis direcciones", "Las que se guardaron al comprar. La predeterminada se completa sola en el próximo pedido; se pueden borrar.", "front-direcciones", "", "mid")
    + sub("Mis favoritos", "Los productos marcados con el corazón, con acceso directo para agregarlos al carrito.", "front-favoritos")
    + sub("Mis puntos", "Si la tienda tiene activado el sistema de puntos: se acumulan con cada pedido <b>entregado</b>, y se canjean por cupones de un solo uso del catálogo de recompensas. Se ve el saldo y el historial de movimientos.", "front-puntos", "", "mid"))

add(G9, "front-ayuda", "Ayuda, contacto y novedades", "Toda la tienda",
    "Los canales para que el comprador consulte, y las formas de enterarse de novedades.",
    shot("front-chat", "Vendedora virtual", "narrow") + points([
        "<b>Vendedora virtual (IA):</b> el botón <b>¿Te ayudo?</b> abre un chat que recomienda productos reales del catálogo, con su precio y existencia de hoy. Al empezar pide nombre y teléfono (se puede omitir con “Ahora no”) para que la tienda pueda retomar la consulta. Se configura en <a href=\"#config-ia\">Configuración → Vendedora IA</a>; si está apagada, el botón abre directamente WhatsApp.",
        "<b>Hablar con una persona:</b> botón verde que abre WhatsApp, dentro del horario que la tienda defina (fuera de horario se avisa).",
        "<b>Formulario de contacto:</b> en la página Contacto; lo que escribe llega por mail a la tienda y queda en <a href=\"#mensajes\">Mensajes</a>.",
        "<b>Newsletter:</b> al final del inicio, “Sumate a nuestro newsletter”. Los mails quedan en <a href=\"#suscriptores\">Suscriptores</a>.",
        "<b>Datos de contacto y mapa:</b> teléfonos, WhatsApp, Instagram y dirección de cada local, en el pie de página y en “Dónde estamos”.",
        "<b>Páginas:</b> Quiénes somos y los textos legales (términos, privacidad, cambios y envíos), en el menú y el pie.",
        "<b>Pop-up promocional</b> al entrar, si la tienda lo configuró.",
        "<b>App instalable y avisos:</b> <a href=\"#pwa\">descargar la web app</a> y recibir notificaciones.",
    ]) + sub("Formulario de contacto", "Una de las páginas que se arman desde Páginas.", "front-contacto", "", "mid")
    + sub("Pop-up promocional", "Aparece pocos segundos después de entrar; se muestra una vez por visitante o cada vez, según lo configurado.", "front-popup", "", "mid"))


# ------------------------------------------------------------------ CATÁLOGO
prod_body = (
    shot("productos-lista", "/admin/productos") +
    points([
        "Ver todo el catálogo: foto, nombre, tipo (simple o variable), precio, existencia y estado.",
        "<b>Buscar mientras escribís</b> por nombre o SKU. El listado se filtra solo, sin apretar Enter.",
        "Ordenar (alfabético real, más nuevos, precio…) y elegir <b>cuántos productos por página</b>; todo el centro se desplaza junto.",
        "Filtrar por categoría, tipo, estado y disponibilidad.",
        "Editar un producto con un clic, o crear uno con <b>Nuevo producto</b>.",
        "Aplicar <b>acciones masivas</b> a varios productos a la vez.",
    ]) +
    sub("Filtros", "Combiná los filtros: por ejemplo, solo productos con variantes y con existencia.", "productos-filtros", "", "mid") +
    sub("Acciones masivas", "Tildá varios productos y aparece la barra de acciones: cambiar estado, mover de categoría, activar/desactivar existencia o eliminar. Antes de aplicar te pide confirmación.", "productos-masivas", "", "mid") +
    '<h3 class="sec">Crear y editar un producto</h3>'
    '<p class="panel-summary">La pantalla de edición tiene dos columnas: a la izquierda el contenido (nombre, descripción, imágenes, precio, variantes) y a la derecha el estado, la categoría y los ajustes secundarios.</p>' +
    shot("producto-editar-a", "/admin/productos/…") +
    points([
        "<b>Nombre</b> y <b>Descripción corta / completa</b>, con editor de texto (negrita, listas, colores, enlaces).",
        "<b>URL amigable (slug)</b>: se arma sola desde el nombre; podés cambiarla.",
        "<b>SKU</b>, el código interno del producto: es la clave para actualizar precios y stock por CSV.",
        "<b>Estado</b>: Publicado, Borrador (no se ve) o Programado con fecha de <i>Mostrar desde</i> y <i>Ocultar desde</i>.",
        "<b>Título y descripción SEO</b>: cómo se muestra en Google. Si lo dejás vacío se usa el nombre del producto.",
    ]) +
    sub("Precio y existencia", "Precio, precio anterior (se muestra tachado como oferta) y la existencia en tres modos simples.", "producto-existencia", "", "mid") +
    table(["Modo de existencia", "Qué hace"], [
        ["<b>Hay</b>", "Siempre se puede comprar. No se lleva la cuenta de unidades (ideal para productos que hacés a pedido o que nunca se agotan)."],
        ["<b>No hay</b>", "No se puede comprar. En la tienda figura “Sin stock” y el cliente puede anotarse en la <a href=\"#lista-espera\">lista de espera</a>."],
        ["<b>Controlar cantidad</b>", "Cargás las unidades; cada venta descuenta y con 0 el producto queda sin existencia solo."],
    ]) +
    sub("Imágenes y videos", "Subí hasta varias fotos (la primera es la principal) y, si querés, un <b>video</b>. Se puede reordenar con las flechas, quitar, o cargar un video solo. Para los videos el panel toma un cuadro como imagen de portada.", "producto-imagenes", "", "mid") +
    sub("Categorías", "Marcá una o varias categorías. El buscador predictivo filtra mientras escribís, útil cuando hay muchas.", "producto-categorias", "", "mid") +
    sub("Costo y promoción", "El <b>precio de costo</b> es solo para vos (alimenta las estadísticas). El <b>precio promocional</b> puede tener fechas de inicio y fin.", "producto-costo-promo", "", "mid") +
    sub("Columna lateral", "Estado, tipo de producto (simple o variable), URL y programación de publicación.", "producto-lateral", "", "narrow") +
    '<h3 class="sec">Productos con variantes</h3>'
    '<p class="panel-summary">Cuando un mismo producto viene en talles, colores u otras opciones, cambiá el <b>Tipo</b> a <b>Variable</b>. Elegí los atributos (por ejemplo Talle y Color) y el panel genera todas las combinaciones. Cada variante tiene su propio SKU, precio y existencia.</p>' +
    shot("producto-variable", "Tipo: Variable") +
    steps([
        "Cambiá el <b>Tipo</b> a <b>Variable</b>.",
        "Elegí los <b>atributos</b> que usa el producto (se crean en <a href=\"#atributos\">Atributos</a>) y tildá los valores que aplican.",
        "Generá las variantes y completá <b>precio, SKU y existencia</b> de cada una. Dejá en blanco el precio para que use el del producto.",
        "Guardá. En la tienda el cliente elige talle/color y ve la existencia de esa variante.",
    ]) +
    callout("<b>Importante:</b> si una variante no tiene existencia, el cliente la ve deshabilitada pero puede elegir las demás. El producto figura “Sin stock” solo cuando se agotan todas.")
)
add(G2, "productos", "Productos", "/admin/productos", "El corazón de la tienda: crear, ordenar, ocultar y actualizar todo el catálogo.", prod_body)

add(G2, "productos-csv", "Precios y stock por CSV", "/admin/productos → Importar",
    "Para actualizar muchos productos de una vez: descargás el catálogo, lo editás en Excel o Google Sheets y lo subís de nuevo.",
    shot("productos-csv", "/admin/productos/importar") + steps([
        "Tocá <b>Descargar productos.csv</b>.",
        "Abrilo en Excel o Google Sheets y cambiá <b>precio</b>, <b>precio_anterior</b> y/o <b>stock</b>. No toques la columna <code>sku</code>: es la que identifica cada producto o variante.",
        "Guardalo como CSV y subilo con <b>Importar</b>. El panel te dice cuántos productos actualizó y cuáles no encontró.",
    ]) + points([
        "Las celdas <b>vacías no se modifican</b>: podés actualizar solo los precios, o solo el stock.",
        "Las demás columnas se ignoran; no se pueden crear productos por este medio.",
        "Funciona con productos simples y con variantes (cada variante por su SKU).",
    ], "Reglas") + callout("<b>Tip:</b> antes de un cambio grande de precios, descargá el CSV y guardalo como respaldo: si algo sale mal podés volver a subirlo."))

add(G2, "categorias", "Categorías", "/admin/categorias",
    "Ordenan el catálogo. Pueden tener subcategorías sin límite de niveles, imagen propia y datos para Google.",
    shot("categorias-lista", "/admin/categorias") + points([
        "Crear una categoría con nombre y <b>categoría padre</b> (para hacerla subcategoría). La ves indentada en el árbol.",
        "Buscar categorías mientras escribís.",
        "Ver la URL (slug) y cuántos productos tiene cada una, incluyendo cuántas subcategorías.",
        "Eliminar una categoría: sus subcategorías suben un nivel y los productos <b>no se borran</b>, solo quedan sin esa categoría.",
    ]) + sub("Editar una categoría", "Nombre, URL, categoría padre, orden, descripción, imagen (aparece en el inicio y en los listados) y SEO.", "categoria-editar", "", "mid")
    + callout("<b>En la tienda:</b> el menú muestra primero las categorías y, al elegir una, sus subcategorías. No se muestran las cantidades de productos para que el menú quede limpio."))

add(G2, "atributos", "Atributos", "/admin/atributos",
    "Talle, color, material… Cada atributo tiene sus valores y se usan en los productos variables para armar las variantes.",
    shot("atributos-lista", "/admin/atributos") + points([
        "Crear un atributo (por ejemplo <b>Talle</b>) con sus valores, uno por línea: S, M, L, XL.",
        "Para un <b>color</b> agregá el código hexadecimal después de dos puntos: <code>Rojo|#C0392B</code>. Así se muestra el círculo de color.",
        "Ver cuántos productos usan cada atributo antes de tocarlo.",
    ]) + sub("Valores de un atributo", "Editá, agregá o quitá valores. La tabla indica cuántas variantes usa cada valor.", "atributo-valores", "", "mid")
    + callout("Si quitás un valor que está en uso, el panel te avisa cuántas variantes lo tienen para que no se rompa ningún producto."))

add(G2, "etiquetas", "Etiquetas", "/admin/etiquetas",
    "Marcas rápidas como “Nuevo”, “Oferta” o “Regalo”. Se crean al cargar un producto (campo Etiquetas) y acá las administrás.",
    shot("etiquetas", "/admin/etiquetas", "mid") + points([
        "Renombrar o borrar etiquetas, y ver en cuántos productos se usa cada una.",
        "En la tienda, cada etiqueta tiene su propio listado y se muestra como cartelito sobre la foto.",
    ]))

# ------------------------------------------------------------------ VENTAS
add(G3, "ventas", "Ventas", "/admin/ventas",
    "Todos los pedidos. Los nuevos aparecen marcados hasta que los abrís.",
    shot("ventas-lista", "/admin/ventas") + points([
        "Ver estado de cada pedido (pago pendiente, confirmado, entregado, cancelado), medio de pago y total.",
        "Filtrar y buscar por cliente o número de pedido.",
        "Los pedidos nuevos tienen el distintivo <b>Nuevo</b> y suman en la campanita.",
    ]) + sub("Detalle de un pedido", "Datos del cliente, envío, productos, totales, seguimiento y un historial con notas internas.", "venta-detalle", "", "mid") + points([
        "<b>Cambiar el estado</b>: el cliente recibe un mail automático en cada cambio importante.",
        "<b>Conciliar el pago</b> de Mercado Pago con un clic si el aviso automático no llegó.",
        "Cargar el <b>número de seguimiento</b> y descargar el rótulo del envío (con OCA configurado).",
        "Anotar <b>notas internas</b> que el cliente no ve.",
    ]))

add(G3, "estadisticas", "Estadísticas", "/admin/estadisticas",
    "Cómo le va a la tienda: ingresos, ticket promedio, productos más vendidos, medios de pago y conversión.",
    shot("estadisticas", "/admin/estadisticas") + points([
        "Elegir el período (últimos 7, 30, 90 días o fechas a medida) y compararlo con el período anterior.",
        "Ver los productos más vendidos, el reparto por medio de pago, por envío y por estado.",
        "Seguir el <b>embudo</b>: visitas → carritos iniciados → pedidos pagados, con la tasa de conversión.",
        "Conocer a tus clientes: nuevos, compradores, recurrentes y frecuencia de compra.",
    ]))

add(G3, "visitas", "Visitas", "/admin/visitas",
    "El tráfico del sitio. No es lo mismo que Estadísticas: acá se mira cuánta gente entra, no cuánto se vende.",
    shot("visitas", "/admin/visitas") + points([
        "Visitas únicas y vistas de página por día.",
        "Las páginas más vistas y los productos más agregados al carrito.",
        "<b>De dónde vienen las visitas:</b> Instagram, Facebook, WhatsApp, TikTok, Google, mails, otros sitios o directo, con cantidad y porcentaje. En Instagram, Facebook y Google separa lo <b>orgánico</b> de lo que viene de <b>publicidad</b> (barra naranja).",
        "<b>Campañas:</b> las visitas de cada campaña que armes con un link con origen, y los sitios que te enlazan.",
        "<b>Armá un link con origen:</b> elegís la página, dónde lo vas a poner (bio de Instagram, anuncio, mail, WhatsApp…) y un nombre de campaña, y copiás el link. Cuando alguien entra por ese link, Visitas lo cuenta en ese origen.",
    ]) + callout(
        "<b>Cómo se detecta el origen:</b> por la página desde la que llega la persona, por el navegador interno de Instagram, Facebook y TikTok, y por los datos que lleva el link (los llamados UTM). Para distinguir lo orgánico de la publicidad, los anuncios tienen que usar un link con origen de tipo “Anuncio pago” (los clics de Google Ads se detectan solos). Un link pegado en un chat de WhatsApp no informa su origen: figura como <b>Directo</b> salvo que uses un link con origen.",
        "Los mails y mensajes de recuperación de carritos ya llevan su origen puesto, así que aparecen solos como Email y WhatsApp (campaña “recuperar-carrito”). El origen se cuenta desde que se activa esta función; las visitas anteriores no lo tienen."))

# ------------------------------------------------------------------ RECUPERAR
add(G4, "carritos", "Carritos abandonados", "/admin/carritos-abandonados",
    "Los clientes que pusieron productos en el carrito y no terminaron la compra. Podés contactarlos a mano o dejar que la tienda lo haga sola.",
    shot("carritos", "/admin/carritos-abandonados") + points([
        "Ver qué dejó cada persona, el total y hace cuánto fue su última actividad.",
        "Escribirles por <b>WhatsApp</b> con un mensaje ya armado y el link para retomar el carrito. Al tocar el botón queda registrado <b>la fecha, la hora y cuántas veces</b> se les escribió; si ya se les escribió, el botón dice “Reenviar”.",
        "Copiar los mails de la lista para una campaña.",
        "Limpiar los carritos viejos.",
    ]) + sub("Recuperación automática por mail", "Un interruptor: si alguien deja productos y no compra en las horas que elijas, recibe un mail con el link para retomar su carrito.", "carritos-auto", "", "mid") + callout(
        "<b>Reglas de cuidado:</b> un mail por carrito, solo a carritos recientes, nunca a quien ya compró después ni a quien pidió no recibir más avisos (cada mail trae su enlace para darse de baja). Los productos sin stock no aparecen. Siempre podés mandarte una <b>prueba</b> antes de activarlo."))

add(G4, "lista-espera", "Lista de espera", "/admin/lista-espera",
    "Clientes que se anotaron con “Avisarme cuando haya stock” en un producto agotado.",
    shot("lista-espera", "/admin/lista-espera") + points([
        "Ver quién espera qué producto y desde cuándo.",
        "Avisarles por WhatsApp (queda anotado cuándo y cuántas veces, en la columna <b>WhatsApp</b>) o copiar sus mails.",
        "El aviso automático por mail sale solo cuando reponés existencia (ver <a href=\"#mailing\">Mailing → Disponibilidad</a>).",
    ]))

add(G4, "mailing", "Mailing", "/admin/mailing",
    "Mandá un mail a una o varias listas de clientes: armás el mensaje con vista previa y se envía en segundo plano.",
    shot("mailing", "/admin/mailing") + points([
        "Elegir la audiencia: carritos abandonados, lista de espera, usuarios registrados, suscriptores, clientes nuevos o frecuentes, inactivos y cualquier <a href=\"#segmentos\">segmento</a> que armes.",
        "Escribir asunto y texto con formato; la <b>vista previa</b> muestra el mail con tu logo y tus datos.",
        "Ver el historial en <b>Campañas enviadas</b>.",
    ]) + sub("Disponibilidad y cupo del mes", "Muestra cuántos mails se mandaron este mes frente al cupo que definiste y la cantidad de avisos pendientes.", "mailing-disponibilidad", "", "mid"))

add(G4, "notificaciones", "Notificaciones push", "/admin/notificaciones",
    "Avisos que llegan al celular de quienes instalaron la web app, aunque no tengan el sitio abierto.",
    shot("notificaciones", "/admin/notificaciones") + points([
        "Ver cuántos dispositivos están suscriptos.",
        "Escribir título, mensaje y, si querés, un link a un producto o categoría.",
        "Mandar a todos los suscriptos y ver el historial de envíos.",
    ]) + callout("Las notificaciones requieren que la persona haya aceptado los avisos desde la <a href=\"#pwa\">web app</a>. En iPhone solo funcionan con la app instalada. Los suscriptos que desinstalan la app o bloquean los avisos se quitan solos de la lista. El pedido confirmado también le llega como aviso a quien tiene la app y sesión iniciada."))

add(G4, "conversaciones", "Conversaciones con la vendedora IA", "/admin/conversaciones",
    "Cada charla del chat de la tienda queda guardada con el nombre y el teléfono que dejó el cliente al empezar.",
    shot("conversaciones", "/admin/conversaciones") + points([
        "Ver las consultas, cuántos mensajes tuvo cada una y su estado: <b>Para contactar</b> o <b>Atendida</b>.",
        "Buscar por nombre, teléfono o texto.",
        "Escribirle al cliente por WhatsApp con un clic y marcar la conversación como atendida.",
    ]) + sub("Una conversación", "Se lee completa, con lo que preguntó el cliente y lo que respondió la vendedora.", "conversacion-detalle", "", "mid"))

add(G4, "mensajes", "Mensajes de contacto", "/admin/mensajes",
    "Lo que escriben los clientes desde el formulario de la página de contacto.",
    shot("mensajes", "/admin/mensajes", "mid") + points([
        "Responder por mail, marcar como leído o eliminar.",
        "La sección solo aparece en el menú si tenés un formulario activo o hay mensajes.",
    ]))

# ------------------------------------------------------------------ REGLAS
add(G5, "pagos", "Pagos", "/admin/pagos", "Elegí qué medios de pago aceptás y con qué descuento.",
    shot("pagos", "/admin/pagos") + points([
        "Prender o apagar cada medio con su interruptor: Mercado Pago, transferencia, contra entrega, tarjeta (Payway) y “sin pago online”.",
        "Definir un <b>descuento</b> para cada medio (por ejemplo 10% por transferencia).",
        "Cargar las credenciales de cada pasarela dentro de su tarjeta.",
    ]) + callout("Con <b>Mercado Pago</b> el pago se confirma solo. Con transferencia el cliente adjunta el comprobante y vos confirmás desde el pedido."))

add(G5, "envios", "Envíos", "/admin/envios", "Métodos de envío, zonas, descuentos por código postal y OCA.",
    shot("envios-a", "/admin/envios") + points([
        "Activar <b>OCA ePak</b> para cotizar y rotular envíos.",
        "Crear <b>métodos propios</b>: retiro en el local, cadetería, entrega a coordinar… cada uno con su costo o gratis.",
        "<b>Envío gratis</b> desde un monto.",
        "<b>Zonas restringidas</b> (no se vende a ciertos códigos postales) y descuentos por código postal.",
    ]) + shot("envios-b", "/admin/envios", "mid"))

add(G5, "cupones", "Cupones", "/admin/cupones", "Códigos de descuento. Todas las condiciones son opcionales: lo que no cargás, no se exige.",
    sub("Cupón rápido", "Para alguien que compró en el local y quiere probar la tienda online: un cupón de un solo uso, con vencimiento, que podés enviar por WhatsApp.", "cupones-rapido", "", "mid") +
    sub("Lista de cupones", "Filtrá por tipo y estado (activos, usados, vencidos, deshabilitados) y apagá o prendé cada uno.", "cupones-lista", "", "mid") +
    sub("Nuevo cupón", "Porcentaje, monto fijo o envío gratis; limitá por categoría o producto, medio de pago, compra mínima, vigencia y cantidad de usos.", "cupones-nuevo", "", "mid"))

add(G5, "puntos", "Puntos", "/admin/puntos", "Los clientes acumulan puntos con cada compra y los canjean por cupones de un solo uso.",
    shot("puntos", "/admin/puntos") + points([
        "Prender el sistema y definir <b>cuántos puntos se dan por cada monto</b> gastado.",
        "Crear <b>recompensas</b> (por ejemplo 500 puntos = cupón de 10%).",
        "Ajustar a mano el saldo de un cliente (se registra el motivo) y ver los últimos canjes.",
        "Los puntos se acreditan cuando el pedido pasa a entregado.",
    ]))

# ------------------------------------------------------------------ ASPECTO
add(G6, "temas", "Temas y campañas", "/admin/temas", "Cambiá la identidad visual de la tienda para una campaña (Navidad, Black Friday, Hot Sale…) con programación automática. Se ve un solo aspecto a la vez.",
    shot("temas", "/admin/temas") + points([
        "<b>Aspecto base de la tienda:</b> es el de siempre. Muestra la etiqueta <b>ACTIVO</b> cuando no hay ninguna campaña vigente y se edita desde su tarjeta.",
        "<b>Crear tema nuevo:</b> arma una campaña desde cero; queda apagada hasta que la actives.",
        "<b>Guardar y activar</b> la muestra ya y apaga el aspecto base (y cualquier otra campaña). Con fechas, <b>Guardar y programar</b> la hace entrar y salir sola.",
        "<b>Activar aspecto base</b> apaga la campaña que se ve y vuelve al aspecto de siempre; la campaña queda guardada para usarla otra vez.",
        "<b>Vista previa</b> antes de publicar, sin que los clientes lo vean. También podés duplicar, apagar o eliminar cada tema.",
    ]) + sub("Editar el aspecto", "Colores, tipografías, botones, barra de anuncio, slider de portada y tarjetas destacadas, con vista previa en vivo.", "tema-editar", "", "mid"))

add(G6, "paginas", "Páginas", "/admin/paginas", "Quiénes somos, contacto y textos legales. Las que activás aparecen en el pie de página.",
    shot("paginas", "/admin/paginas", "mid") + points([
        "Crear páginas con editor de texto, URL propia y datos para buscadores.",
        "Elegir si se muestra en el <b>menú de arriba</b> y en el <b>pie</b>, y si incluye el <b>formulario de contacto</b>. Una página publicada aparece en el menú salvo que destildes “Mostrar en el menú” (los textos legales vienen sin tildar). En pantallas grandes entra una sola página en la barra; las demás quedan juntas bajo <b>Más</b> para que el menú no se desborde.",
        "Vienen precargados los textos legales (términos, privacidad, cambios, envíos) para completar y publicar.",
    ]) + sub("Editar una página", "Título, URL, contenido y opciones de publicación.", "pagina-editar", "", "mid"))

add(G6, "contacto", "Contacto", "/admin/contacto", "Las tarjetas con tus datos que se muestran en el pie del sitio.",
    shot("contacto", "/admin/contacto", "mid") + points([
        "Cargar una tarjeta por local o sucursal: título, dirección, teléfono, WhatsApp e Instagram.",
        "Ordenarlas con las flechas. El pie muestra hasta 4 columnas.",
    ]))

# ------------------------------------------------------------------ CLIENTES
add(G7, "clientes", "Clientes y administradores", "/admin/usuarios", "Todas las cuentas de la tienda y quién administra el panel. Son dos entradas del menú sobre la misma lista: <b>Clientes</b> muestra solo a quienes compran y <b>Administradores</b> solo al equipo con acceso al panel.",
    shot("clientes", "/admin/usuarios") + points([
        "Buscar clientes por nombre o mail, y exportarlos a CSV.",
        "Ver compras, gasto total, última compra y puntos de cada uno.",
        "Crear un <b>nuevo administrador</b>.",
        "Restablecer la contraseña de una persona (solo superadministrador).",
    ]) + sub("Ficha del cliente", "Resumen de compras, segmentos a los que pertenece, pedidos, puntos y beneficios utilizados.", "cliente-ficha", "", "mid")
    + sub("Nuevo administrador", "Entra al panel con su mail y contraseña inicial. Si el mail ya tiene cuenta, esa cuenta pasa a ser administradora.", "nuevo-admin", "", "narrow")
    + sub("Restablecer contraseña", "Definí una contraseña nueva o mandá un link por mail para que la persona la cree.", "reset-password", "", "narrow")
    + callout("<b>Roles:</b> <b>Cliente</b> (solo compra), <b>Administrador</b> (gestiona la tienda) y <b>Superadministrador</b> (además maneja las copias de seguridad y el consumo)."))

add(G7, "segmentos", "Segmentos", "/admin/segmentos", "Grupos de clientes que se arman solos según su comportamiento. Los usás para filtrar clientes y como audiencia en Mailing.",
    shot("segmentos", "/admin/segmentos", "mid") + points([
        "<b>Clientes nuevos</b> (registrados hace poco), <b>frecuentes</b> (varias compras en un período), <b>inactivos</b> (hace tiempo que no compran) y con puntos.",
        "Ajustar los parámetros de cada segmento y prenderlos o apagarlos.",
    ]))

add(G7, "suscriptores", "Suscriptores", "/admin/suscriptores", "Quienes dejaron su mail en el formulario del newsletter del sitio.",
    shot("suscriptores", "/admin/suscriptores", "mid") + points(["Ver la lista con la fecha de alta, copiar los mails o eliminar a alguien.", "Son una de las audiencias de <a href=\"#mailing\">Mailing</a>."]))

add(G7, "registro", "Registro de actividad", "/admin/logs", "Todo lo que hace el equipo desde el panel queda anotado: quién, cuándo y qué.",
    shot("registro", "/admin/logs", "mid") + points(["Útil para saber quién cambió un precio, confirmó un pago o editó un tema."]))

# ------------------------------------------------------------------ CONFIGURACIÓN
cfg = [
    ("config-general", "General", "cfg-general", "Logo del encabezado, logo del pie y <b>favicon</b> (el ícono de la pestaña y de la web app). También el modo mantenimiento: muestra una pantalla de “volvemos pronto” a los clientes, mientras los administradores siguen entrando."),
    ("config-beneficios", "Beneficios", "cfg-beneficios", "La franja de beneficios bajo el slider del inicio (envíos, cuotas, retiro…): de 1 a 6 ítems con ícono, título y subtítulo."),
    ("config-franquicia", "Franquicia", "cfg-franquicia", "El <b>nombre de la tienda</b> y la sucursal o lugar. Se usa en los mails, en el encabezado, en los mensajes y como nombre de la web app."),
    ("config-copias", "Copias de seguridad", "cfg-copias", "Copias cifradas de toda la base (productos, pedidos, clientes y configuración). Hacés una copia al instante y se conservan las últimas; se descargan para guardarlas fuera del servidor. Solo superadministrador."),
    ("config-mail-compra", "Mail de compra", "cfg-mail-compra", "Texto de bienvenida del mail que recibe el cliente al comprar y las notas según el medio de pago. Lo que dejás vacío usa el texto por defecto."),
    ("config-checkout", "Checkout y mensajes", "cfg-checkout", "Un aviso opcional arriba del checkout (por ejemplo “los pedidos de después de las 18 h salen al día siguiente”) y los mensajes de la pantalla de pedido registrado."),
    ("config-telegram", "Telegram", "cfg-telegram", "Cada pedido nuevo te llega al instante a un grupo de Telegram. Cargás el token del bot y el ID del chat, y probás con un botón."),
    ("config-ia", "Vendedora IA", "cfg-ia", "El asistente del chat de la tienda: lo prendés o apagás, y definís el nombre, el saludo, las instrucciones de venta y el horario de WhatsApp para hablar con una persona. La vendedora solo recomienda productos reales del catálogo y con existencia."),
    ("config-consumo", "Consumo", "cfg-consumo", "Cuántos mails y cuántos tokens de IA se usaron este mes frente al cupo. Podés poner un tope mensual; al llegar, se frenan las campañas o la IA. El contador arranca de cero el día 1. Solo superadministrador."),
    ("config-seo", "SEO y etiquetas", "cfg-seo", "Cómo se ve la tienda en Google y al compartirla en redes, y dónde sumar Google Analytics, Tag Manager, el píxel de Meta y cualquier otra etiqueta. <b>Título y descripción</b> del sitio, <b>imagen para compartir</b> (WhatsApp, Facebook, Instagram, X) y el interruptor <b>Permitir que Google indexe el sitio</b>: apagalo mientras armás la tienda y prendelo al salir en vivo. En <b>Medición y publicidad</b> pegás solo el código (G-…, GTM-… o el ID del píxel) y la tienda carga el script, sin contar tus visitas al panel. En <b>Verificación</b> cargás los códigos de Google Search Console y de Meta. <b>Otras etiquetas propias</b> (solo superadministrador) acepta <code>&lt;meta&gt;</code>, <code>&lt;link&gt;</code> y <code>&lt;script&gt;</code> de cualquier servicio. Cada producto, categoría y página puede tener además su propio título y descripción SEO."),
    ("config-popup", "Pop-up", "cfg-popup", "Un cartel promocional al entrar: dónde se muestra (solo inicio o todo el sitio), con qué frecuencia, título y texto con formato."),
]
body = '<div class="tabstrip">' + "".join(f'<a href="#{i}">{t}</a>' for i, t, _, _ in cfg) + "</div>"
add(G8, "configuracion", "Configuración", "/admin/configuracion", "Todo lo que se ve en el sitio y las integraciones de la tienda, en pestañas. Algunas son solo para el superadministrador.", body)
for i, t, s_, d in cfg:
    add(G8, i, t, "Configuración → " + t, d, shot(s_, "/admin/configuracion", "mid"), True)

# ------------------------------------------------------------------ INTRO + HTML
INTRO = '''
<div class="intro" id="intro">
  <div class="intro-eyebrow">Manual de uso</div>
  <h1>Tu tienda y su panel,<br>pantalla por pantalla.</h1>
  <p class="lead">Una guía para manejar la tienda día a día y para saber qué puede hacer quien compra: cargar y ordenar productos, atender pedidos, recuperar clientes, definir las reglas de pago y envío y dejar todo a tu medida. Las imágenes son de una tienda de ejemplo.</p>
  <div class="howto">
    <div class="howto-step"><div class="n">1</div><p>Entrá a <code>/admin</code> con tu mail y contraseña. El ojito te deja ver lo que escribís.</p></div>
    <div class="howto-step"><div class="n">2</div><p>Cargá tus <b>categorías</b>, <b>atributos</b> y <b>productos</b>. Si ya tenés una lista, usá el CSV.</p></div>
    <div class="howto-step"><div class="n">3</div><p>Configurá <b>pagos</b>, <b>envíos</b> y tu <b>logo</b>. Con eso ya podés vender.</p></div>
  </div>
  <div class="callout"><p><b>Antes de salir en vivo:</b> cargá tu logo y favicon, el nombre de la tienda (Configuración → Franquicia), al menos un medio de pago y uno de envío, y hacé una compra de prueba.</p></div>
</div>'''

# Dos partes: 1) panel de administración, 2) lo que hace el comprador. La web app va al final de la segunda.
PARTS = [
    ("parte-panel", "Parte 1", "Panel de administración", "Todo lo que se maneja desde el panel: catálogo, ventas, clientes, reglas de la tienda, aspecto y configuración.", lambda g: g != G9),
    ("parte-usuario", "Parte 2", "La tienda: lo que hace el comprador", "Cómo recorre la tienda quien compra: desde buscar un producto y entrar con Google hasta pagar, ver sus pedidos, juntar puntos e instalar la app.", lambda g: g == G9),
]
LAST = {"pwa"}  # va al final de su grupo


def ordered(pred):
    secs = [(g, i, h) for g, i, h in SECTIONS if pred(g)]
    return [x for x in secs if x[1] not in LAST] + [x for x in secs if x[1] in LAST]


toc = []
body_parts = []
for pid, eyebrow, title, desc, pred in PARTS:
    secs = ordered(pred)
    groups = []
    for g, i, _ in secs:
        if not groups or groups[-1][0] != g:
            groups.append((g, []))
    # armado del índice de cada grupo respetando el orden final de las secciones
    for gname, _ in groups:
        items = [(i, t, sub_) for (grp, i, t, sub_) in TOC_FLAT if grp == gname]
        order = {i: n for n, (g, i, _) in enumerate(secs)}
        items.sort(key=lambda it: order.get(it[0], 0))
        a = "".join('<a href="#%s"%s>%s%s</a>' % (i, ' class="sub"' if s_ else "", "↳ " if s_ else "", t) for i, t, s_ in items)
        if gname == G1:
            a = '<a href="#intro">Cómo entrar</a>' + a
        toc.append(f'<div class="toc-group" data-part="{pid}"><span class="toc-label">{gname}</span>{a}</div>')
    body_parts.append(f'<section class="part" id="{pid}"><div class="part-eyebrow">{eyebrow}</div><h2>{title}</h2><p>{desc}</p></section>' + "".join(h for _, _, h in secs))

JS = """
(function(){
var d=document,body=d.body,q=d.getElementById('manual-q'),links=[].slice.call(d.querySelectorAll('.toc a')),none=d.querySelector('.toc .none');
function norm(s){return s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')}
var text={};[].forEach.call(d.querySelectorAll('section.panel'),function(s){text['#'+s.id]=norm(s.textContent)});
// buscador del índice
q.addEventListener('input',function(){var v=norm(q.value.trim()),n=0;body.classList.toggle('searching',!!v);
links.forEach(function(a){var h=a.getAttribute('href');var ok=!v||norm(a.textContent).indexOf(v)>=0||(text[h]||'').indexOf(v)>=0;a.classList.toggle('hide',!ok);if(ok)n++});
[].forEach.call(d.querySelectorAll('.toc-group'),function(g){g.classList.toggle('hide',!g.querySelector('a:not(.hide)'))});none.style.display=n?'none':'block'});
// índice del celular: se abre con el botón y se cierra al elegir una sección
var btn=d.querySelector('.menu-btn'),bd=d.querySelector('.backdrop');
function toggle(open){body.classList.toggle('toc-open',open);btn.setAttribute('aria-expanded',open?'true':'false')}
btn.addEventListener('click',function(){toggle(!body.classList.contains('toc-open'))});
bd.addEventListener('click',function(){toggle(false)});
links.forEach(function(a){a.addEventListener('click',function(){toggle(false)})});
d.addEventListener('keydown',function(e){if(e.key==='Escape')toggle(false)});
// parte y sección actuales según el desplazamiento
var tb=d.querySelector('.topbar'),buttons=[].slice.call(d.querySelectorAll('.tb-parts a')),blocks=[].slice.call(d.querySelectorAll('section.part,section.panel')),tocLinks={};
links.forEach(function(a){tocLinks[a.getAttribute('href')]=a});
var ticking=false;
function spy(){ticking=false;var y=tb.offsetHeight+80,cur=blocks[0].id,last=null;
blocks.forEach(function(s){if(s.getBoundingClientRect().top<=y){if(s.classList.contains('part')){cur=s.id;last=null}else last=s.id}});
body.setAttribute('data-part',cur);buttons.forEach(function(b){b.classList.toggle('on',b.getAttribute('data-part')===cur)});
links.forEach(function(a){a.classList.toggle('cur',a.getAttribute('href')==='#'+last)});
var c=tocLinks['#'+last];if(c&&window.innerWidth>900){var box=c.closest('.toc');if(box){var r=c.getBoundingClientRect(),br=box.getBoundingClientRect();if(r.top<br.top+40||r.bottom>br.bottom-40)box.scrollTop+=r.top-br.top-120}}}
window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(spy)}},{passive:true});
window.addEventListener('resize',spy);spy();
})();
"""

page = f'''<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Manual de uso</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<style>{CSS}</style></head><body>
<header class="topbar"><div class="tb-in">
<button class="menu-btn" type="button" aria-label="Abrir el índice" aria-expanded="false">☰</button>
<div class="tb-brand"><span class="dot"></span><b>Manual de uso</b></div>
<nav class="tb-parts" aria-label="Partes del manual"><a href="#parte-panel" data-part="parte-panel"><span class="long">Panel de administración</span><span class="short">Panel</span></a><a href="#parte-usuario" data-part="parte-usuario"><span class="long">La tienda (usuario)</span><span class="short">Usuario</span></a></nav>
</div></header>
<div class="backdrop"></div>
<div class="shell"><nav class="toc">
<input id="manual-q" type="search" placeholder="Buscar en el manual…" aria-label="Buscar en el manual"><div class="none">Sin resultados</div>
{"".join(toc)}</nav>
<main class="content">{INTRO}{"".join(body_parts)}</main></div>
<script>{JS}</script></body></html>'''

# nada de marcas ajenas en el documento de venta
leak = re.search(r"cortopass|cortopac|moda ?shop|woo|odoo|facundo|santa fe", re.sub(r"data:image/[a-z]+;base64,[A-Za-z0-9+/=]+", "", page), re.I)
if leak:
    sys.exit("Aparece una marca/dato que no debería estar: " + leak.group(0))
open(OUT, "w").write(page)
allshots = {f[:-5] for f in os.listdir(os.path.join(HERE, "shots")) if f.endswith(".webp")}
print("manual:", os.path.getsize(OUT) // 1024, "KB;", len(used), "capturas usadas; sin usar:", sorted(allshots - used))
