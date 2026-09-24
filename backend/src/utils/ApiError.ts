export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
  static badRequest(msg = 'Bad request', details?: unknown) { return new ApiError(400, 'BAD_REQUEST', msg, details); }
  static unauthorized(msg = 'Authentication required') { return new ApiError(401, 'UNAUTHORIZED', msg); }
  static forbidden(msg = 'You do not have permission to perform this action') { return new ApiError(403, 'FORBIDDEN', msg); }
  static notFound(msg = 'Resource not found') { return new ApiError(404, 'NOT_FOUND', msg); }
  static conflict(msg = 'Conflict') { return new ApiError(409, 'CONFLICT', msg); }
}
