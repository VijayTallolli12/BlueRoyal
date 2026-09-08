import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../core/middleware/validate.middleware';
import { authenticate } from '../../core/middleware/auth.middleware';
import { loginSchema, refreshTokenSchema } from './auth.schemas';

export const authRouter = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Authenticate user credentials and return access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       422:
 *         description: Validation failure
 */
authRouter.post('/login', validate(loginSchema), AuthController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token using HttpOnly cookie or body token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Expired or revoked refresh token
 */
authRouter.post('/refresh', validate(refreshTokenSchema), AuthController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke session and clear refresh token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
authRouter.post('/logout', AuthController.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user profile and active permissions
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Unauthorized
 */
authRouter.get('/me', authenticate, AuthController.me);
