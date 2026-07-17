import { logger } from '@/utils/logger';
import {
  getRecruiterByClerkId,
  createRecruiter,
  updateRecruiter,
  RecruiterRecord,
} from '@/services/supabase/database';

export async function getOrCreateRecruiter(clerkUser: {
  clerkId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
}): Promise<RecruiterRecord> {
  const existing = await getRecruiterByClerkId(clerkUser.clerkId);

  if (existing) {
    const needsUpdate =
      (clerkUser.email && clerkUser.email !== existing.email) ||
      (clerkUser.firstName && clerkUser.firstName !== (existing.first_name ?? undefined)) ||
      (clerkUser.lastName && clerkUser.lastName !== (existing.last_name ?? undefined)) ||
      (clerkUser.imageUrl && clerkUser.imageUrl !== (existing.avatar_url ?? undefined));

    if (needsUpdate) {
      await updateRecruiter(clerkUser.clerkId, {
        email: clerkUser.email,
        first_name: clerkUser.firstName,
        last_name: clerkUser.lastName,
        avatar_url: clerkUser.imageUrl,
      });
      const updated = await getRecruiterByClerkId(clerkUser.clerkId);
      if (updated) return updated;
    }

    return existing;
  }

  const recruiter = await createRecruiter({
    clerk_id: clerkUser.clerkId,
    email: clerkUser.email,
    first_name: clerkUser.firstName,
    last_name: clerkUser.lastName,
    avatar_url: clerkUser.imageUrl,
  });

  logger.info('Created new recruiter', { clerkId: clerkUser.clerkId });

  return recruiter;
}
