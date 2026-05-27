import { FastifyReply, FastifyRequest } from 'fastify';
import { JwtTokenProvider } from '../auth/JwtTokenProvider';
import { User, UserTokenEntity } from '../entities';
import { AppError } from '../errors/AppError';
import { UserTokenMapper } from '../mappers/UserTokenMapper';

const tokenProvider = new JwtTokenProvider();

const authenticateUser = async (request: FastifyRequest, _reply: FastifyReply) => {
  const accessToken = getBearerToken(request.headers.authorization);

  if (!accessToken) {
    throw new AppError('INVALID_ACCESS_TOKEN');
  }

  const verifiedToken = verifyAccessToken(accessToken);
  const accessTokenHash = UserTokenMapper.hashToken(accessToken);
  const userTokenRepository = request.server.db.getRepository(UserTokenEntity);
  const tokenRow = await userTokenRepository.findOneBy({ accessTokenHash });

  if (
    !tokenRow ||
    tokenRow.revokedAt ||
    tokenRow.accessTokenExpiresAt.getTime() <= Date.now() ||
    tokenRow.userId !== verifiedToken.userId
  ) {
    throw new AppError('INVALID_ACCESS_TOKEN');
  }

  const userRepository = request.server.db.getRepository(User);
  const user = await userRepository.findOneBy({ id: verifiedToken.userId });

  if (!user) {
    throw new AppError('INVALID_ACCESS_TOKEN');
  }

  request.user = user;
};

const getBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

const verifyAccessToken = (accessToken: string): { userId: string } => {
  try {
    return tokenProvider.verifyAccessToken(accessToken);
  } catch (_error) {
    throw new AppError('INVALID_ACCESS_TOKEN');
  }
};

export { authenticateUser };
