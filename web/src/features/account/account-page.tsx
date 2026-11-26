import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '@thread/shared';
import { useSession } from '@thread/shared/session';
import type { CustomerAddress, CustomerProfile } from './account.types';
import { AddressBook } from './address-book';
import { ProfileForm } from './profile-form';
import './account.css';

type AccountData = { profile: CustomerProfile; addresses: CustomerAddress[] };

/**
 * ログインした顧客だけをマイページに案内する
 */
export function AccountPage() {
    const { session, checking } = useSession();
    if (checking) return <p className="utility-page" role="status">ログイン状態を確認しています…</p>;
    if (!session) return <Navigate to="/login" state={{ returnTo: '/account' }} replace />;
    return <AccountDetails key={session.token} token={session.token} />;
}

/**
 * 会員情報・アドレス帳・注文履歴への導線を一か所に表示する
 */
function AccountDetails({ token }: { token: string }) {
    const [data, setData] = useState<AccountData>();
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        const options = { signal: controller.signal };
        void Promise.all([
            api<CustomerProfile>('/customers/me', options, token),
            api<CustomerAddress[]>('/customers/me/addresses', options, token)
        ]).then(
            ([profile, addresses]) => {
                if (!controller.signal.aborted) setData({ profile, addresses });
            },
            (cause: Error) => {
                if (!controller.signal.aborted) setError(cause.message);
            }
        );
        return () => controller.abort();
    }, [token, attempt]);

    return (
        <section className="utility-page account-page">
            <div className="account-heading">
                <h1>マイページ</h1>
                <Link to="/orders">注文履歴を見る</Link>
            </div>
            {error ? (
                <div>
                    <p role="alert">{error}</p>
                    <button type="button" onClick={() => {
                        setError('');
                        setAttempt(attempt + 1);
                    }}>再読み込み</button>
                </div>
            ) : data ? (
                <div className="account-columns">
                    <section aria-labelledby="account-profile">
                        <h2 id="account-profile">会員情報</h2>
                        <ProfileForm token={token} profile={data.profile} />
                    </section>
                    <section aria-labelledby="account-addresses">
                        <h2 id="account-addresses">アドレス帳</h2>
                        <AddressBook token={token} initialAddresses={data.addresses} />
                    </section>
                </div>
            ) : (
                <p role="status">会員情報を読み込み中…</p>
            )}
        </section>
    );
}
