// 서버 오류를 사용자에게 보여줄 한 줄로 바꾼다
type AnyError = { code?: string; error_code?: string; message?: string; status?: number } | null | undefined;

export function errorText(e: unknown): string {
  const err = e as AnyError;
  const code = err?.code ?? '';
  const msg = err?.message ?? '';
  const auth: Record<string, string> = {
    invalid_credentials: '이메일 또는 비밀번호가 맞지 않아요',
    user_already_exists: '이미 가입된 이메일이에요. 로그인해 주세요',
    email_exists: '이미 가입된 이메일이에요. 로그인해 주세요',
    weak_password: '비밀번호는 8자 이상이어야 해요',
    email_address_invalid: '이메일 주소를 확인해 주세요',
    validation_failed: '이메일 주소를 확인해 주세요',
    same_password: '지금 쓰는 비밀번호와 다른 비밀번호를 적어 주세요',
    over_email_send_rate_limit: '메일을 너무 자주 보냈어요. 잠시 후 다시 시도해 주세요',
    over_request_rate_limit: '요청이 많아요. 잠시 후 다시 시도해 주세요',
    session_not_found: '로그인이 풀렸어요. 다시 로그인해 주세요',
  };
  if (auth[code]) return auth[code];
  if (msg.includes('goal_category_limit')) return '목표 카테고리는 최대 6개예요';
  if (msg.includes('need_goal_category')) return '목표 카테고리를 1개 이상 골라 주세요';
  if (code === '23503' && msg.includes('goals')) return '목표가 들어 있는 카테고리는 지울 수 없어요. 목표를 다른 카테고리로 옮기거나 지운 뒤 지워 주세요';
  if (msg.includes('goal_category_invalid')) return '목표는 목표 카테고리에만 둘 수 있어요';
  if (code === '23505' && msg.includes('color')) return '이미 다른 카테고리가 쓰는 색이에요';
  if (code === '23505') return '이미 있는 이름이에요';
  if (code === '23514') return '입력한 내용을 확인해 주세요';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return '연결이 불안정해요. 다시 시도해 주세요';
  return '문제가 생겼어요. 다시 시도해 주세요';
}
