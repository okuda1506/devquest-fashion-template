import { useState, type FormEvent } from 'react';
import { api } from '@thread/shared';
import { readShippingAddress, ShippingFields } from '../checkout/shipping-fields';
import type { CustomerAddress } from './account.types';

const addressesPath = '/customers/me/addresses';

/**
 * 登録済みのお届け先を表示し 追加・編集・削除を行う
 */
export function AddressBook({ token, initialAddresses }: { token: string; initialAddresses: CustomerAddress[] }) {
    const [addresses, setAddresses] = useState(initialAddresses);
    const [editing, setEditing] = useState<CustomerAddress | 'new' | null>(null);
    const [deleting, setDeleting] = useState<number>();
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const editedAddress = editing && editing !== 'new' ? editing : undefined;

    /**
     * お届け先を追加または更新して一覧に反映する
     */
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const id = editedAddress?.id;
        const body = JSON.stringify(readShippingAddress(event.currentTarget));
        setError('');
        setNotice('');
        setBusy(true);
        try {
            const saved = await api<CustomerAddress>(id ? addressesPath + '/' + encodeURIComponent(id) : addressesPath, {
                method: id ? 'PUT' : 'POST',
                body
            }, token);
            setAddresses((entries) => id ? entries.map((entry) => entry.id === id ? saved : entry) : [...entries, saved]);
            setEditing(null);
            setNotice('お届け先を保存しました。');
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setBusy(false);
        }
    }

    /**
     * 選択したお届け先を削除して一覧に反映する
     */
    async function remove(id: number) {
        setError('');
        setNotice('');
        setBusy(true);
        try {
            await api<void>(addressesPath + '/' + encodeURIComponent(id), { method: 'DELETE' }, token);
            setAddresses((entries) => entries.filter((address) => address.id !== id));
            setDeleting(undefined);
            setNotice('お届け先を削除しました。');
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setBusy(false);
        }
    }

    /**
     * 新規登録または選択したお届け先の編集画面を開く
     */
    function showForm(address: CustomerAddress | 'new') {
        setDeleting(undefined);
        setNotice('');
        setError('');
        setEditing(address);
    }

    return (
        <>
            {addresses.length === 0 && <p>登録済みのお届け先はありません。</p>}
            <ul className="account-addresses">
                {addresses.map((address) => (
                    <li className="row" key={address.id}>
                        <div>
                            <strong>{address.name}</strong>
                            <p>〒{address.postalCode} {address.prefecture}{address.city}{address.line1} {address.line2}</p>
                            <p>{address.phone}</p>
                        </div>
                        <div className="account-actions">
                            {deleting === address.id ? (
                                <>
                                    <span>このお届け先を削除しますか？</span>
                                    <button type="button" disabled={busy} onClick={() => void remove(address.id)}>削除する</button>
                                    <button type="button" disabled={busy} onClick={() => setDeleting(undefined)}>キャンセル</button>
                                </>
                            ) : (
                                <>
                                    <button type="button" disabled={busy} onClick={() => showForm(address)} aria-label={address.name + 'のお届け先を編集'}>編集</button>
                                    <button type="button" disabled={busy} onClick={() => {
                                        setEditing(null);
                                        setNotice('');
                                        setError('');
                                        setDeleting(address.id);
                                    }} aria-label={address.name + 'のお届け先を削除'}>削除</button>
                                </>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            {editing ? (
                <form className="checkout-form" onSubmit={save} key={editedAddress?.id ?? 'new'}>
                    <fieldset disabled={busy}>
                        <legend>{editedAddress ? 'お届け先を編集' : 'お届け先を追加'}</legend>
                        <ShippingFields address={editedAddress} />
                    </fieldset>
                    <div className="account-actions account-address-actions">
                        <button type="submit" disabled={busy}>{busy ? '保存中…' : 'お届け先を保存'}</button>
                        <button type="button" className="account-secondary" disabled={busy} onClick={() => {
                            setError('');
                            setEditing(null);
                        }}>キャンセル</button>
                    </div>
                </form>
            ) : (
                <button type="button" className="account-secondary" disabled={busy} onClick={() => showForm('new')}>お届け先を追加</button>
            )}
            {error && <p role="alert">{error}</p>}
            {notice && <p role="status">{notice}</p>}
        </>
    );
}
