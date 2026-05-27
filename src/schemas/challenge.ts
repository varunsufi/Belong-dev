import { Static, Type } from '@sinclair/typebox';
import { ChallengeDifficulty } from '../entities';

const ChallengeIdParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

const ChallengeDifficultySchema = Type.Enum(ChallengeDifficulty);

const ListChallengesQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
    difficulty: Type.Optional(ChallengeDifficultySchema),
  },
  { additionalProperties: false },
);

const CompleteChallengeBodySchema = Type.Object(
  {
    listenPercentage: Type.Number({ minimum: 0, maximum: 100 }),
  },
  { additionalProperties: false },
);

const CreateChallengeBodySchema = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 160, pattern: '\\S' }),
    artist: Type.String({ minLength: 1, maxLength: 160, pattern: '\\S' }),
    description: Type.String({ minLength: 1, pattern: '\\S' }),
    points: Type.Integer({ minimum: 1 }),
    durationSeconds: Type.Integer({ minimum: 1 }),
    difficulty: ChallengeDifficultySchema,
    isActive: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

const UpdateChallengeBodySchema = Type.Partial(
  Type.Object(
    {
      title: Type.String({ minLength: 1, maxLength: 160, pattern: '\\S' }),
      description: Type.String({ minLength: 1, pattern: '\\S' }),
      points: Type.Integer({ minimum: 1 }),
      isActive: Type.Boolean(),
    },
    { additionalProperties: false },
  ),
  { additionalProperties: false, minProperties: 1 },
);

const AdminListChallengesQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
    difficulty: Type.Optional(ChallengeDifficultySchema),
    isActive: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

const ChallengeResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  title: Type.String(),
  artist: Type.String(),
  description: Type.String(),
  points: Type.Integer(),
  durationSeconds: Type.Integer(),
  difficulty: Type.Enum(ChallengeDifficulty),
});

const ChallengeCompletionResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  challengeId: Type.String({ format: 'uuid' }),
  pointsEarned: Type.Integer(),
  listenPercentage: Type.Number({ minimum: 0, maximum: 100 }),
  totalPoints: Type.Integer({ minimum: 0 }),
});

const AdminChallengeResponseSchema = Type.Intersect([
  ChallengeResponseSchema,
  Type.Object({
    isActive: Type.Boolean(),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  }),
]);

type AdminChallengeResponse = Static<typeof AdminChallengeResponseSchema>;
type AdminListChallengesQuery = Static<typeof AdminListChallengesQuerySchema>;
type ChallengeIdParams = Static<typeof ChallengeIdParamsSchema>;
type ChallengeCompletionResponse = Static<typeof ChallengeCompletionResponseSchema>;
type CompleteChallengeBody = Static<typeof CompleteChallengeBodySchema>;
type CreateChallengeBody = Static<typeof CreateChallengeBodySchema>;
type ListChallengesQuery = Static<typeof ListChallengesQuerySchema>;
type ChallengeResponse = Static<typeof ChallengeResponseSchema>;
type UpdateChallengeBody = Static<typeof UpdateChallengeBodySchema>;

export {
  AdminChallengeResponse,
  AdminChallengeResponseSchema,
  AdminListChallengesQuery,
  AdminListChallengesQuerySchema,
  ChallengeDifficultySchema,
  ChallengeIdParams,
  ChallengeIdParamsSchema,
  ChallengeCompletionResponse,
  ChallengeCompletionResponseSchema,
  CompleteChallengeBody,
  CompleteChallengeBodySchema,
  CreateChallengeBody,
  CreateChallengeBodySchema,
  ListChallengesQuery,
  ListChallengesQuerySchema,
  ChallengeResponse,
  ChallengeResponseSchema,
  UpdateChallengeBody,
  UpdateChallengeBodySchema,
};
