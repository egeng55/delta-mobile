import { API_BASE_URL } from '../config/constants';

export async function accountIsApproved(token: string, userId: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${API_BASE_URL}/auth/validate`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    });
    if (!response.ok) return false;
    const body = await response.json();
    return body.status === 'valid' && body.user?.user_id === userId && body.user?.is_guest !== true;
  } catch { return false; }
  finally { clearTimeout(timeout); }
}
