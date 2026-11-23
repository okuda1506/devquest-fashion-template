/** 追加元の商品画像からヘッダーのカートまで移動する演出を行う */
export function animateCartAddition(cartIcon: HTMLElement, image: HTMLImageElement | null, button: HTMLButtonElement) {
    if (!cartIcon.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const target = cartIcon.getBoundingClientRect();
    const headerBottom = cartIcon.closest('header')?.getBoundingClientRect().bottom ?? 0;
    const photo = image?.getBoundingClientRect();
    const trigger = button.getBoundingClientRect();
    const visiblePhotoTop = Math.max(photo?.top ?? 0, headerBottom);
    const visiblePhotoBottom = Math.min(photo?.bottom ?? 0, window.innerHeight);

    // 商品画像が画面外にある場合は追加ボタンをアニメーションの起点にする
    const fromPhoto = photo && visiblePhotoBottom - visiblePhotoTop >= 72;
    const startX = fromPhoto ? photo.left + photo.width / 2 : trigger.left + 28;
    const startY = fromPhoto ? (visiblePhotoTop + visiblePhotoBottom) / 2 : trigger.top + trigger.height / 2;
    const dx = target.left + target.width / 2 - startX;
    const dy = target.top + target.height / 2 - startY;

    const thumbnail = document.createElement('div');
    thumbnail.className = 'cart-flight';
    thumbnail.setAttribute('aria-hidden', 'true');
    thumbnail.style.left = `${startX}px`;
    thumbnail.style.top = `${startY}px`;
    if (image?.complete && image.naturalWidth) {
        const photoCopy = document.createElement('img');
        photoCopy.src = image.currentSrc || image.src;
        photoCopy.alt = '';
        thumbnail.append(photoCopy);
    } else if (cartIcon.firstElementChild) {
        thumbnail.append(cartIcon.firstElementChild.cloneNode(true));
    }
    document.body.append(thumbnail);

    const flight = thumbnail.animate(
        [
            { transform: 'translate(0, 0) scale(.8)', opacity: 0 },
            { transform: `translate(${dx * 0.16}px, ${dy * 0.14 - 34}px) scale(1)`, opacity: 1, offset: 0.23 },
            { transform: `translate(${dx * 0.65}px, ${dy * 0.63 - 32}px) scale(.64)`, opacity: 1, offset: 0.65 },
            { transform: `translate(${dx}px, ${dy}px) scale(.16)`, opacity: 0 }
        ],
        { duration: 560, easing: 'cubic-bezier(.22, .7, .3, 1)' }
    );
    let pulse: Animation | undefined;
    flight.onfinish = () => {
        thumbnail.remove();
        pulse = cartIcon.animate(
            [
                { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(66, 99, 76, .3)' },
                { transform: 'scale(1.23)', boxShadow: '0 0 0 5px rgba(66, 99, 76, .18)', offset: 0.42 },
                { transform: 'scale(1)', boxShadow: '0 0 0 9px rgba(66, 99, 76, 0)' }
            ],
            { duration: 320, easing: 'ease-out' }
        );
    };

    return () => {
        flight.onfinish = null;
        flight.cancel();
        pulse?.cancel();
        thumbnail.remove();
    };
}
