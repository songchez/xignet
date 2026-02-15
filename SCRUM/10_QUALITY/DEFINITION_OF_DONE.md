# Definition of Done

1. 기능 코드 + 테스트 + 문서(RFC/README) 동시 반영
2. typecheck/lint/unit/contract/security 모두 통과
3. 에러 처리 시나리오 포함
4. breaking change 시 RFC/ADR 업데이트
5. 승인 우회 경로가 없어야 함
6. idempotency/nonce/expiry 기반 중복 방지 테스트 포함
7. 실패 시 안전한 기본값(결제 중단/주문 미생성) 보장
8. 감사 가능한 이벤트(누가/무엇/얼마/언제/승인근거) 기록
9. 구현 시작 전에 `DOMAIN_STUDY_PROTOCOL.md` 수행 및 `DOMAIN_STUDY_LOG.md` 증빙 완료
10. 운영 파라미터는 하드코딩하지 않고 policy id 기반 외부 주입으로 처리
