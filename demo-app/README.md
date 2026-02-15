# demo-app

`@xignet/x402-sdk` 실동작 흐름을 브라우저에서 검증하는 Vite + React 앱입니다.

## 실행

```bash
cd demo-app
npm install
npm run dev
```

## 확인 포인트

- `전체 트랜잭션 실행`: x402 Discovery → WebAuthn 승인 → Settlement 전 과정을 실행
- `같은 키로 재실행`: 동일 `idempotencyKey` 재요청 시 `replayed=true` 확인
- Scenario 체크박스: 해시 변조/승인 거절/정산 실패 등 실패 경로 확인
