# Domain Boundaries

## Domain A: Protocol SDK
- 입력: `PAYMENT-REQUIRED`(v2), `PAYMENT-VERSION`, legacy headers(v1/L402)
- 출력: PaymentRequirement(v2 canonical), CompatibilityParsedChallenge
- 책임: v2 표준 파싱, legacy -> v2 변환

## Domain B: Verification
- 입력: InvoicePayload, WebAuthn assertion
- 출력: VerificationRequest, VerificationResult

## Domain C: Settlement
- 입력: SettlementProof, InvoicePayload
- 출력: OrderConfirmation
- 책임: Facilitator verify/settle 결과와 주문 상태를 연결

## Domain D: DevEx/Infra
- 입력: 코드/문서/PR
- 출력: CI 결과, 릴리즈 아티팩트, 변경 이력
- 책임: x402 conformance matrix(v2/v1 compatibility) 자동 검증
