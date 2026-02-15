import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import {ArrowRight, BookOpen, CircleCheckBig, ShieldCheck, Wallet} from 'lucide-react';

import {Badge} from '@site/src/components/ui/badge';
import {Button} from '@site/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@site/src/components/ui/card';

export default function Home(): ReactNode {
  return (
    <Layout
      title="XIGNET x402 SDK 문서"
      description="초보자도 이해할 수 있는 x402 결제 플로우 문서 사이트"
    >
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 md:px-8">
        <section className="hero-surface overflow-hidden rounded-3xl border p-6 md:p-12">
          <div className="max-w-3xl space-y-5">
            <Badge variant="secondary" className="text-xs uppercase tracking-wide">
              Docusaurus + Tailwind + shadcn
            </Badge>
            <h1 className="text-3xl font-extrabold leading-tight md:text-5xl">
              x402 결제 라이브러리를
              <br />
              처음부터 차근차근 배워보세요
            </h1>
            <p className="text-base text-muted-foreground md:text-lg">
              이 문서는 결제 도메인을 처음 접하는 개발자도 따라할 수 있도록
              Discovery, Verification, Settlement 단계를 아주 세밀하게 설명합니다.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/docs/intro">
                <Button size="lg">
                  문서 시작하기
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/docs/guides/end-to-end-example">
                <Button size="lg" variant="outline">
                  실전 예제 바로 보기
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BookOpen className="h-5 w-5" />
                Discovery
              </CardTitle>
              <CardDescription>결제 요구를 안전하게 읽고 표준 형태로 정리</CardDescription>
            </CardHeader>
            <CardContent>
              `WWW-Authenticate` / `PAYMENT-REQUIRED`를 파싱하고, 정책과 TTM 해시를 검증합니다.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ShieldCheck className="h-5 w-5" />
                Verification
              </CardTitle>
              <CardDescription>사용자 동의와 생체 인증을 결제 의도와 연결</CardDescription>
            </CardHeader>
            <CardContent>
              TTM 해시 기반 요청을 만들고 WebAuthn 검증 결과를 영수증 형태로 남깁니다.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Wallet className="h-5 w-5" />
                Settlement
              </CardTitle>
              <CardDescription>온체인 정산 증명 확인과 주문 확정 처리</CardDescription>
            </CardHeader>
            <CardContent>
              정산 증명 검증, 재시도, 파이널리티 체크, 멱등성(replay) 처리까지 다룹니다.
            </CardContent>
          </Card>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="mb-3 text-2xl font-bold">학습 순서 추천</h2>
          <ul className="grid gap-3 text-sm md:grid-cols-2">
            <li className="flex items-start gap-2">
              <CircleCheckBig className="mt-0.5 h-4 w-4 text-primary" />
              <Link to="/docs/getting-started/installation">설치하기</Link>에서 실행 환경을 맞추기
            </li>
            <li className="flex items-start gap-2">
              <CircleCheckBig className="mt-0.5 h-4 w-4 text-primary" />
              <Link to="/docs/getting-started/quick-start">5분 Quick Start</Link>로 흐름 전체 보기
            </li>
            <li className="flex items-start gap-2">
              <CircleCheckBig className="mt-0.5 h-4 w-4 text-primary" />
              <Link to="/docs/guides/payment-flow-overview">단계별 가이드</Link>에서 단계별 책임 이해하기
            </li>
            <li className="flex items-start gap-2">
              <CircleCheckBig className="mt-0.5 h-4 w-4 text-primary" />
              <Link to="/docs/reference/api-overview">API 레퍼런스</Link>로 함수 사양 확인하기
            </li>
          </ul>
        </section>
      </main>
    </Layout>
  );
}
