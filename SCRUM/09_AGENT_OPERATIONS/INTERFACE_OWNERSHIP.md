# Interface Ownership

## Owned by Squad A
- X402Challenge
- InvoicePayload
- parse402Header
- fetchInvoice
- validateInvoiceSignature

## Owned by Squad B
- VerificationRequest
- VerificationResult
- verifyBiometricAssertion

## Owned by Squad C
- SettlementProof
- OrderConfirmation
- verifySettlementProof
- mapProofToOrderConfirmation

## Shared Governance
- 공용 타입 변경은 RFC 업데이트 + contract test 동반
