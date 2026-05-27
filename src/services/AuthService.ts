import bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { JwtTokenProvider } from '../auth/JwtTokenProvider';
import { TokenProvider } from '../auth/TokenProvider';
import { AppError } from '../errors/AppError';
import { User, UserTokenEntity } from '../entities';
import { UserMapper } from '../mappers/UserMapper';
import { UserTokenMapper } from '../mappers/UserTokenMapper';
import { LoginBody, RefreshTokenBody, RegisterBody, RegisteredUserResponse, TokenPair } from '../schemas/auth';

const PASSWORD_SALT_ROUNDS = 12;

export class AuthService {
  constructor(
    private readonly db: DataSource,
    private readonly tokenProvider: TokenProvider = new JwtTokenProvider(),
  ) {
  }

  async register(input: RegisterBody): Promise<RegisteredUserResponse> {
    const userRepository = this.db.getRepository(User);
    const normalizedEmail = UserMapper.normalizeEmail(input.email);
    const existingUser = await userRepository.findOneBy({ email: normalizedEmail });

    if (existingUser) {
      throw new AppError('EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);
    const user = UserMapper.toEntity({
      email: normalizedEmail,
      passwordHash,
      displayName: input.displayName,
    });

    try {
      const savedUser = await userRepository.save(user);
      return UserMapper.toRegisteredResponse(savedUser);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('EMAIL_ALREADY_EXISTS');
      }

      throw error;
    }
  }

  async login(input: LoginBody): Promise<TokenPair> {
    const userRepository = this.db.getRepository(User);
    const userTokenRepository = this.db.getRepository(UserTokenEntity);
    const normalizedEmail = UserMapper.normalizeEmail(input.email);
    const user = await userRepository.findOneBy({ email: normalizedEmail });

    if (!user) {
      throw new AppError('INVALID_CREDENTIALS');
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError('INVALID_CREDENTIALS');
    }

    const tokens = this.tokenProvider.createTokenPair(user);
    const existingToken = await userTokenRepository.findOneBy({ userId: user.id });

    if (existingToken) {
      existingToken.revokedAt = new Date();
      await userTokenRepository.save(existingToken);
    }

    const tokenEntity = UserTokenMapper.toEntity(user, tokens);

    await userTokenRepository.save(tokenEntity);

    return tokens;
  }

  async refresh(input: RefreshTokenBody): Promise<TokenPair> {
    const userRepository = this.db.getRepository(User);
    const userTokenRepository = this.db.getRepository(UserTokenEntity);
    const verifiedToken = this.verifyRefreshToken(input.refreshToken);
    const refreshTokenHash = UserTokenMapper.hashToken(input.refreshToken);
    const currentToken = await userTokenRepository.findOneBy({ refreshTokenHash });

    if (
      !currentToken ||
      currentToken.revokedAt ||
      currentToken.refreshTokenExpiresAt.getTime() <= Date.now() ||
      currentToken.userId !== verifiedToken.userId
    ) {
      throw new AppError('INVALID_REFRESH_TOKEN');
    }

    const user = await userRepository.findOneBy({ id: verifiedToken.userId });

    if (!user) {
      throw new AppError('INVALID_REFRESH_TOKEN');
    }

    currentToken.revokedAt = new Date();
    await userTokenRepository.save(currentToken);

    const tokens = this.tokenProvider.createTokenPair(user);
    const newToken = UserTokenMapper.toEntity(user, tokens);
    await userTokenRepository.save(newToken);

    return tokens;
  }

  async logout(input: RefreshTokenBody): Promise<void> {
    const userTokenRepository = this.db.getRepository(UserTokenEntity);
    const refreshTokenHash = UserTokenMapper.hashToken(input.refreshToken);
    const currentToken = await userTokenRepository.findOneBy({ refreshTokenHash });

    if (!currentToken || currentToken.revokedAt) {
      return;
    }

    currentToken.revokedAt = new Date();
    await userTokenRepository.save(currentToken);
  }

  private verifyRefreshToken(refreshToken: string): { userId: string } {
    try {
      return this.tokenProvider.verifyRefreshToken(refreshToken);
    } catch (_error) {
      throw new AppError('INVALID_REFRESH_TOKEN');
    }
  }
}

const isUniqueViolation = (error: unknown): boolean => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
};
