import { useEffect, useState } from 'react';
import { api } from '@thread/shared';

/**
 * 管理画面の一覧取得・更新・エラー状態を共通化する
 *
 * @param endpoint 一覧を取得する API パス
 * @param token 管理者のセッショントークン
 * @returns 一覧データ・操作の状態・保存と再取得の関数
 */
export function useAdminList<T>(endpoint: string, token: string) {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [revision, setRevision] = useState(0);
    const [message, setMessage] = useState('');
    const [saveError, setSaveError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        api<T[]>(endpoint, { signal: controller.signal }, token).then(
            (result) => {
                if (!controller.signal.aborted) {
                    setItems(result);
                    setLoading(false);
                }
            },
            (error: Error) => {
                if (!controller.signal.aborted) {
                    setLoadError(error.message);
                    setLoading(false);
                }
            }
        );
        return () => controller.abort();
    }, [endpoint, token, revision]);

    /** サーバーの最新状態で一覧を再取得する */
    function refresh() {
        setLoadError('');
        setSaveError('');
        setLoading(true);
        setRevision((version) => version + 1);
    }

    /**
     * 保存が成功した場合に一覧を取り直して操作結果を表示する
     *
     * @param path 更新先の API パス
     * @param method 登録または部分更新の HTTP メソッド
     * @param values 送信するフォーム値
     * @param success 成功時の画面メッセージ
     * @returns 更新に成功した場合に true
     */
    async function save(path: string, method: 'POST' | 'PATCH', values: object, success: string) {
        setMessage('');
        setSaveError('');
        setSaving(true);
        try {
            await api(path, { method, body: JSON.stringify(values) }, token);
            setMessage(success);
            refresh();
            return true;
        } catch (error) {
            setSaveError((error as Error).message);
            return false;
        } finally {
            setSaving(false);
        }
    }

    return { items, loading, loadError, message, saveError, saving, refresh, save };
}
