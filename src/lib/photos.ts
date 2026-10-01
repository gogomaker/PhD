// 목표 인증사진 (R-G6): 비공개 저장소 goal-photos/{사용자}/... — 본인 폴더만 읽고 쓴다
import { supabase } from './supabase';

export const PHOTO_BUCKET = 'goal-photos';
const MAX_SIDE = 1600;

/** 긴 변 1600px JPEG로 줄인다 (5MB 제한 안으로) */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('photo'))), 'image/jpeg', 0.85));
}

/** 올리고 저장 경로를 돌려준다 */
export async function uploadPhoto(userId: string, goalId: string, blob: Blob) {
  const path = `${userId}/${goalId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  return { path: error ? null : path, error };
}

export function removePhotos(paths: string[]) {
  return supabase.storage.from(PHOTO_BUCKET).remove(paths);
}

/** 경로 → 잠깐 쓸 수 있는 주소 (1시간) */
export async function photoUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
  return Object.fromEntries((data ?? []).filter(x => x.signedUrl && x.path).map(x => [x.path!, x.signedUrl as string]));
}

/** 계정 삭제 전: 내 폴더의 사진을 모두 지운다 */
export async function removeAllPhotos(userId: string) {
  const { data } = await supabase.storage.from(PHOTO_BUCKET).list(userId, { limit: 1000 });
  if (data?.length) await removePhotos(data.map(f => `${userId}/${f.name}`));
}
