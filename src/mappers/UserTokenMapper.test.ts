import { User } from '../entities';
import { UserTokenMapper } from './UserTokenMapper';

describe('UserTokenMapper', () => {
  it('hashes tokens deterministically without storing raw token values', () => {
    const user = new User();
    user.id = 'user-1';

    const tokenEntity = UserTokenMapper.toEntity(user, {
      accessToken: 'raw-access-token',
      refreshToken: 'raw-refresh-token',
    });

    expect(tokenEntity.userId).toBe('user-1');
    expect(tokenEntity.accessTokenHash).toBe(UserTokenMapper.hashToken('raw-access-token'));
    expect(tokenEntity.refreshTokenHash).toBe(UserTokenMapper.hashToken('raw-refresh-token'));
    expect(tokenEntity.accessTokenHash).not.toBe('raw-access-token');
    expect(tokenEntity.refreshTokenHash).not.toBe('raw-refresh-token');
    expect(tokenEntity.revokedAt).toBeNull();
  });

  it('sets access and refresh expiry timestamps', () => {
    const before = Date.now();
    const user = new User();
    user.id = 'user-1';

    const tokenEntity = UserTokenMapper.toEntity(user, {
      accessToken: 'raw-access-token',
      refreshToken: 'raw-refresh-token',
    });

    expect(tokenEntity.accessTokenExpiresAt.getTime()).toBeGreaterThan(before);
    expect(tokenEntity.refreshTokenExpiresAt.getTime()).toBeGreaterThan(
      tokenEntity.accessTokenExpiresAt.getTime(),
    );
  });
});

