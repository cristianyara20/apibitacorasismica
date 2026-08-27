// src/controladores/eventos.js
const prisma = require('../prisma');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEVERIDADES_VALIDAS = ['leve', 'moderado', 'fuerte'];

function normalizarSeveridad(sev) {
  if (!sev) return 'moderado';
  const s = String(sev).trim().toLowerCase();
  return SEVERIDADES_VALIDAS.includes(s) ? s : 'moderado';
}

/**
 * @swagger
 * /api/eventos:
 *   get:
 *     summary: Obtener todos los eventos
 *     description: Retorna la lista completa de eventos de impacto sísmico.
 *     responses:
 *       200:
 *         description: Lista de eventos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EventoImpacto'
 *                 total:
 *                   type: integer
 *       500:
 *         description: Error interno del servidor
 */
async function obtenerEventos(req, res, next) {
  try {
    const eventos = await prisma.evento_impacto.findMany({ orderBy: { ocurrido_en: 'desc' } });
    res.status(200).json({ datos: eventos, total: eventos.length });
  } catch (e) {
    next(e);
  }
}

/**
 * @swagger
 * /api/eventos:
 *   post:
 *     summary: Crear un nuevo evento
 *     description: Registra o actualiza un evento de impacto para un dispositivo previamente registrado.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NuevoEvento'
 *     responses:
 *       201:
 *         description: Evento creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EventoImpacto'
 *       400:
 *         description: Datos faltantes o UUID de dispositivo inválido
 *       404:
 *         description: El dispositivo especificado no existe
 *       422:
 *         description: Marca de tiempo en el futuro
 *       500:
 *         description: Error interno del servidor
 */
async function crearEvento(req, res, next) {
  try {
    const { dispositivoId, claveCliente, magnitud, severidad, latitud, longitud, precisionM, ocurridoEn } = req.body;
    if (!dispositivoId || !claveCliente || magnitud == null || !ocurridoEn) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (dispositivoId, claveCliente, magnitud, ocurridoEn)' });
    }
    if (!UUID_REGEX.test(dispositivoId)) {
      return res.status(400).json({ error: 'dispositivoId debe ser un UUID válido (ej. registre un dispositivo en POST /api/dispositivos para obtener su id UUID)' });
    }
    if (new Date(ocurridoEn) > new Date(Date.now() + 60000)) {
      return res.status(422).json({ error: 'Marca de tiempo en el futuro' });
    }
    const evento = await prisma.evento_impacto.upsert({
      where: { dispositivo_id_clave_cliente: { dispositivo_id: dispositivoId, clave_cliente: claveCliente } },
      update: {},
      create: {
        dispositivo_id: dispositivoId,
        clave_cliente: claveCliente,
        magnitud: parseFloat(magnitud),
        severidad: normalizarSeveridad(severidad),
        latitud: latitud != null ? parseFloat(latitud) : null,
        longitud: longitud != null ? parseFloat(longitud) : null,
        precision_m: precisionM != null ? parseFloat(precisionM) : null,
        ocurrido_en: new Date(ocurridoEn)
      },
    });
    res.status(201).json(evento);
  } catch (e) {
    if (e.code === 'P2003') {
      return res.status(404).json({ error: `El dispositivo con id '${req.body.dispositivoId}' no existe en la base de datos. Primero créalo con POST /api/dispositivos` });
    }
    next(e);
  }
}

/**
 * @swagger
 * /api/eventos/lote:
 *   post:
 *     summary: Crear varios eventos en lote
 *     description: Registra múltiples eventos en una sola petición.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/NuevoEvento'
 *     responses:
 *       207:
 *         description: Eventos procesados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultado:
 *                   type: array
 *                   items:
 *                     type: string
 *                     format: uuid
 *       400:
 *         description: Formato de petición inválido
 *       500:
 *         description: Error interno del servidor
 */
async function crearEventosLote(req, res, next) {
  try {
    const eventos = req.body;
    if (!Array.isArray(eventos)) return res.status(400).json({ error: 'Se espera un array de eventos' });
    const creados = [];
    for (const ev of eventos) {
      const { dispositivoId, claveCliente, magnitud, severidad, latitud, longitud, precisionM, ocurridoEn } = ev;
      if (!dispositivoId || !claveCliente || magnitud == null || !ocurridoEn) continue;
      if (!UUID_REGEX.test(dispositivoId)) continue;
      try {
        const evento = await prisma.evento_impacto.upsert({
          where: { dispositivo_id_clave_cliente: { dispositivo_id: dispositivoId, clave_cliente: claveCliente } },
          update: {},
          create: {
            dispositivo_id: dispositivoId,
            clave_cliente: claveCliente,
            magnitud: parseFloat(magnitud),
            severidad: normalizarSeveridad(severidad),
            latitud: latitud != null ? parseFloat(latitud) : null,
            longitud: longitud != null ? parseFloat(longitud) : null,
            precision_m: precisionM != null ? parseFloat(precisionM) : null,
            ocurrido_en: new Date(ocurridoEn)
          },
        });
        creados.push(evento.id);
      } catch (innerError) {
        console.error('Error insertando evento de lote:', innerError.message);
      }
    }
    res.status(207).json({ resultado: creados });
  } catch (e) {
    next(e);
  }
}

/**
 * @swagger
 * /api/eventos/resumen:
 *   get:
 *     summary: Obtener resumen de eventos por severidad y día
 *     responses:
 *       200:
 *         description: Resumen agregado
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ResumenEvento'
 *       500:
 *         description: Error interno del servidor
 */
async function obtenerResumen(req, res, next) {
  try {
    const resumen = await prisma.$queryRaw`SELECT severidad, CAST(COUNT(*) AS INTEGER) as cantidad, date_trunc('day', ocurrido_en) as dia FROM evento_impacto GROUP BY severidad, dia ORDER BY dia DESC`;
    const datos = resumen.map(r => ({
      severidad: r.severidad,
      cantidad: Number(r.cantidad),
      dia: r.dia
    }));
    res.status(200).json(datos);
  } catch (e) {
    next(e);
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     EventoImpacto:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid, example: "58d3f2c0-0c3e-41d2-a6c5-007392aabb00" }
 *         dispositivo_id: { type: string, format: uuid, example: "7e7e4d0a-a858-4a02-b844-d0d0f7ad7c10" }
 *         clave_cliente: { type: string, example: "EVT-2026-001" }
 *         magnitud: { type: number, example: 4.8 }
 *         severidad: { type: string, enum: [leve, moderado, fuerte], example: "moderado" }
 *         latitud: { type: number, example: 4.711 }
 *         longitud: { type: number, example: -74.072 }
 *         precision_m: { type: number, example: 10 }
 *         ocurrido_en: { type: string, format: date-time, example: "2026-08-26T18:30:00.000Z" }
 *         recibido_en: { type: string, format: date-time, example: "2026-08-26T18:30:05.000Z" }
 *     NuevoEvento:
 *       type: object
 *       required:
 *         - dispositivoId
 *         - claveCliente
 *         - magnitud
 *         - ocurridoEn
 *       properties:
 *         dispositivoId:
 *           type: string
 *           format: uuid
 *           example: "7e7e4d0a-a858-4a02-b844-d0d0f7ad7c10"
 *         claveCliente:
 *           type: string
 *           example: "EVT-001"
 *         magnitud:
 *           type: number
 *           example: 5.2
 *         severidad:
 *           type: string
 *           enum: [leve, moderado, fuerte]
 *           example: "moderado"
 *         latitud:
 *           type: number
 *           example: 4.6097
 *         longitud:
 *           type: number
 *           example: -74.0817
 *         precisionM:
 *           type: number
 *           example: 15
 *         ocurridoEn:
 *           type: string
 *           format: date-time
 *           example: "2026-08-26T19:00:00.000Z"
 *     ResumenEvento:
 *       type: object
 *       properties:
 *         severidad: { type: string, example: "moderado" }
 *         cantidad: { type: integer, example: 12 }
 *         dia: { type: string, format: date-time, example: "2026-08-26T00:00:00.000Z" }
 */

module.exports = { crearEvento, crearEventosLote, obtenerEventos, obtenerResumen };

