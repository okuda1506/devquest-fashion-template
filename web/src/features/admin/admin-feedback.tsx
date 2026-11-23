export function AdminFeedback({ loading, loadError, message, saveError }: {
  loading: boolean; loadError: string; message: string; saveError: string;
}) {
  return <>
    {loadError && <p role="alert">{loadError} 一覧を更新してください。</p>}
    {saveError && <p role="alert">{saveError}</p>}
    {message && <p className="admin-confirmation" role="status">{message}</p>}
    {loading && <p role="status">一覧を読み込み中…</p>}
  </>;
}
