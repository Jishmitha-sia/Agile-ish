import { SetMetadata } from '@nestjs/common';

/**
 * Mark a route as public — JwtAuthGuard will skip it.
 *
 * Use sparingly. The default posture is "every endpoint requires auth".
 * Explicit `@Public()` on login/signup/health makes the auth boundary
 * visible at a glance.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
