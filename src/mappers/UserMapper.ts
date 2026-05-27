import { User } from '../entities';
import { RegisteredUserResponse } from '../schemas/auth';
import { UserProfileResponse } from '../schemas/user';

export interface RegisterUserEntityInput {
  email: string;
  passwordHash: string;
  displayName: string;
}

export class UserMapper {
  static toEntity(input: RegisterUserEntityInput): User {
    const user = new User();

    user.email = UserMapper.normalizeEmail(input.email);
    user.passwordHash = input.passwordHash;
    user.displayName = input.displayName.trim();
    user.totalPoints = 0;

    return user;
  }

  static toRegisteredResponse(user: User): RegisteredUserResponse {
    return {
      email: user.email,
      displayName: user.displayName ?? '',
    };
  }

  static toProfileResponse(user: User): UserProfileResponse {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      totalPoints: user.totalPoints,
    };
  }

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
