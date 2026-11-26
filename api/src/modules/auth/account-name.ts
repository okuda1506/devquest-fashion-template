/**
 * 姓と名をつないで画面用の表示名を返す
 */
export function formatAccountName(account: { lastName: string; firstName: string | null }) {
    return [account.lastName, account.firstName].filter(Boolean).join(' ');
}
