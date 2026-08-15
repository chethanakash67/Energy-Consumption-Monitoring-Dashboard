/** Error carrying an HTTP status, so route handlers can just `throw`. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, details);
export const unauthorized = (message = 'Not authenticated') => new HttpError(401, message);
export const forbidden = (message = 'Not permitted') => new HttpError(403, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

/**
 * Wraps an async route handler so rejected promises reach the error middleware
 * instead of hanging the request (Express 4 does not await handlers).
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(handler: T) {
  return (req: any, res: any, next: any) => {
    handler(req, res, next).catch(next);
  };
}
