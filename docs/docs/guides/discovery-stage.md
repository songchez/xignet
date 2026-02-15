---
title: Discovery 단계
---

# Discovery 단계

Discovery의 목표는 "이 결제 요구를 신뢰해도 되는가"를 판단하는 것입니다.

## 1) 헤더 파싱

### legacy 형식(L402) 처리

```ts
import {parse402Header} from '@xignet/x402-sdk';

const challenge = parse402Header(
  'L402 invoice="https://gateway.example.com/invoices/iv_123", amount=50000, currency="KRW", merchant="StoreA", network="base-mainnet"',
);
```

`challenge`에는 `invoiceUrl`, `amount`, `network`, `merchant` 등이 들어갑니다.

### x402 v2 형식(PAYMENT-REQUIRED) 처리

```ts
import {parsePaymentRequiredHeader} from '@xignet/x402-sdk';

const requirement = parsePaymentRequiredHeader(encodedHeader, {
  requirePolicyRefs: true,
  requireTtmHash: true,
});
```

- `requirePolicyRefs`: 정책 참조 필수 여부
- `requireTtmHash`: TTM 해시 필수 여부

## 2) legacy를 v2 Canonical 구조로 통일

```ts
import {adaptLegacyToV2Canonical} from '@xignet/x402-sdk';

const normalized = adaptLegacyToV2Canonical(rawWwwAuthenticateHeader);
```

실무에서는 입력 포맷이 섞여 들어오기 때문에, 내부에서는 v2 형태로 통일하는 것이 유지보수에 유리합니다.

## 3) 인보이스 조회

```ts
import {fetchInvoice} from '@xignet/x402-sdk';

const invoice = await fetchInvoice(challenge);
```

SDK는 다음을 기본 확인합니다.

- HTTP 응답이 성공인지
- 인보이스 `expiry`가 만료되지 않았는지

## 4) 인보이스 서명 검증

```ts
import {validateInvoiceSignature} from '@xignet/x402-sdk';

await validateInvoiceSignature(invoice, {
  verifyInvoiceSignature: async (payload) => {
    // TODO: 실서비스 검증 로직 연결
    return payload.signature.length > 0;
  },
});
```

## 5) TTM 해시 검증(선택)

```ts
import {validatePaymentRequirementTtmHash} from '@xignet/x402-sdk';

validatePaymentRequirementTtmHash(requirement, expectedTtmHash);
```

## 자주 만나는 오류

- `ProtocolCompatibilityError`: 필드 누락/형식 오류
- `InvoiceExpiredError`: 인보이스 만료
- `InvoiceSignatureInvalidError`: 서명 검증 실패

## 운영 팁

- 헤더 원문을 감사 로그에 남기되 민감정보 마스킹
- `network`는 CAIP-2 표준값으로 저장
- 실패 사유를 단계별 코드(파싱/조회/서명)로 분리해 모니터링
