import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { hashPassword, verifyPassword } from '../auth/password';
import { normalizeAddress } from '../checkout/checkout-quote';
import type { ShippingAddressDto } from '../checkout/dto/shipping-address.dto';
import { customerMessages } from './customer-messages';
import { CustomersRepository } from './customers.repository';
import type { RegisterCustomerDto } from './dto/register-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

/**
 * EC の会員登録と本人の会員情報・配送先の変更を扱う
 */
@Injectable()
export class CustomersService {
    /**
     * 会員と配送先の保存処理を受け取る
     */
    constructor(private readonly customers: CustomersRepository) {}

    /**
     * メールアドレスを正規化して EC の顧客アカウントを登録する
     */
    async register({ password, ...profile }: RegisterCustomerDto) {
        try {
            return await this.customers.create({
                ...profile,
                email: profile.email.toLowerCase(),
                passwordHash: hashPassword(password)
            });
        } catch (cause) {
            rethrowCustomerWriteError(cause);
        }
    }

    /**
     * ログイン中の顧客が編集できる会員情報を返す
     */
    async profile(customerId: number) {
        const profile = await this.customers.profile(customerId);
        if (!profile) throw new NotFoundException(customerMessages.profileNotFound);
        return profile;
    }

    /**
     * 会員情報を更新して メール変更時は既存パスワードを照合する
     */
    async updateProfile(customerId: number, { currentPassword, ...profile }: UpdateCustomerDto) {
        const credentials = await this.customers.credentials(customerId);
        if (!credentials) throw new NotFoundException(customerMessages.profileNotFound);

        const email = profile.email.toLowerCase();
        if (email !== credentials.email && (!currentPassword || !verifyPassword(currentPassword, credentials.passwordHash))) {
            throw new BadRequestException(customerMessages.passwordRequired);
        }

        try {
            const updated = await this.customers.update(customerId, credentials.email, { ...profile, email });
            if (!updated) throw new ConflictException(customerMessages.profileChanged);
            return updated;
        } catch (cause) {
            rethrowCustomerWriteError(cause);
        }
    }

    /**
     * 購入時に選べる本人の配送先を一覧で返す
     */
    addresses(customerId: number) {
        return this.customers.addresses(customerId);
    }

    /**
     * 入力済みの配送先を正規化して本人のアドレス帳へ追加する
     */
    addAddress(customerId: number, address: ShippingAddressDto) {
        return this.customers.addAddress(customerId, normalizeAddress(address));
    }

    /**
     * 本人の配送先を変更する
     */
    async updateAddress(customerId: number, id: number, address: ShippingAddressDto) {
        const updated = await this.customers.updateAddress(customerId, id, normalizeAddress(address));
        if (!updated) throw new NotFoundException(customerMessages.addressNotFound);
        return updated;
    }

    /**
     * 本人のアドレス帳から配送先を削除する
     */
    async deleteAddress(customerId: number, id: number) {
        const result = await this.customers.deleteAddress(customerId, id);
        if (!result.count) throw new NotFoundException(customerMessages.addressNotFound);
    }
}

/**
 * メールアドレスの一意制約違反を会員向けのエラーへ変換する
 */
function rethrowCustomerWriteError(cause: unknown): never {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === 'P2002') {
        throw new ConflictException(customerMessages.emailInUse);
    }
    throw cause;
}
