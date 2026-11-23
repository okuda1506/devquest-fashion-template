import { useEffect, useRef, type ReactNode } from 'react';

const steps = ['カート', '配送先入力', '注文確認', '完了'];

export function CheckoutProgress({ step }: { step: number }) {
  return <nav aria-label="購入手続きの進み具合">
    <ol className="checkout-progress">
      {steps.map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined}
        data-completed={index < step || undefined}>
        <span className="checkout-step-number" aria-hidden="true">{index + 1}</span>
        <span>{label}</span>
      </li>)}
    </ol>
  </nav>;
}

export function CheckoutPage({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, []);

  return <section className="utility-page checkout-page">
    <CheckoutProgress step={step} />
    <h1 tabIndex={-1} ref={heading}>{title}</h1>
    {children}
  </section>;
}
