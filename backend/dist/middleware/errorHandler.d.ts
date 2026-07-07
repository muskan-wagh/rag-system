import { Request, Response, NextFunction } from 'express';
import { ErrorCode } from './errorCodes';
export declare class AppError extends Error {
    statusCode: number;
    code: ErrorCode;
    details?: unknown | undefined;
    constructor(message: string, statusCode?: number, code?: ErrorCode, details?: unknown | undefined);
}
export declare function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=errorHandler.d.ts.map