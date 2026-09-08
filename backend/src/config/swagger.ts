import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Blue Royal HRMS API',
      version: '1.0.0',
      description: 'API Documentation for Blue Royal Human Resource Management System',
    },
    servers: [
      {
        url: `${env.API_PREFIX}`,
        description: 'Current Environment API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.ts', './dist/modules/**/*.routes.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
