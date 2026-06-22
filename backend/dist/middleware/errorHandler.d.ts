import { Request, Response, NextFunction } from 'express';
export declare class AppError extends Error {
    statusCode: number;
    details?: unknown | undefined;
    constructor(message: string, statusCode?: number, details?: unknown | undefined);
}
export declare function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=errorHandler.d.ts.map