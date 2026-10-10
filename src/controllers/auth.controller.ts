import { Request, Response } from 'express';
import { authService } from '../services/auth.service';

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const clientInfo = {
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        deviceModel: req.body.deviceModel,
        platform: req.body.platform,
        appVersion: req.body.appVersion,
      };
      const result = await authService.login(req.body, clientInfo);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(401).json({ success: false, message: err.message });
    }
  },

  async register(req: Request, res: Response) {
    try {
      const user = await authService.register(req.body);
      res.status(201).json({ success: true, data: user, message: 'User registered successfully' });
    } catch (err: any) {
      const status = err.message.includes('already') ? 409 : 400;
      res.status(status).json({ success: false, message: err.message });
    }
  },

  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });
      const tokens = await authService.refreshTokens(refreshToken);
      res.json({ success: true, data: tokens });
    } catch (err: any) {
      res.status(401).json({ success: false, message: err.message });
    }
  },

  async logout(req: Request, res: Response) {
    try {
      const { refreshToken, reason } = req.body;
      const userId = (req as any).user?.userId;
      await authService.logout(refreshToken, userId, reason);
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  async me(req: Request, res: Response) {
    try {
      const user = await authService.getMe(req.user!.userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, data: user });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async heartbeat(req: Request, res: Response) {
    try {
      const clientInfo = {
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };
      const result = await authService.heartbeat(req.user!.userId, clientInfo);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

