import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

const profileFields = {
    email: true,
    lastName: true,
    firstName: true,
    lastNameKana: true,
    firstNameKana: true,
    phone: true
} satisfies Prisma.CustomerSelect;

const addressFields = {
    id: true,
    name: true,
    postalCode: true,
    prefecture: true,
    city: true,
    line1: true,
    line2: true,
    phone: true
} satisfies Prisma.CustomerAddressSelect;

type AddressData = Omit<Prisma.CustomerAddressUncheckedCreateInput, 'id' | 'customerId' | 'createdAt'>;

/**
 * EC の会員情報と本人のお届け先を読み書きする
 */
@Injectable()
export class CustomersRepository {
    /**
     * 顧客情報を操作する DB クライアントを受け取る
     */
    constructor(private readonly db: PrismaService) {}

    /**
     * 顧客アカウントを作成して表示用の会員情報を返す
     */
    create(data: Prisma.CustomerCreateInput) {
        return this.db.customer.create({ data, select: profileFields });
    }

    /**
     * 本人の表示用会員情報を取得する
     */
    profile(id: string) {
        return this.db.customer.findUnique({ where: { id }, select: profileFields });
    }

    /**
     * ログイン用メールの変更前に現在の認証情報を取得する
     */
    credentials(id: string) {
        return this.db.customer.findUnique({ where: { id }, select: { email: true, passwordHash: true } });
    }

    /**
     * 取得時のメールと一致する会員情報を更新する
     */
    async update(id: string, currentEmail: string, data: Prisma.CustomerUpdateManyMutationInput) {
        const [updated] = await this.db.customer.updateManyAndReturn({
            where: { id, email: currentEmail },
            data,
            select: profileFields
        });
        return updated;
    }

    /**
     * 本人が登録した配送先のみを登録順に返す
     */
    addresses(customerId: string) {
        return this.db.customerAddress.findMany({
            where: { customerId },
            select: addressFields,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
        });
    }

    /**
     * 本人のお届け先をアドレス帳に追加する
     */
    addAddress(customerId: string, data: AddressData) {
        return this.db.customerAddress.create({ data: { ...data, customerId }, select: addressFields });
    }

    /**
     * 所有者と一致するお届け先だけを更新する
     */
    async updateAddress(customerId: string, id: string, data: AddressData) {
        const [updated] = await this.db.customerAddress.updateManyAndReturn({
            where: { id, customerId },
            data,
            select: addressFields
        });
        return updated;
    }

    /**
     * 所有者と一致するお届け先だけを削除する
     */
    deleteAddress(customerId: string, id: string) {
        return this.db.customerAddress.deleteMany({ where: { id, customerId } });
    }
}
