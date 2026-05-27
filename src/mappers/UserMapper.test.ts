import { UserMapper } from './UserMapper';
import { User } from '../entities';

describe('UserMapper', () => {
  it('maps register input to a normalized User entity', () => {
    const user = UserMapper.toEntity({
      email: ' FAN@Example.COM ',
      passwordHash: 'hashed-password',
      displayName: ' Belong Fan ',
    });

    expect(user.email).toBe('fan@example.com');
    expect(user.passwordHash).toBe('hashed-password');
    expect(user.displayName).toBe('Belong Fan');
    expect(user.totalPoints).toBe(0);
  });

  it('maps a saved user to the public registration response', () => {
    const user = UserMapper.toEntity({
      email: 'fan@example.com',
      passwordHash: 'hashed-password',
      displayName: 'Belong Fan',
    });

    expect(UserMapper.toRegisteredResponse(user)).toEqual({
      email: 'fan@example.com',
      displayName: 'Belong Fan',
    });
  });

  it('maps a user to the public profile response', () => {
    const user = Object.assign(new User(), {
      id: '6b7d31b8-5f07-4efa-83b1-bf5bb86ab6de',
      email: 'fan@example.com',
      displayName: 'Belong Fan',
      passwordHash: 'hashed-password',
      totalPoints: 325,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const profile = UserMapper.toProfileResponse(user);

    expect(profile).toEqual({
      id: '6b7d31b8-5f07-4efa-83b1-bf5bb86ab6de',
      email: 'fan@example.com',
      displayName: 'Belong Fan',
      totalPoints: 325,
    });
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile).not.toHaveProperty('createdAt');
    expect(profile).not.toHaveProperty('updatedAt');
  });
});
