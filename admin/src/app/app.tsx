import { Navigate, Route, Routes } from 'react-router-dom';
import { Dashboard } from '../features/dashboard/dashboard';
import { Login } from '../features/auth/login';
import { ManageOrders } from '../features/orders/manage-orders';
import { ManageProducts } from '../features/products/manage-products';
import { ManagementLayout } from './management-layout';
import { ManageInventory } from '../features/inventory/manage-inventory';

/** 店舗管理の公開ルートと認証が必要なルートを構成する */
export function Admin() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ManagementLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="/products" element={<ManageProducts />} />
                <Route path="/inventory" element={<ManageInventory />} />
                <Route path="/orders" element={<ManageOrders />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}
