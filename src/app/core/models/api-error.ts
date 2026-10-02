/** Matches the { message, errors } shape written by Presentation/Middleware/ApiExceptionHandler.cs. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly errors: Record<string, string[]> | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
