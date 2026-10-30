export const integrations = [
  {
    id: 'opencode',
    name: 'OpenCode',
    category: 'Coding engines',
    status: 'Available',
    description:
      'The implemented local agent runtime. Atlas owns the SDK connection on the backend.',
    guide: '/docs/runtime',
  },
  {
    id: 'providers',
    name: 'OpenCode provider configuration',
    category: 'AI providers',
    status: 'Available',
    description:
      'Use the provider credentials and default model configured locally in OpenCode. Atlas has no browser API-key vault.',
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
