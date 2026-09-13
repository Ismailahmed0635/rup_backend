import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authService } from '../../app/services/auth.service';
import { oauthService } from '../../app/services/oauth.service';
import { prisma } from '../../app/config/database';
import { supabase } from '../../app/supabase';

export const authController = {
  register: async (req: Request, res: Response) => {
    try {
      const { email, password, name, store_name } = req.body;
      const result = await authService.register({ email, password, name, store_name });
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message, code: 'ERR_AUTH_REGISTER' });
    }
  },

  login: async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const result = await authService.login({ email, password });
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(401).json({ success: false, error: error.message, code: 'ERR_AUTH_LOGIN' });
    }
  },

  refresh: async (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      const revoked = await prisma.revokedToken.findUnique({
        where: { token },
      });
      if (revoked) {
        return res.status(401).json({ success: false, error: 'Token has been revoked', code: 'ERR_JWT_REVOKED' });
      }

      // Verify the current token with Supabase; mint a fresh session when valid
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: token });

      if (error || !data.session) {
        // Fall back to validating the token directly so the frontend can decide
        const { error: verifyError } = await supabase.auth.getUser(token);
        if (verifyError) {
          return res.status(401).json({ success: false, error: 'Invalid or expired token', code: 'ERR_TOKEN_INVALID' });
        }
        return res.json({ success: true, data: { jwt_token: token } });
      }

      res.json({ success: true, data: { jwt_token: data.session.access_token } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, code: 'ERR_AUTH_REFRESH' });
    }
  },

  logout: async (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      // SECURITY: a merchant may only revoke a token that belongs to them.
      // Without ownership verification, any authenticated merchant could revoke
      // another merchant's token (or bulk-revoke tokens) to log them out.
      const { data: { user: tokenOwner }, error: verifyError } = await supabase.auth.getUser(token);
      const callerStore = (req as any).store;
      const callerOwnsToken = callerStore && tokenOwner && callerStore.user_id === tokenOwner.id;

      if (!callerOwnsToken) {
        return res.status(403).json({
          success: false,
          error: 'You can only revoke your own tokens',
          code: 'ERR_LOGOUT_FORBIDDEN',
        });
      }

      const decoded = jwt.decode(token) as { exp?: number } | null;

      if (decoded?.exp) {
        const expiresAt = new Date(decoded.exp * 1000);
        await prisma.revokedToken.upsert({
          where: { token },
          update: {},
          create: { token, expires_at: expiresAt },
        });
      }

      res.json({ success: true, data: { message: 'Logged out successfully' } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, code: 'ERR_AUTH_LOGOUT' });
    }
  },

  oauthSync: async (req: Request, res: Response) => {
    try {
      const { name, provider, provider_user_id, jwt_token } = req.body;

      if (!provider || !provider_user_id || !jwt_token) {
        res.status(400).json({ success: false, error: 'Missing required fields', code: 'ERR_OAUTH_MISSING_FIELDS' });
        return;
      }

      // SECURITY: verify the JWT token is valid and use the EMAIL FROM THE VERIFIED
      // TOKEN, never from the request body. Trusting body email allows an attacker
      // to take over any merchant account just by knowing its email address.
      const { data: { user: supaUser }, error: verifyError } = await supabase.auth.getUser(jwt_token);

      if (verifyError || !supaUser) {
        res.status(401).json({ success: false, error: 'Invalid OAuth token', code: 'ERR_OAUTH_INVALID_TOKEN' });
        return;
      }

      const verifiedEmail = supaUser.email;
      if (!verifiedEmail) {
        res.status(401).json({ success: false, error: 'Token has no email claim', code: 'ERR_OAUTH_NO_EMAIL' });
        return;
      }

      // Sync user to local DB using the verified identity
      const result = await oauthService.syncOAuthUser({
        email: verifiedEmail,
        name,
        provider,
        providerUserId: provider_user_id,
      });

      res.json({
        success: true,
        data: {
          ...result,
          jwt_token,
          supa_user_id: provider_user_id,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, code: 'ERR_OAUTH_SYNC' });
    }
  },

  forgotPassword: async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ success: false, error: 'Email is required', code: 'ERR_FORGOT_PASSWORD_EMAIL' });
        return;
      }

      // Send password reset email via Supabase
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`,
      });

      if (error) {
        res.status(400).json({ success: false, error: error.message, code: 'ERR_FORGOT_PASSWORD' });
        return;
      }

      res.json({ success: true, data: { message: 'Password reset email sent' } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, code: 'ERR_FORGOT_PASSWORD' });
    }
  },

  resetPassword: async (req: Request, res: Response) => {
    try {
      const { access_token, refresh_token, new_password } = req.body;

      if (!access_token || !refresh_token || !new_password) {
        res.status(400).json({ success: false, error: 'Missing required fields', code: 'ERR_RESET_PASSWORD_MISSING' });
        return;
      }

      // Set the session with the tokens
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError) {
        res.status(401).json({ success: false, error: 'Invalid or expired reset token', code: 'ERR_RESET_PASSWORD_SESSION' });
        return;
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: new_password,
      });

      if (updateError) {
        res.status(400).json({ success: false, error: updateError.message, code: 'ERR_RESET_PASSWORD_UPDATE' });
        return;
      }

      res.json({ success: true, data: { message: 'Password updated successfully' } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, code: 'ERR_RESET_PASSWORD' });
    }
  },
};
