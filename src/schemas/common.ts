import { TSchema, Type } from '@sinclair/typebox';

const ErrorResponseSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    traceId: Type.String(),
  }),
});


const createDataResponseSchema = <TData extends TSchema>(dataSchema: TData) =>
  Type.Object({
    data: dataSchema,
  });


export {
  createDataResponseSchema,
  ErrorResponseSchema,
};
