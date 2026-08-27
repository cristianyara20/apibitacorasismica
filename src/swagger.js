// src/swagger.js
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

/**
 * Configuración básica de OpenAPI 3.0
 */
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Bitácora Sísmica API',
    version: '1.0.0',
    description: 'API para gestionar eventos sísmicos y consultar resúmenes.',
  },
  servers: [
    {
      url: 'http://localhost:3000', // Cambia si despliegas a otro host/puerto
    },
  ],
};

/**
 * Opciones de swagger‑jsdoc
 *  - `apis` indica dónde buscar los comentarios JSDoc.
 */
const options = {
  swaggerDefinition,
  // Busca los comentarios en todos los archivos .js dentro de src
  apis: ['./src/**/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

/**
 * Middleware que expone Swagger UI bajo la ruta `/api-docs`.
 */
function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = setupSwagger;