import jwt, { SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { User } from '../entities';
import { TokenPair } from '../schemas/auth';
import { TokenProvider } from './TokenProvider';

type TokenType = 'access' | 'refresh';

export interface AuthTokenPayload {
  sub: string;
  type: TokenType;
  jti: string;
}

export class JwtTokenProvider implements TokenProvider {
  createTokenPair(user: User): TokenPair {
    return {
      accessToken: this.signToken(user, 'access'),
      refreshToken: this.signToken(user, 'refresh'),
    };
  }

  verifyAccessToken(accessToken: string): { userId: string } {
    const payload = jwt.verify(accessToken, config.jwt.accessSecret);

    if (!isAuthTokenPayload(payload) || payload.type !== 'access') {
      throw new Error('Invalid access token payload');
    }

    return { userId: payload.sub };
  }

  verifyRefreshToken(refreshToken: string): { userId: string } {
    const payload = jwt.verify(refreshToken, config.jwt.refreshSecret);

    if (!isAuthTokenPayload(payload) || payload.type !== 'refresh') {
      throw new Error('Invalid refresh token payload');
    }

    return { userId: payload.sub };
  }

  private signToken(user: User, type: TokenType): string {
    const payload: AuthTokenPayload = {
      sub: user.id,
      type,
      jti: randomUUID(),
    };
    const secret = type === 'access' ? config.jwt.accessSecret : config.jwt.refreshSecret;
    const expiresIn = type === 'access' ? config.jwt.accessExpiresIn : config.jwt.refreshExpiresIn;
    const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };

    return jwt.sign(payload, secret, options);
  }
}

const isAuthTokenPayload = (payload: unknown): payload is AuthTokenPayload => {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'sub' in payload &&
    'type' in payload &&
    'jti' in payload &&
    typeof (payload as AuthTokenPayload).sub === 'string' &&
    typeof (payload as AuthTokenPayload).jti === 'string'
  );
};
