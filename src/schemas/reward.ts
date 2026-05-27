import { Static, Type } from '@sinclair/typebox';
import { RewardRedemptionStatus } from '../entities';

const RewardIdParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

const RewardResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  description: Type.String(),
  pointsCost: Type.Integer({ minimum: 1 }),
});

const RewardRedemptionResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  rewardId: Type.String({ format: 'uuid' }),
  pointsSpent: Type.Integer({ minimum: 1 }),
  status: Type.Enum(RewardRedemptionStatus),
  totalPoints: Type.Optional(Type.Integer({ minimum: 0 })),
});

type RewardIdParams = Static<typeof RewardIdParamsSchema>;
type RewardRedemptionResponse = Static<typeof RewardRedemptionResponseSchema>;
type RewardResponse = Static<typeof RewardResponseSchema>;

export {
  RewardIdParams,
  RewardIdParamsSchema,
  RewardRedemptionResponse,
  RewardRedemptionResponseSchema,
  RewardResponse,
  RewardResponseSchema,
};
