import { Static, Type } from '@sinclair/typebox';

const LeaderboardEntrySchema = Type.Object({
  rank: Type.Integer({ minimum: 1 }),
  userId: Type.String({ format: 'uuid' }),
  displayName: Type.Union([Type.String(), Type.Null()]),
  totalPoints: Type.Integer({ minimum: 0 }),
});

type LeaderboardEntry = Static<typeof LeaderboardEntrySchema>;

export { LeaderboardEntry, LeaderboardEntrySchema };
