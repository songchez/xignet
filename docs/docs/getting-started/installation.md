---
title: 설치하기
---

# 설치하기

이 페이지는 가장 안전한 시작 방법을 안내합니다.

## 1) 사전 준비

- Node.js `18` 이상
- npm `9` 이상
- TypeScript 프로젝트(권장)

확인 명령어:

```bash
node -v
npm -v
```

## 2) 패키지 설치

```bash
npm install @xignet/x402-sdk
```

## 3) 최소 프로젝트 구조 예시

```text
my-app/
  src/
    main.ts
  package.json
  tsconfig.json
```

## 4) import 점검

`src/main.ts`:

```ts
import {
  parse402Header,
  fetchInvoice,
  validateInvoiceSignature,
  buildVerificationRequest,
  verifyBiometricAssertion,
  verifySettlementProof,
  mapProofToOrderConfirmation,
} from '@xignet/x402-sdk';

console.log('x402 SDK loaded');
```

## 5) 실행 전 체크리스트

- `fetch` 런타임이 있는지 확인 (Node 18+면 기본 제공)
- 실제 서비스에서는 `validateInvoiceSignature`에 신뢰 가능한 검증기 연결
- 운영 환경에서는 TTM/정책 ID를 로그로 남겨 감사 추적 가능하게 설계

## 6) 자주 발생하는 설치 문제

### 문제: `Cannot find module '@xignet/x402-sdk'`

- `npm install`이 현재 프로젝트 루트에서 실행되었는지 확인
- 모노레포면 워크스페이스 위치 확인

### 문제: ESM/CJS import 충돌

- SDK는 ESM/CJS 둘 다 export를 제공
- 프로젝트 설정(`type`, bundler, tsconfig.module`)을 하나로 통일

다음 단계에서 실제 결제 흐름 최소 예제를 실행합니다.
