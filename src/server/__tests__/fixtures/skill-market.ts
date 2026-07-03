export const CLAWHUB_TOP_SKILLS_RESPONSE = {
  items: [
    {
      slug: 'skill-vetter',
      displayName: 'Skill Vetter',
      summary: 'Security-first skill vetting for AI agents.',
      description: null,
      topics: ['GitHub', 'Permission'],
      tags: { latest: '1.0.0' },
      stats: { comments: 0, downloads: 260911, installs: 11988, stars: 1248, versions: 1 },
      latestVersion: { version: '1.0.0', license: 'Apache-2.0' },
      metadata: null,
    },
  ],
  nextCursor: null,
}

export const CLAWHUB_SCAN_RESPONSE = {
  status: 'clean',
  hasWarnings: false,
  scanners: {
    skillspector: { status: 'clean', summary: 'No dangerous patterns detected.' },
  },
  sha256: 'a'.repeat(64),
}

export const SKILLHUB_TOP_SKILLS_RESPONSE = {
  code: 0,
  data: {
    skills: [
      {
        slug: 'skill-vetter',
        name: 'Skill Vetter',
        description: 'Security-first skill vetting for AI agents.',
        description_zh: 'AI智能体技能安全预审工具。',
        downloads: 273329,
        installs: 37273,
        stars: 1253,
        ownerName: 'spclaudehome',
        source: 'clawhub',
        upstream_url: 'https://clawhub.ai/spclaudehome/skill-vetter',
        license: 'Apache-2.0',
        tags: ['GitHub', 'Permission'],
        version: '1.0.0',
        labels: { requires_api_key: 'false' },
        verified: false,
      },
    ],
  },
}

export const SKILLHUB_DETAIL_RESPONSE = {
  contentZhAvailable: true,
  latestVersion: { version: '1.0.1' },
  owner: { handle: 'spclaudehome', displayName: 'spclaudehome' },
  securityReports: {
    keen: { status: 'benign', statusText: '安全，无风险' },
    sanbu: { status: 'benign', statusText: '安全，无风险' },
  },
  skill: {
    slug: 'skill-vetter',
    displayName: 'Skill Vetter',
    summary: 'Security-first skill vetting for AI agents.',
    summary_zh: 'AI智能体技能安全预审工具。',
    sourceUrl: 'https://clawhub.ai/spclaudehome/skill-vetter',
    stats: { downloads: 273329, installs: 37273, stars: 1253 },
    labels: { requires_api_key: 'false' },
    license: 'Apache-2.0',
    tags: ['GitHub', 'Permission'],
    version: '1.0.0',
  },
}
