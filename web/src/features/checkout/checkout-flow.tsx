import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { type ShippingAddress } from '@thread/shared';
import { useSession } from '@thread/shared/session';
import type { CheckoutContext, CheckoutReview } from './checkout.types';
import './checkout.css';

/** 購入手続きに必要なログインと配送先の下書きを管理する */
export function CheckoutFlow() {
    const { session, checking } = useSession();
    if (checking)
        return (
            <p className="utility-page" role="status">
                ログイン状態を確認しています…
            </p>
        );
    if (!session) return <Navigate to="/login" state={{ returnTo: '/checkout' }} replace />;
    return <CheckoutDraft key={session.token} token={session.token} />;
}

/** 配送先の入力値と注文確認結果を子ルートに共有する */
function CheckoutDraft({ token }: { token: string }) {
    const [address, setAddress] = useState<ShippingAddress>();
    const [review, setReview] = useState<CheckoutReview>();
    return <Outlet context={{ token, address, review, setAddress, setReview } satisfies CheckoutContext} />;
}
