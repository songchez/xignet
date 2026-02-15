# RFC-002: Verification and WebAuthn

## 목적
모바일 분리 환경에서 사용자 승인 행위를 서명 가능한 결과로 표준화한다.

## Contract
- 입력: InvoicePayload
- 출력: VerificationRequest
- 검증: AssertionVerifier를 통해 assertion 진위 검증
- 실패: `VerificationDeclinedError`

## 보안 요구사항
- user verification required
- replay 방지를 위한 challenge 바인딩
- signedAt 추적 가능
