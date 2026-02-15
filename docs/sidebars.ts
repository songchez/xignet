import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  developerGuide: [
    'intro',
    {
      type: 'category',
      label: '빠른 시작',
      items: [
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/core-concepts',
      ],
    },
    {
      type: 'category',
      label: '단계별 가이드',
      items: [
        'guides/payment-flow-overview',
        'guides/discovery-stage',
        'guides/verification-stage',
        'guides/settlement-stage',
        'guides/end-to-end-example',
      ],
    },
    {
      type: 'category',
      label: 'API 레퍼런스',
      items: [
        'reference/api-overview',
        'reference/protocol-api',
        'reference/verification-api',
        'reference/settlement-api',
        'reference/types',
        'reference/errors',
      ],
    },
    'troubleshooting',
    'faq',
  ],
};

export default sidebars;
