import { Static, TSchema, Type } from '@sinclair/typebox';

const ErrorResponseSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    traceId: Type.String(),
  }),
});

const MetaSchema = Type.Object({
  page: Type.Integer({ minimum: 1 }),
  limit: Type.Integer({ minimum: 1 }),
  total: Type.Integer({ minimum: 0 }),
  totalPages: Type.Integer({ minimum: 0 }),
});

const PaginationQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  },
  { additionalProperties: false },
);

const createDataResponseSchema = <TData extends TSchema>(dataSchema: TData) =>
  Type.Object({
    data: dataSchema,
  });

const createPaginatedResponseSchema = <TItem extends TSchema>(itemSchema: TItem) =>
  Type.Object({
    data: Type.Array(itemSchema),
    meta: MetaSchema,
  });

type Meta = Static<typeof MetaSchema>;
type PaginationQuery = Static<typeof PaginationQuerySchema>;

export {
  createDataResponseSchema,
  createPaginatedResponseSchema,
  ErrorResponseSchema,
  Meta,
  MetaSchema,
  PaginationQuery,
  PaginationQuerySchema,
};
