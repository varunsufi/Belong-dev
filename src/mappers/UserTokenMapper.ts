import { createHash } from 'crypto';
import { config } from '../config';
import { User, UserTokenEntity } from '../entities';
import { TokenPair } from '../schemas/auth';

const durationPattern = /^(\d+)([mhd])$/;
const durationMultipliers: Record<string, number> = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export class UserTokenMapper {
  static toEntity(user: User, tokens: TokenPair, existingToken?: UserTokenEntity | null): UserTokenEntity {
    const token = existingToken ?? new UserTokenEntity();

    token.userId = user.id;
    token.user = user;
    token.accessTokenHash = UserTokenMapper.hashToken(tokens.accessToken);
    token.refreshTokenHash = UserTokenMapper.hashToken(tokens.refreshToken);
    token.accessTokenExpiresAt = UserTokenMapper.expiresAt(config.jwt.accessExpiresIn);
    token.refreshTokenExpiresAt = UserTokenMapper.expiresAt(config.jwt.refreshExpiresIn);
    token.revokedAt = null;

    return token;
  }

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private static expiresAt(duration: string): Date {
    return new Date(Date.now() + UserTokenMapper.durationToMs(duration));
  }

  private static durationToMs(duration: string): number {
    const match = durationPattern.exec(duration);

    if (!match) {
      throw new Error(`Unsupported token duration: ${duration}`);
    }

    const [, amount, unit] = match;
    return Number(amount) * durationMultipliers[unit];
  }
}
