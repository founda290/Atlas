export const integrations = [
  {
    id: 'hosted-worker',
    name: 'Isolated coding worker',
    category: 'AI execution',
    status: 'Unavailable',
    description:
      'A hosted worker with lifecycle controls and safety limits is required before hosted messaging can run.',
    guide: '/docs/runtime',
  },
  {
    id: 'providers',
    name: 'Model providers',
    category: 'AI providers',
    status: 'Unavailable',
    description:
      'A provider has not been selected for hosted Atlas. Credentials must remain server-side and are never stored in the browser.',
    guide: '/docs/providers',
  },
  {
    id: 'editor',
    name: 'Local development tools',
    category: 'Development tools',
    status: 'Available',
    description:
      'Use your existing local editor and Git alongside Atlas to inspect code and review changes. No direct connection is implied.',
    guide: '/docs/workspace',
  },
  {
    id: 'mcp',
    name: 'MCP server management',
    category: 'MCP integrations',
    status: 'Planned',
    description:
      'Direct server configuration and connection management in Atlas are not implemented.',
    guide: '/docs/runtime',
  },
  {
    id: 'cli',
    name: 'CLI connections',
    category: 'CLI integrations',
    status: 'Planned',
    description: 'Atlas has no general-purpose command endpoint or verified terminal stream.',
    guide: '/docs/security',
  },
  {
    id: 'git',
    name: 'Git service connections',
    category: 'External services',
    status: 'Planned',
    description:
      'Remote repository connection, OAuth and pull-request workflows are not implemented.',
    guide: '/docs/projects',
  },
] as const
