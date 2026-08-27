const prisma = require('../prisma');

/**
 * @swagger
 * /api/dispositivos:
 *   post:
 *     summary: Registrar o actualizar un dispositivo
 *     description: Registra un nuevo dispositivo o actualiza su modelo si ya existe. Devuelve el UUID del dispositivo.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identificador
 *             properties:
 *               identificador:
 *                 type: string
 *                 example: "DISP-001"
 *               modelo:
 *                 type: string
 *                 example: "Sensor-X100"
 *     responses:
 *       201:
 *         description: Dispositivo registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *       400:
 *         description: Falta el identificador
 *       500:
 *         description: Error interno del servidor
 */
async function registrarDispositivo(req, res, next) {
  try {
    const { identificador, modelo } = req.body;
    if (!identificador) {
      return res.status(400).json({ error: 'El campo identificador es obligatorio' });
    }
    const dispositivo = await prisma.dispositivo.upsert({
      where: { identificador },
      update: { modelo },
      create: { identificador, modelo }
    });
    res.status(201).json({ id: dispositivo.id, identificador: dispositivo.identificador, modelo: dispositivo.modelo });
  } catch(e) {
    next(e);
  }
}

module.exports = { registrarDispositivo };

