import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

const load = loader();
const fmt = load('@/lib/oca/format');
const pkgLib = load('@/lib/oca/package');
const oca = load('@/lib/oca/client');

const diffgram = (inner) => `<?xml version="1.0" encoding="utf-8"?><DataSet xmlns="http://webservice.oca.com.ar/"><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" id="NewDataSet"/><diffgr:diffgram xmlns:msdata="urn:schemas-microsoft-com:xml-msdata" xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">${inner}</diffgr:diffgram></DataSet>`;

const CFG = { cuit: '30712345678', operativa: '111', operativaSucursal: '222', originZipCode: '3000', user: 'u@x.com', password: 'secreto', nroCliente: '5555', originStreet: 'Avenida Úrquiza', originNumber: '123', originFloor: '', originCity: 'Santa Fe', originProvince: 'Santa Fe', originContact: 'José Pérez', originEmail: 'envios@tienda.com', franjaHoraria: '1' };

// ---------- formatos ----------
test('formats: CUIT, apartment, province/city and emails', () => {
  assert.equal(fmt.formatCuit('30-71234567-8'), '30-71234567-8'); assert.equal(fmt.formatCuit('30712345678'), '30-71234567-8');
  assert.equal(fmt.formatCuit(''), null);
  assert.deepEqual(fmt.parseApartment('3b'), { piso: '3', depto: 'B' }); assert.deepEqual(fmt.parseApartment('PB A'), { piso: '', depto: 'A' }); assert.deepEqual(fmt.parseApartment(''), { piso: '', depto: '' });
  assert.equal(fmt.normalizeProvince('CABA'), 'CAPITAL FEDERAL'); assert.equal(fmt.normalizeProvince('Ciudad Autónoma de Buenos Aires'), 'CAPITAL FEDERAL'); assert.equal(fmt.normalizeProvince('Córdoba'), 'CORDOBA');
  assert.equal(fmt.normalizeCity('Palermo', 'CAPITAL FEDERAL'), 'CAPITAL FEDERAL'); assert.equal(fmt.normalizeCity('Río Cuarto', 'CORDOBA'), 'RIO CUARTO');
  assert.equal(fmt.sanitizeEmail(' a@b.com '), 'a@b.com'); assert.equal(fmt.sanitizeEmail('no-es-mail'), '');
  assert.equal(fmt.escapeXml('Tom & "Jerry" <3'), 'Tom &amp; &quot;Jerry&quot; &lt;3');
});

// ---------- medidas ----------
test('quote measures: sums weight and volume per unit, with defaults for missing data', () => {
  const m = pkgLib.quoteMeasures([{ quantity: 2, weight: 0.5, width: 10, height: 10, length: 10 }, { quantity: 1, weight: null, width: null, height: null, length: null }]);
  assert.equal(m.weightKg, 2); // 2 x 0.5 + 1 x 1 (por defecto)
  assert.equal(m.volumeM3, 0.01); // 2 x 0.001 + 1 x 0.008 (20x20x20)
  assert.deepEqual(pkgLib.quoteMeasures([], { weightKg: 1, dimCm: 20 }), { weightKg: 0, volumeM3: 0 });
});

test('shipment package: weight rounded up (min 1 kg) and the biggest item sets the box; flags defaults', () => {
  const p = pkgLib.shipmentPackage([{ quantity: 3, weight: 0.4, width: 10, height: 5, length: 30 }, { quantity: 1, weight: 0.2, width: 25, height: 8, length: 12 }]);
  assert.equal(p.pesoKg, 2); assert.equal(p.anchoCm, 25); assert.equal(p.altoCm, 8); assert.equal(p.largoCm, 30); assert.equal(p.usedDefaults, false);
  const light = pkgLib.shipmentPackage([{ quantity: 1, weight: 0.1, width: 1, height: 1, length: 1 }]);
  assert.equal(light.pesoKg, 1, 'mínimo 1 kg');
  const missing = pkgLib.shipmentPackage([{ quantity: 1, weight: null, width: null, height: null, length: null }]);
  assert.deepEqual([missing.pesoKg, missing.altoCm, missing.anchoCm, missing.largoCm, missing.usedDefaults], [1, 20, 20, 20, true]);
  assert.equal(pkgLib.shipmentPackage([{ quantity: 1, weight: 1.2, width: 10, height: 10, length: 10 }]).pesoKg, 2, '1,2 kg se declara como 2');
});

// ---------- cotización ----------
test('quote url: formatted CUIT, operativa by delivery type, and incomplete config is rejected', () => {
  const url = new URL(oca.quoteUrl(CFG, { destinationZip: '1425', weightKg: 2.5, volumeM3: 0.01 }));
  assert.equal(url.protocol, 'http:'); assert.match(url.pathname, /Tarifar_Envio_Corporativo$/);
  assert.equal(url.searchParams.get('CUIT'), '30-71234567-8'); assert.equal(url.searchParams.get('Operativa'), '111');
  assert.equal(url.searchParams.get('PesoTotal'), '2.5'); assert.equal(url.searchParams.get('CodigoPostalOrigen'), '3000'); assert.equal(url.searchParams.get('CodigoPostalDestino'), '1425');
  assert.equal(new URL(oca.quoteUrl(CFG, { destinationZip: '1425', weightKg: 1, volumeM3: 0.001, isBranch: true })).searchParams.get('Operativa'), '222');
  assert.throws(() => oca.quoteUrl({ ...CFG, cuit: null }, { destinationZip: '1425', weightKg: 1, volumeM3: 0.001 }), /incompleta/);
});

test('quote parsing: adds 21% VAT once, reads delivery days, surfaces OCA errors', async () => {
  const ok = diffgram('<NewDataSet xmlns=""><Table diffgr:id="Table1" msdata:rowOrder="0"><Tarifador>x</Tarifador><Precio>4800.0000</Precio><Ambito>Regional</Ambito><PlazoEntrega>3</PlazoEntrega><Adicional>0</Adicional><Total>5000.0000</Total></Table></NewDataSet>');
  const q = await oca.parseQuoteXml(ok);
  assert.equal(q.priceBeforeTax, 5000); assert.equal(Math.round(q.iva * 100) / 100, 1050); assert.equal(Math.round(q.price * 100) / 100, 6050); assert.equal(q.deliveryDays, 3);
  await assert.rejects(oca.parseQuoteXml(diffgram('<NewDataSet xmlns=""><Table><Error>CUIT inválido</Error></Table></NewDataSet>')), /CUIT inválido/);
  await assert.rejects(oca.parseQuoteXml(diffgram('<NewDataSet xmlns=""></NewDataSet>')), /No se pudo obtener cotización/);
  await assert.rejects(oca.parseQuoteXml(diffgram('<NewDataSet xmlns=""><Table><Total>0</Total></Table></NewDataSet>')), /precio válido/);
});

test('quote over the network: http errors and connection failures become clear messages', async () => {
  await assert.rejects(oca.ocaQuote(CFG, { destinationZip: '1425', weightKg: 1, volumeM3: 0.001 }, { fetchImpl: async () => new Response('x', { status: 500 }) }), /OCA no respondió correctamente/);
  await assert.rejects(oca.ocaQuote(CFG, { destinationZip: '1425', weightKg: 1, volumeM3: 0.001 }, { fetchImpl: async () => { throw new Error('boom'); } }), /No pudimos conectar con OCA/);
  const xml = diffgram('<NewDataSet xmlns=""><Table><Total>1000</Total><PlazoEntrega>2</PlazoEntrega></Table></NewDataSet>');
  const q = await oca.ocaQuote(CFG, { destinationZip: '1425', weightKg: 1, volumeM3: 0.001 }, { fetchImpl: async () => new Response(xml, { status: 200 }) });
  assert.equal(Math.round(q.price), 1210);
});

// ---------- sucursales ----------
test('branches: one or many, fallback endpoint, and empty on failure', async () => {
  const many = diffgram('<NewDataSet xmlns=""><Table><IdCentroImposicion>11</IdCentroImposicion><Sigla>SFE</Sigla><Calle>San Martín</Calle><Numero>2100</Numero><Localidad>Santa Fe</Localidad><CodigoPostal>3000</CodigoPostal></Table><Table><IdCentroImposicion>12</IdCentroImposicion><Sigla>SFN</Sigla><Calle>Blas Parera</Calle><Numero>10</Numero><Localidad>Santa Fe</Localidad><CodigoPostal>3000</CodigoPostal></Table></NewDataSet>');
  const b = await oca.ocaBranches('3000', { fetchImpl: async () => new Response(many, { status: 200 }) });
  assert.deepEqual(b.map((x) => [x.id, x.name, x.address]), [['11', 'SFE', 'San Martín 2100'], ['12', 'SFN', 'Blas Parera 10']]);
  const one = diffgram('<NewDataSet xmlns=""><Table><IdCentroImposicion>7</IdCentroImposicion><Sigla>X</Sigla><Calle>A</Calle><Numero>1</Numero><Localidad>L</Localidad><CodigoPostal>3000</CodigoPostal></Table></NewDataSet>');
  assert.equal((await oca.ocaBranches('3000', { fetchImpl: async () => new Response(one) })).length, 1);
  const urls = [];
  const viaFallback = await oca.ocaBranches('3000', { fetchImpl: async (u) => { urls.push(String(u)); return urls.length === 1 ? new Response('err', { status: 500 }) : new Response(one); } });
  assert.equal(viaFallback.length, 1); assert.match(urls[1], /GetCentrosImposicion\?ZipCode=3000/);
  assert.deepEqual(await oca.ocaBranches('3000', { fetchImpl: async () => new Response('x', { status: 500 }) }), []);
  assert.deepEqual(await oca.ocaBranches('3000', { fetchImpl: async () => { throw new Error('red'); } }), []);
});

// ---------- registro del retiro ----------
const ORDER = { orderNumber: 12, firstName: 'María José', lastName: 'Gómez & Hijos', phone: '3424 556677', email: 'maria@x.com', isBranch: false, address: { street: 'Bv. Gálvez', number: '1234', apartment: '3b', city: 'Santa Fe', province: 'Santa Fe', zipCode: '3000', branchId: '' }, items: [{ quantity: 2, weight: 0.7, width: 12, height: 8, length: 20 }] };

test('shipment XML: normalized, escaped and carrying the real weight and box', () => {
  const xml = oca.buildIngresoOrXml({ cfg: CFG, operativa: '111', order: ORDER, centroOrigen: '44', centroCosto: '9', date: new Date('2026-10-05T12:00:00Z') });
  assert.match(xml, /^<\?xml version="1.0" encoding="iso-8859-1" standalone="yes"\?><ROWS>/);
  assert.match(xml, /nrocuenta="5555"/); assert.match(xml, /calle="AVENIDA URQUIZA" nro="123"/); assert.match(xml, /contacto="Jose Perez"/);
  assert.match(xml, /centrocosto="9"/); assert.match(xml, /idcentroimposicionorigen="44"/); assert.match(xml, /fecha="20261005"/);
  assert.match(xml, /idoperativa="111" nroremito="12"/);
  assert.match(xml, /apellido="Gomez &amp; Hijos" nombre="Maria Jose" calle="Bv. Galvez" nro="1234" piso="3" depto="B" localidad="SANTA FE" provincia="SANTA FE" cp="3000"/);
  assert.match(xml, /idci="0"/);
  assert.match(xml, /<paquete alto="8" ancho="12" largo="20" peso="2" valor="0" cant="1" \/>/, '2 x 0,7 kg = 1,4 -> 2 kg; medidas del artículo');
});

test('shipment XML: branch delivery carries the branch id; CABA is normalized', () => {
  const xml = oca.buildIngresoOrXml({ cfg: CFG, operativa: '222', order: { ...ORDER, isBranch: true, address: { ...ORDER.address, province: 'CABA', city: 'Palermo', branchId: '321' } }, centroOrigen: '0', centroCosto: '1' });
  assert.match(xml, /localidad="CAPITAL FEDERAL" provincia="CAPITAL FEDERAL"/); assert.match(xml, /idci="321"/); assert.match(xml, /idoperativa="222"/);
});

test('shipment response: success returns the pickup order number; rejections and auth errors explain why', async () => {
  const ok = diffgram('<Resultado xmlns=""><Resumen><CodigoOperacion>999</CodigoOperacion><CantidadIngresados>1</CantidadIngresados><CantidadRechazados>0</CantidadRechazados></Resumen><DetalleIngresos><OrdenRetiro>6543210</OrdenRetiro><NumeroEnvio>1</NumeroEnvio></DetalleIngresos></Resultado>');
  assert.equal(await oca.parseIngresoOrResponse(ok), '6543210');
  const noDetail = diffgram('<Resultado xmlns=""><Resumen><CodigoOperacion>999</CodigoOperacion><CantidadIngresados>1</CantidadIngresados><CantidadRechazados>0</CantidadRechazados></Resumen></Resultado>');
  assert.equal(await oca.parseIngresoOrResponse(noDetail), '999', 'sin detalle usa el código de operación');
  const rejected = diffgram('<Resultado xmlns=""><Resumen><CantidadIngresados>0</CantidadIngresados><CantidadRechazados>1</CantidadRechazados></Resumen><DetalleRechazos><Motivo>Código postal inexistente</Motivo></DetalleRechazos></Resultado>');
  await assert.rejects(oca.parseIngresoOrResponse(rejected), /OCA rechazó el envío: Código postal inexistente/);
  await assert.rejects(oca.parseIngresoOrResponse('<Error><Descripcion>Usuario o contraseña inválidos</Descripcion></Error>'), /OCA: Usuario o contraseña inválidos/);
  await assert.rejects(oca.parseIngresoOrResponse(diffgram('<Resultado xmlns=""><Resumen><CantidadIngresados>1</CantidadIngresados></Resumen></Resultado>')), /número de orden válido/);
});

test('shipment over the network: sends credentials as a form post and requires complete configuration', async () => {
  const calls = [];
  const ok = diffgram('<Resultado xmlns=""><Resumen><CodigoOperacion>1</CodigoOperacion><CantidadIngresados>1</CantidadIngresados></Resumen><DetalleIngresos><OrdenRetiro>777</OrdenRetiro></DetalleIngresos></Resultado>');
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? String(init.body) : '' });
    return new Response(String(url).includes('IngresoORMultiplesRetiros') ? ok : diffgram('<NewDataSet xmlns=""><Table><IdCentroImposicion>5</IdCentroImposicion></Table></NewDataSet>'));
  };
  const result = await oca.ocaIngresoOr(CFG, ORDER, { fetchImpl });
  assert.equal(result.nroOR, '777');
  const post = calls.find((c) => c.url.includes('IngresoORMultiplesRetiros'));
  assert.match(post.body, /usr=u%40x\.com/); assert.match(post.body, /psw=secreto/); assert.match(post.body, /ConfirmarRetiro=true/); assert.match(post.body, /XML_Datos=/);
  await assert.rejects(oca.ocaIngresoOr({ ...CFG, password: null }, ORDER, { fetchImpl }), /Configuración de OCA incompleta/);
  await assert.rejects(oca.ocaIngresoOr(CFG, ORDER, { fetchImpl: async () => { throw new Error('x'); } }), /No pudimos conectar/);
});

// ---------- rótulo ----------
test('label: decodes the base64 PDF that OCA wraps in XML, or passes a raw PDF through', async () => {
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 65)]);
  const wrapped = `<?xml version="1.0"?><base64Binary xmlns="http://webservice.oca.com.ar/">${pdf.toString('base64')}</base64Binary>`;
  const out = await oca.ocaLabelPdf('123', { fetchImpl: async () => new Response(wrapped, { headers: { 'content-type': 'text/xml' } }) });
  assert.deepEqual(out, pdf);
  const raw = await oca.ocaLabelPdf('123', { fetchImpl: async () => new Response(pdf, { headers: { 'content-type': 'application/pdf' } }) });
  assert.deepEqual(raw, pdf);
  await assert.rejects(oca.ocaLabelPdf('123', { fetchImpl: async () => new Response('<x>corto</x>', { headers: { 'content-type': 'text/xml' } }) }), /PDF válido/);
  await assert.rejects(oca.ocaLabelPdf('123', { fetchImpl: async () => new Response('x', { status: 500 }) }), /No se pudo obtener el rótulo/);
});
