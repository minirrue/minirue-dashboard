import { apiFetch } from './client';

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ReviewMedia {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  /** Resolved server-side at read time — images through imgproxy, videos as a
   * freshly signed link. Null if storage could not resolve it. */
  url: string | null;
  /** A VIDEO's poster frame — the backend has always sent this
   * (`ReviewsService.toMediaView`), this type simply never declared it, so
   * the moderation screen rendered every clip as a black box. Null for an
   * IMAGE and for a video uploaded before posters existed. */
  posterUrl: string | null;
  contentType: string;
}

export interface AdminReview {
  id: string;
  productId: string;
  customerId: string;
  orderId: string | null;
  verifiedPurchase: boolean;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  rejectionReason: string | null;
  moderatedBy: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Photos and clips the customer attached. A review approved without looking
   * at these is a review approved blind. */
  media: ReviewMedia[];
}

export interface AdminReviewList {
  items: AdminReview[];
  total: number;
}

export async function apiListReviews(filter: {
  status?: ReviewStatus;
  productId?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminReviewList> {
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.productId) params.set('productId', filter.productId);
  if (filter.limit != null) params.set('limit', String(filter.limit));
  if (filter.offset != null) params.set('offset', String(filter.offset));
  const qs = params.toString();
  return apiFetch(`/admin/reviews${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function apiApproveReview(id: string): Promise<void> {
  await apiFetch(`/admin/reviews/${id}/approve`, { method: 'POST', auth: true });
}

export async function apiRejectReview(id: string, reason: string): Promise<void> {
  await apiFetch(`/admin/reviews/${id}/reject`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ reason }),
  });
}
