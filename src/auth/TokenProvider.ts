import { User } from '../entities';
import { TokenPair } from '../schemas/auth';

export interface TokenProvider {
  createTokenPair(user: User): TokenPair;

  verifyAccessToken(accessToken: string): { userId: string };

  verifyRefreshToken(refreshToken: string): { userId: string };
}
