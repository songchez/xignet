# Work Contracts

## Contract 1: Protocol -> Verification
- Input: InvoicePayload
- Output: VerificationRequest
- SLA: Breaking change 금지, additive only

## Contract 2: Verification -> Settlement
- Input: VerificationResult + SettlementProof
- Output: OrderConfirmation
- SLA: status enum 확장 시 RFC 선행

## Contract 3: Infra -> All Squads
- CI 필수 게이트 실패 시 병합 차단
