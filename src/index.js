// src/index.js

require('dotenv').config();
console.log('🛠️  DATABASE_URL:', process.env.DATABASE_URL);

// Habilitar serialización JSON para números BigInt devueltos por PostgreSQL
BigInt.prototype.toJSON = function () {
  return Number(this);
};

const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const prisma = require('./prisma'); // Prisma client

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Bitácora de Impactos',
      version: '1.0.0',
      description: 'Documentación de los endpoints de la API',
    },
  },
  apis: ['./src/**/*.js'], // escanear archivos con JSDoc Swagger
});

const app = express();
app.use(cors());
app.use(express.json());

// Setup Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Ruta raíz para comprobar que el servidor está activo
app.get('/', (req, res) => {
  res.json({ mensaje: 'API de Bitácora de Impactos está corriendo' });
});

// Register API routes
app.use('/api', require('./rutas/index'));

// Test database connection at startup
(async () => {
  try {
    await prisma.$connect();
    console.log('✅ Conexión a la base de datos establecida correctamente');
  } catch (err) {
    console.error('❌ Error al conectar a la base de datos:', err.message);
  }
})();

const PORT = process.env.PORT || 3000;
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
  });
}

module.exports = app;