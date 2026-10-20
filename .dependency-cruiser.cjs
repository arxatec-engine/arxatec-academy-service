module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Una dependencia circular rompe el orden de carga y es imposible de testear aislada.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      comment:
        'Un modulo que nadie importa es codigo muerto. src/constants queda fuera: es un catalogo hoja que publican para los slices que aun no existen.',
      from: {
        orphan: true,
        pathNot: ['\\.d\\.ts$', '^src/constants/', '^src/seed/(index|exams)\\.ts$', '^src/server\\.ts$'],
      },
      to: {},
    },
    {
      name: 'no-cross-module-private',
      severity: 'error',
      comment:
        'La superficie sancionada entre modulos es modules/<m>/shared. El data/ privado de otro modulo no se importa.',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/(?!$1)([^/]+)/(?!shared/)' },
    },
    {
      name: 'no-config-barrel',
      severity: 'error',
      comment:
        'src/config/index.ts es deliberadamente flaco: importar una constante no puede arrancar Prisma.',
      from: { path: '^src/config/index\\.ts$' },
      to: { path: '^src/config/(prisma_client|email|passport)\\.ts$' },
    },
    {
      name: 'no-constants-to-runtime',
      severity: 'error',
      comment: 'src/constants es hoja: no depende de config, infraestructura ni modulos.',
      from: { path: '^src/constants/' },
      to: { path: '^src/(config|infrastructure|middlewares|modules|app|routes)/' },
    },
    {
      name: 'no-utils-to-modules',
      severity: 'error',
      comment: 'La logica de negocio de un dominio no va a utils.',
      from: { path: '^src/utils/' },
      to: { path: '^src/(modules|app|routes|middlewares)/' },
    },
    {
      name: 'no-src-to-test',
      severity: 'error',
      comment: 'El codigo de runtime nunca importa un test.',
      from: { pathNot: '(\\.test\\.ts$|/test/)' },
      to: { path: '(\\.test\\.ts$|/test/)' },
    },
    {
      name: 'not-to-dev-dep',
      severity: 'error',
      comment: 'Una devDependency en runtime revienta en produccion, donde no esta instalada.',
      from: { path: '^src/', pathNot: '(\\.test\\.ts$|/test/)' },
      to: { dependencyTypes: ['npm-dev'] },
    },
    {
      name: 'no-non-package-json',
      severity: 'error',
      comment: 'Toda dependencia externa se declara en package.json.',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'no-deprecated-core',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['core'], path: '^(punycode|domain|sys|querystring)$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^src/generated/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['require', 'node', 'default', 'types'],
      extensions: ['.ts', '.js', '.json'],
      mainFields: ['main', 'types'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
