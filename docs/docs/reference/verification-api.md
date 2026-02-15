---
title: Verification API
---

# Verification API

## `buildVerificationRequest(invoice, ttm, options?): VerificationRequest`

검증 요청 객체를 생성합니다.

내부에서 수행하는 일:

- `computeTtmHash(ttm)` 실행
- `challengeBinding: "ttmHash"` 설정
- 정책 참조(policyRefs) 병합

옵션:

- `policyRefs?: { legalPolicyId?: string; webauthnPolicyId?: string }`
- `webauthnOptions?: Record<string, unknown>`
- `failClosedOnMissingPolicyRefs?: boolean`

## `computeTtmHash(ttm): string`

TTM을 정규화한 뒤 SHA-256 해시를 계산합니다.

- 결과: 64자리 소문자 hex 문자열
- 정렬/직렬화 규칙이 고정되어 있어 재현 가능

## `verifyBiometricAssertion(request, assertion, verifier, options?): Promise<VerificationResult>`

외부 verifier의 WebAuthn 검증 결과를 SDK 계약으로 검증합니다.

검증 포인트:

- verifier 반환값 null 여부
- 반환 `ttmHash` == 요청 `ttmHash`
- 생성된 `ConsentReceipt`의 유효성

실패 시:

- `VerificationDeclinedError`

## `createConsentReceipt(request, signedContext, assertion): ConsentReceipt`

검증 성공 데이터를 영수증으로 만듭니다.

포함 필드:

- `invoiceId`, `intentId`, `ttmHash`, `approvedAt`, `signerDeviceId`, `assertion`
- 내부 확장값: `signerContextRef`, `consentArtifactId`

## `validateConsentReceipt(receipt, expected): boolean`

영수증 스키마와 기대값 일치 여부를 검사합니다.

## `assertVerificationForSettlement(verification, expected): ConsentReceipt`

Settlement 직전 게이트로 사용합니다.

- 승인 여부, invoice/terms/hash 일치 여부를 강제
- 실패 시 `VerificationDeclinedError`
