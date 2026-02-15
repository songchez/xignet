---
title: Protocol API
---

# Protocol API

## `parse402Header(wwwAuthenticate: string): X402Challenge`

legacy `WWW-Authenticate`(L402) 헤더를 구조화합니다.

```ts
const challenge = parse402Header(
  'L402 invoice="https://...", amount=50000, currency="KRW", network="base-mainnet"',
);
```

주요 반환 필드:

- `scheme`, `invoiceUrl`, `amount`, `currency`, `merchant`, `network`, `rawHeader`

실패 시:

- `ProtocolCompatibilityError`

## `parsePaymentRequiredHeader(header: string, options?): PaymentRequirement`

x402 v2 `PAYMENT-REQUIRED` Base64URL payload를 파싱합니다.

옵션:

- `requirePolicyRefs?: boolean`
- `requireTtmHash?: boolean`

실패 시:

- 버전/필드/형식 문제 -> `ProtocolCompatibilityError`

## `adaptLegacyToV2Canonical(header: string): PaymentRequirement`

legacy 헤더를 v2 canonical 구조로 변환합니다.

사용 이유:

- 입력이 여러 포맷이어도 내부 처리 로직을 하나로 통일 가능

## `validatePaymentRequirementTtmHash(requirement, expectedTtmHash, hook?): true`

요구에 들어 있는 `ttmHash`가 예상값과 일치하는지 검증합니다.

- 기본 동작: 단순 비교
- `hook` 제공 시 커스텀 검증 규칙 적용

## `fetchInvoice(challenge, fetcher?): Promise<InvoicePayload>`

`challenge.invoiceUrl`로 인보이스를 조회합니다.

기본 검사:

- HTTP 성공 여부
- 인보이스 만료 여부

실패 시:

- `ProtocolCompatibilityError`
- `InvoiceExpiredError`

## `validateInvoiceSignature(invoice, trustStore): Promise<boolean>`

서명 검증기를 위임 호출합니다.

```ts
await validateInvoiceSignature(invoice, {
  verifyInvoiceSignature: async (payload) => {
    return verifyWithMerchantPublicKey(payload);
  },
});
```

실패 시:

- `InvoiceSignatureInvalidError`

## 기타 유틸

- `decimalToAtomicAmount(decimal, scale)`
- `validateTtmHashJcsSha256(ttmHash)`
- `normalizeCaip2Network(network)`
