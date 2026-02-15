# Threat Model

## Threat 1: AI UI Manipulation
- 설명: AI가 결제 금액을 왜곡할 수 있음
- 통제: 모바일에서 서버 원문 invoice 재확인

## Threat 2: Replay of Verification Assertion
- 설명: 이전 assertion 재사용
- 통제: challenge nonce/expiry 바인딩

## Threat 3: Fake Settlement Proof
- 설명: 위조 txHash 전달
- 통제: 체인 provider 검증 및 amount/party 매칭
