const express = require('express');
const router = express.Router();

const { registrarDispositivo } = require('../controladores/dispositivos');
const { crearEvento, crearEventosLote, obtenerEventos, obtenerResumen } = require('../controladores/eventos');

router.post('/dispositivos', registrarDispositivo);
router.post('/eventos', crearEvento);
router.post('/eventos/lote', crearEventosLote);
router.get('/eventos', obtenerEventos);
router.get('/eventos/resumen', obtenerResumen);

// Ruta raíz para verificar que el servidor está activo
router.get('/', (req, res) => {
  res.json({ mensaje: 'API de Bitácora de Impactos está corriendo' });
});

module.exports = router;
