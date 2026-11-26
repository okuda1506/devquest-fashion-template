import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useMatch } from 'react-router-dom';
import { ApiError, type ShippingAddress } from '@thread/shared';
import { useSession } from '@thread/shared/session';
import type { CheckoutContext, CheckoutReview } from './checkout.types';
import {
    forgetGuestOrder, guestCheckoutPath, guestOrderApi, readPendingGuestOrder
} from './guest-order-session';
import './checkout.css';

/**
 * 会員の注文と注文完了画面をログイン済みの顧客に提供する
 */
export function CheckoutFlow() {
    const { session, checking } = useSession();
    const editingAddress = useMatch('/checkout');
    if (checking)
        return (
            <p className="utility-page" role="status">
                ログイン状態を確認しています…
            </p>
        );
    if (!session) {
        if (editingAddress) return <Navigate to={guestCheckoutPath} replace />;
        return <Navigate to="/login" state={{ returnTo: '/checkout' }} replace />;
    }
    return <CheckoutDraft key={session.token} token={session.token} />;
}

/**
 * ゲスト購入の下書きを保持し 未確認の注文があれば先に結果を照会する
 */
export function GuestCheckoutFlow() {
    const editingAddress = useMatch(guestCheckoutPath);
    return <CheckoutDraft guest recover={!!editingAddress} />;
}

/**
 * 再読み込み後に確定済みのゲスト注文があれば同じ注文の完了画面へ戻す
 */
function GuestOrderRecovery({ children }: { children: ReactNode }) {
    const [pending, setPending] = useState(readPendingGuestOrder);
    const [found, setFound] = useState(false);
    const [error, setError] = useState('');
    const [unconfirmed, setUnconfirmed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!pending) return;
        const controller = new AbortController();
        void guestOrderApi('/' + encodeURIComponent(pending.id), { signal: controller.signal }).then(
            () => { if (!controller.signal.aborted) setFound(true); },
            (cause: Error) => {
                if (controller.signal.aborted) return;
                setUnconfirmed(cause instanceof ApiError && cause.status === 404);
                setError(cause.message);
            }
        );
        return () => controller.abort();
    }, [pending, attempt]);

    if (!pending) return children;
    if (found) return <Navigate to={guestCheckoutPath + '/complete/' + encodeURIComponent(pending.id)} replace />;
    return (
        <section className="utility-page checkout-recovery" aria-labelledby="checkout-recovery-title">
            <h1 id="checkout-recovery-title">前回のゲスト注文</h1>
            {!error ? <p role="status">前回のゲスト注文を確認しています…</p> : (
                <>
                    <p role="alert">{unconfirmed ? '前回の注文はまだ確認できません。' : error}</p>
                    <div className="checkout-links">
                        <button type="button" onClick={() => {
                            setError('');
                            setAttempt(attempt + 1);
                        }}>注文結果を再確認する</button>
                        {unconfirmed && <button type="button" onClick={() => {
                            forgetGuestOrder(pending.id);
                            setPending(undefined);
                        }}>新しい注文に進む</button>}
                        <Link to="/cart">カートへ戻る</Link>
                    </div>
                </>
            )}
        </section>
    );
}

type CheckoutDraftProps =
    | { token: string; guest?: false; recover?: never }
    | { guest: true; token?: never; recover: boolean };

/**
 * 配送先の入力値と注文確認結果を子ルートに共有する
 */
function CheckoutDraft(props: CheckoutDraftProps) {
    const [address, setAddress] = useState<ShippingAddress>();
    const [review, setReview] = useState<CheckoutReview>();
    const [email, setEmail] = useState('');
    const draft = { address, review, setAddress, setReview };
    const context: CheckoutContext = props.guest
        ? { ...draft, guest: true, email, setEmail }
        : { ...draft, token: props.token };
    const outlet = <Outlet context={context} />;
    return props.recover ? <GuestOrderRecovery>{outlet}</GuestOrderRecovery> : outlet;
}
