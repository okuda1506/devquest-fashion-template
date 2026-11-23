import { useEffect, useState } from 'react';
import { api } from '../../api';

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
      result => {
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
      },
    );
    return () => controller.abort();
  }, [endpoint, token, revision]);

  function refresh() {
    setLoadError('');
    setSaveError('');
    setLoading(true);
    setRevision(version => version + 1);
  }

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
