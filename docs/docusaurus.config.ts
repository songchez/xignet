import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'XIGNET x402 SDK 문서',
  tagline: '초보자도 이해할 수 있는 x402 결제 플로우 가이드',
  favicon: 'img/favicon.ico',
  future: {
    v4: true,
  },
  url: 'https://docs.xignet.dev',
  baseUrl: '/',
  organizationName: 'xignet',
  projectName: 'x402-sdk',
  onBrokenLinks: 'throw',
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'XIGNET x402 SDK',
      logo: {
        alt: 'XIGNET 로고',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'developerGuide',
          position: 'left',
          label: '문서',
        },
        {
          to: '/docs/getting-started/installation',
          label: '시작하기',
          position: 'left',
        },
        {
          to: '/docs/reference/api-overview',
          label: 'API 레퍼런스',
          position: 'left',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '문서',
          items: [
            {
              label: '소개',
              to: '/docs/intro',
            },
            {
              label: '단계별 가이드',
              to: '/docs/guides/payment-flow-overview',
            },
          ],
        },
        {
          title: '레퍼런스',
          items: [
            {
              label: 'API 개요',
              to: '/docs/reference/api-overview',
            },
            {
              label: '오류 코드',
              to: '/docs/reference/errors',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} XIGNET`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
