import bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { TokenProvider } from '../auth/TokenProvider';
import { User, UserTokenEntity } from '../entities';
import { TokenPair } from '../schemas/auth';
import { AuthService } from './AuthService';

class FakeUserRepository {
  constructor(private readonly users: User[]) {
  }

  async findOneBy(where: { email?: string; id?: string }): Promise<User | null> {
    if (where.email) {
      return this.users.find((user) => user.email === where.email) ?? null;
    }

    if (where.id) {
      return this.users.find((user) => user.id === where.id) ?? null;
    }

    return null;
  }

  async save(user: User): Promise<User> {
    this.users.push(user);
    return user;
  }
}

class FakeUserTokenRepository {
  readonly tokens: UserTokenEntity[] = [];

  async findOneBy(where: { userId?: string; refreshTokenHash?: string }): Promise<UserTokenEntity | null> {
    if (where.userId) {
      return this.tokens.find((token) => token.userId === where.userId && !token.revokedAt) ?? null;
    }

    if (where.refreshTokenHash) {
      return this.tokens.find((token) => token.refreshTokenHash === where.refreshTokenHash) ?? null;
    }

    return null;
  }

  async save(token: UserTokenEntity): Promise<UserTokenEntity> {
    const existingIndex = this.tokens.findIndex((existingToken) => existingToken.id === token.id);

    if (existingIndex >= 0) {
      this.tokens[existingIndex] = token;
    } else {
      this.tokens.push(token);
    }

    return token;
  }
}

class FakeTokenProvider implements TokenProvider {
  createTokenPair(user: User): TokenPair {
    return {
      accessToken: `access-for-${user.id}`,
      refreshToken: `refresh-for-${user.id}`,
    };
  }

  verifyAccessToken(accessToken: string): { userId: string } {
    return {
      userId: accessToken.replace('access-for-', ''),
    };
  }

  verifyRefreshToken(refreshToken: string): { userId: string } {
    return {
      userId: refreshToken.replace('refresh-for-', ''),
    };
  }
}

const buildDataSource = (users: User[], userTokenRepository = new FakeUserTokenRepository()) =>
  ({
    getRepository: (entity: unknown) => {
      if (entity === User) {
        return new FakeUserRepository(users);
      }

      if (entity === UserTokenEntity) {
        return userTokenRepository;
      }

      throw new Error('Unexpected repository requested');
    },
  }) as unknown as DataSource;

describe('AuthService', () => {
  it('uses the injected token provider for login token generation', async () => {
    const user = new User();
    user.id = 'user-1';
    user.email = 'fan@example.com';
    user.passwordHash = await bcrypt.hash('strongPassword123', 4);
    user.displayName = 'Belong Fan';
    user.totalPoints = 0;

    const authService = new AuthService(buildDataSource([user]), new FakeTokenProvider());

    await expect(
      authService.login({
        email: 'FAN@example.com',
        password: 'strongPassword123',
      }),
    ).resolves.toEqual({
      accessToken: 'access-for-user-1',
      refreshToken: 'refresh-for-user-1',
    });
  });

  it('revokes an existing active token before saving a new login token', async () => {
    const user = new User();
    user.id = 'user-1';
    user.email = 'fan@example.com';
    user.passwordHash = await bcrypt.hash('strongPassword123', 4);
    user.displayName = 'Belong Fan';
    user.totalPoints = 0;

    const tokenRepository = new FakeUserTokenRepository();
    const existingToken = new UserTokenEntity();
    existingToken.id = 'token-1';
    existingToken.userId = user.id;
    existingToken.accessTokenHash = 'old-access-hash';
    existingToken.refreshTokenHash = 'old-refresh-hash';
    existingToken.accessTokenExpiresAt = new Date(Date.now() + 1000);
    existingToken.refreshTokenExpiresAt = new Date(Date.now() + 1000);
    existingToken.revokedAt = null;
    tokenRepository.tokens.push(existingToken);

    const authService = new AuthService(buildDataSource([user], tokenRepository), new FakeTokenProvider());

    await authService.login({
      email: 'fan@example.com',
      password: 'strongPassword123',
    });

    expect(tokenRepository.tokens).toHaveLength(2);
    expect(tokenRepository.tokens[0].revokedAt).toBeInstanceOf(Date);
    expect(tokenRepository.tokens[1]).toMatchObject({
      userId: user.id,
      revokedAt: null,
    });
  });
});
