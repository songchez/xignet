# User Stories

## Story 작성 필수 메타데이터
- Problem Link: (1~6 중 해당 번호)
- Risk if Missing:
- Control Point: Discovery / Verification / Settlement
- Evidence: test case / log event

## Story 1
As a gateway engineer, I want to parse x402 challenge headers so that clients can discover invoice URLs safely.

### Acceptance Criteria
- Problem Link: 1, 2
- invoice 필드 누락 시 에러 발생
- amount 숫자 파싱 실패 시 에러 발생

## Story 2
As a verifier engineer, I want a consistent verification request model so that mobile approval UI can reuse one contract.

### Acceptance Criteria
- Problem Link: 3, 4
- invoiceId/displayText/challenge 필수
- userVerification required 옵션 포함

## Story 3
As an integration engineer, I want settlement proof validation APIs so that order confirmation mapping is deterministic.

### Acceptance Criteria
- Problem Link: 5
- proof invalid 시 예외
- order confirmation status는 `confirmed`
