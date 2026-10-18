import { MimeTypes, type MimeType } from '@/constants/files';
import {
  course_level,
  course_status,
  course_topic,
  lesson_status,
  lesson_type,
  video_provider,
} from '@/generated/enums';
import type { LessonContentDraft } from '@/modules/courses/shared/domain/lesson_content.types';

export interface SeedLessonResource {
  title: string;
  file_key: string;
  mime_type: MimeType;
  size_bytes: number;
  position: number;
}

export interface SeedLesson {
  slug: string;
  title: string;
  description: string;
  is_free_sample: boolean;
  status: lesson_status;
  content: LessonContentDraft;
  transcript?: string;
  resources: readonly SeedLessonResource[];
}

export interface SeedCourse {
  slug: string;
  title: string;
  short_description: string;
  long_description: string;
  topic: course_topic;
  level: course_level;
  status: course_status;
  catalog_order: number;
  published_at: Date;
  lessons: readonly SeedLesson[];
}

// Videos públicos de muestra para probar el reproductor de YouTube en desarrollo.
const video = (external_id: string, duration_seconds: number): LessonContentDraft => ({
  type: lesson_type.VIDEO,
  video_provider: video_provider.YOUTUBE,
  video_external_id: external_id,
  duration_seconds,
});

const COSTO_OCULTO_BODY = [
  '<h2>Dónde se va el tiempo</h2>',
  '<p>Un abogado con veinte casos activos abre, en promedio, catorce archivos para armar un escrito: el anterior, el modelo, la resolución, los anexos. Ninguno de esos pasos es trabajo legal. Es logística de archivos, y se paga con las horas que deberían ir a la estrategia del caso.</p>',
  '<p>La cuenta es simple. Si buscar y ordenar toma cuarenta minutos al día, son diez horas al mes. A la tarifa más conservadora de un estudio pequeño en Lima, eso ya paga varias veces cualquier herramienta de gestión.</p>',
  '<blockquote>El problema no es que trabajes en Word. Es que Word no sabe en qué caso estás.</blockquote>',
  '<h2>La última versión no existe</h2>',
  '<p>Cuando un documento vive en una carpeta compartida, su nombre se convierte en su historia: <code>demanda_final</code>, <code>demanda_final_v2</code>, <code>demanda_final_ok</code>. El día que el juzgado corre un plazo, alguien presenta la versión equivocada. Ese riesgo no se resuelve con disciplina; se resuelve quitando la posibilidad de que existan dos versiones.</p>',
  '<ul>',
  '<li>Un solo lugar donde vive el expediente, con su historia visible.</li>',
  '<li>Un solo responsable por escrito, con la fecha del plazo al lado.</li>',
  '<li>Nada de adjuntos por correo entre socios del mismo estudio.</li>',
  '</ul>',
  '<h2>El correo como archivador</h2>',
  '<p>El correo ordena por fecha de llegada, no por caso. Sirve para conversar y es pésimo para guardar: lo que un cliente mandó en marzo queda a doce pantallas de distancia del escrito que lo usa. Cada vez que un expediente vive en la bandeja de entrada, el estudio depende de la memoria de una persona.</p>',
  '<h2>Qué hacer esta semana</h2>',
  '<p>Elige tus tres casos más activos y ármales una línea de tiempo: qué pasó, cuándo, con qué documento. No necesitas software para el primer intento, basta una hoja. Lo que aprendas ahí es exactamente lo que un sistema debería hacer solo.</p>',
].join('');

const RIESGOS_REALES_BODY = [
  '<h2>Qué exige la Ley de Protección de Datos Personales</h2>',
  '<p>Los datos de tus clientes son datos personales, y varios de ellos son datos sensibles. La ley te obliga a saber dónde están, quién los toca y con qué finalidad los guardas. No es un trámite: es la diferencia entre un incidente y una sanción.</p>',
  '<h2>Qué preguntarle a un proveedor</h2>',
  '<ul>',
  '<li>¿Dónde se guardan los archivos y bajo qué jurisdicción?</li>',
  '<li>¿Quién de su equipo puede leerlos y con qué registro queda?</li>',
  '<li>¿Qué pasa con tu información el día que dejas de pagar?</li>',
  '<li>¿Hay cifrado en tránsito y en reposo, y quién tiene las llaves?</li>',
  '</ul>',
  '<h2>Qué no debe salir nunca de tu estudio</h2>',
  '<p>Documentos de identidad, historias clínicas, estados de cuenta y borradores de estrategia no viajan por aplicaciones de mensajería ni por correos personales. Si necesitas compartirlos, que sea por un enlace con caducidad y con registro de quién lo abrió.</p>',
].join('');

interface VideoLessonSeed {
  slug: string;
  title: string;
  description: string;
  external_id: string;
  duration_seconds: number;
}

const toVideoLessons = (lessons: readonly VideoLessonSeed[]): readonly SeedLesson[] =>
  lessons.map((lesson) => ({
    slug: lesson.slug,
    title: lesson.title,
    description: lesson.description,
    is_free_sample: false,
    status: lesson_status.PUBLISHED,
    content: video(lesson.external_id, lesson.duration_seconds),
    resources: [],
  }));

const FUNDAMENTOS_LESSONS: readonly SeedLesson[] = [
  {
    slug: 'que-es-legal-tech-y-que-no',
    title: 'Qué es legal tech y qué no',
    description:
      'Separamos tres cosas que suelen ir revueltas: digitalizar papeles, ordenar el trabajo y automatizar decisiones. Con ejemplos de un estudio de tres abogados en Lima.',
    is_free_sample: true,
    status: lesson_status.PUBLISHED,
    content: video('aqz-KE-bpKQ', 480),
    resources: [
      {
        title: 'Mapa de las tres capas',
        file_key: 'lesson_resources/mapa-de-las-tres-capas.pdf',
        mime_type: MimeTypes.pdf,
        size_bytes: 184320,
        position: 1,
      },
      {
        title: 'Checklist: qué revisar antes de comprar software',
        file_key: 'lesson_resources/checklist-antes-de-comprar-software.pdf',
        mime_type: MimeTypes.pdf,
        size_bytes: 96256,
        position: 2,
      },
    ],
  },
  {
    slug: 'el-costo-oculto-de-trabajar-en-word-y-correo',
    title: 'El costo oculto de trabajar en Word y correo',
    description:
      'Cuánto tiempo se pierde buscando la última versión de un escrito, y por qué el correo es el peor archivador que existe.',
    is_free_sample: false,
    status: lesson_status.PUBLISHED,
    content: video('YE7VzlLtp-4', 600),
    transcript: COSTO_OCULTO_BODY.replace(/<[^>]*>/g, '\n')
      .replace(/\n+/g, '\n\n')
      .trim(),
    resources: [],
  },
  {
    slug: 'las-cuatro-herramientas-que-ya-usas-sin-saberlo',
    title: 'Las cuatro herramientas que ya usas sin saberlo',
    description:
      'Firma digital, notificaciones electrónicas, expediente judicial electrónico y buscadores de jurisprudencia: lo que ya es obligatorio y lo que aún es opcional.',
    is_free_sample: false,
    status: lesson_status.PUBLISHED,
    content: video('R6MlUcmOul8', 664),
    resources: [
      {
        title: 'Tabla comparativa de las cuatro herramientas',
        file_key: 'lesson_resources/tabla-comparativa-cuatro-herramientas.pdf',
        mime_type: MimeTypes.pdf,
        size_bytes: 245760,
        position: 1,
      },
    ],
  },
  {
    slug: 'como-se-ve-un-caso-ordenado',
    title: 'Cómo se ve un caso ordenado',
    description:
      'Un mismo expediente, dos formas de llevarlo. Qué cambia el día que el juzgado pide algo con plazo de 48 horas.',
    is_free_sample: false,
    status: lesson_status.PUBLISHED,
    content: video('aqz-KE-bpKQ', 540),
    resources: [],
  },
  {
    slug: 'riesgos-reales-confidencialidad-y-datos-del-cliente',
    title: 'Riesgos reales: confidencialidad y datos del cliente',
    description:
      'Qué exige la Ley de Protección de Datos Personales, qué preguntarle a un proveedor y qué no debe salir nunca de tu estudio.',
    is_free_sample: false,
    status: lesson_status.PUBLISHED,
    content: video('YE7VzlLtp-4', 600),
    transcript: RIESGOS_REALES_BODY.replace(/<[^>]*>/g, '\n')
      .replace(/\n+/g, '\n\n')
      .trim(),
    resources: [],
  },
  {
    slug: 'tu-primera-semana-con-un-sistema',
    title: 'Tu primera semana con un sistema',
    description:
      'Un plan de cinco días para migrar tus casos activos sin parar de atender. Incluye plantilla de inventario descargable.',
    is_free_sample: false,
    status: lesson_status.PUBLISHED,
    content: video('R6MlUcmOul8', 720),
    resources: [
      {
        title: 'Plantilla de inventario de casos',
        file_key: 'lesson_resources/plantilla-inventario-de-casos.xlsx',
        mime_type: MimeTypes.xlsx,
        size_bytes: 61440,
        position: 1,
      },
    ],
  },
  ...toVideoLessons([
    {
      slug: 'diagnostico-digital-de-tu-estudio',
      title: 'Diagnóstico digital de tu estudio',
      description:
        'Evalúa cómo entran los casos, dónde se guarda la información y qué tareas se repiten.',
      external_id: 'aqz-KE-bpKQ',
      duration_seconds: 600,
    },
    {
      slug: 'mapear-el-recorrido-de-un-cliente',
      title: 'Mapear el recorrido de un cliente',
      description: 'Dibuja el recorrido desde la primera consulta hasta el cierre del expediente.',
      external_id: 'YE7VzlLtp-4',
      duration_seconds: 540,
    },
    {
      slug: 'priorizar-problemas-antes-de-elegir-herramientas',
      title: 'Priorizar problemas antes de elegir herramientas',
      description: 'Ordena los problemas por frecuencia, tiempo perdido e impacto en la atención.',
      external_id: 'R6MlUcmOul8',
      duration_seconds: 660,
    },
    {
      slug: 'estructura-de-carpetas-para-el-equipo',
      title: 'Estructura de carpetas para el equipo',
      description: 'Define una estructura de trabajo que cualquier integrante pueda entender.',
      external_id: 'aqz-KE-bpKQ',
      duration_seconds: 480,
    },
    {
      slug: 'nombres-de-archivos-que-se-pueden-buscar',
      title: 'Nombres de archivos que se pueden buscar',
      description: 'Acuerda una convención con fecha, expediente y tipo de documento.',
      external_id: 'YE7VzlLtp-4',
      duration_seconds: 420,
    },
    {
      slug: 'versiones-y-revision-de-documentos',
      title: 'Versiones y revisión de documentos',
      description: 'Organiza borradores, observaciones y aprobaciones sin perder el historial.',
      external_id: 'R6MlUcmOul8',
      duration_seconds: 720,
    },
    {
      slug: 'digitalizar-y-encontrar-documentos-con-ocr',
      title: 'Digitalizar y encontrar documentos con OCR',
      description: 'Prepara un archivo de práctica y comprueba qué texto reconoce el escaneo.',
      external_id: 'aqz-KE-bpKQ',
      duration_seconds: 600,
    },
    {
      slug: 'crear-una-ficha-unica-del-cliente',
      title: 'Crear una ficha única del cliente',
      description: 'Reúne los datos de contacto y evita volver a pedir la misma información.',
      external_id: 'YE7VzlLtp-4',
      duration_seconds: 540,
    },
    {
      slug: 'armar-la-linea-de-tiempo-del-expediente',
      title: 'Armar la línea de tiempo del expediente',
      description: 'Relaciona actuaciones, documentos y responsables en un mismo historial.',
      external_id: 'R6MlUcmOul8',
      duration_seconds: 660,
    },
    {
      slug: 'tareas-y-responsables-sin-mensajes-sueltos',
      title: 'Tareas y responsables sin mensajes sueltos',
      description: 'Convierte acuerdos de una reunión en tareas con dueño y fecha de revisión.',
      external_id: 'aqz-KE-bpKQ',
      duration_seconds: 480,
    },
    {
      slug: 'calendario-compartido-y-alertas',
      title: 'Calendario compartido y alertas',
      description: 'Configura recordatorios de práctica y revisa quién recibe cada aviso.',
      external_id: 'YE7VzlLtp-4',
      duration_seconds: 600,
    },
    {
      slug: 'recibir-documentos-con-un-formulario',
      title: 'Recibir documentos con un formulario',
      description: 'Diseña una solicitud de información breve, clara y fácil de completar.',
      external_id: 'R6MlUcmOul8',
      duration_seconds: 720,
    },
    {
      slug: 'introduccion-a-las-plantillas-de-escritos',
      title: 'Introducción a las plantillas de escritos',
      description: 'Separa el texto reutilizable de los datos que cambian en cada caso.',
      external_id: 'aqz-KE-bpKQ',
      duration_seconds: 660,
    },
    {
      slug: 'checklist-antes-de-compartir-un-documento',
      title: 'Checklist antes de compartir un documento',
      description: 'Revisa destinatario, versión, permisos y datos incluidos antes de enviarlo.',
      external_id: 'YE7VzlLtp-4',
      duration_seconds: 480,
    },
    {
      slug: 'permisos-por-rol-en-un-estudio',
      title: 'Permisos por rol en un estudio',
      description:
        'Practica con perfiles distintos y comprueba qué información puede ver cada uno.',
      external_id: 'R6MlUcmOul8',
      duration_seconds: 600,
    },
    {
      slug: 'contrasenas-y-verificacion-en-dos-pasos',
      title: 'Contraseñas y verificación en dos pasos',
      description: 'Prepara cuentas de práctica con acceso individual y recuperación documentada.',
      external_id: 'aqz-KE-bpKQ',
      duration_seconds: 540,
    },
    {
      slug: 'copias-de-seguridad-y-prueba-de-restauracion',
      title: 'Copias de seguridad y prueba de restauración',
      description: 'Crea una copia de un expediente ficticio y comprueba que puedes recuperarlo.',
      external_id: 'YE7VzlLtp-4',
      duration_seconds: 780,
    },
    {
      slug: 'compartir-informacion-con-el-cliente',
      title: 'Compartir información con el cliente',
      description: 'Organiza las actualizaciones del caso y los enlaces a documentos de práctica.',
      external_id: 'R6MlUcmOul8',
      duration_seconds: 600,
    },
    {
      slug: 'registrar-tiempo-y-costos-del-caso',
      title: 'Registrar tiempo y costos del caso',
      description:
        'Lleva un registro sencillo de tareas y gastos para comparar tu trabajo semanal.',
      external_id: 'aqz-KE-bpKQ',
      duration_seconds: 660,
    },
    {
      slug: 'medir-el-cambio-con-indicadores-simples',
      title: 'Medir el cambio con indicadores simples',
      description:
        'Compara tiempos de búsqueda, tareas pendientes y errores antes y después del piloto.',
      external_id: 'YE7VzlLtp-4',
      duration_seconds: 540,
    },
    {
      slug: 'preparar-un-piloto-con-tres-expedientes',
      title: 'Preparar un piloto con tres expedientes',
      description:
        'Delimita una prueba pequeña con información ficticia y criterios de evaluación.',
      external_id: 'R6MlUcmOul8',
      duration_seconds: 720,
    },
    {
      slug: 'acompanar-al-equipo-en-la-migracion',
      title: 'Acompañar al equipo en la migración',
      description:
        'Planifica una sesión de práctica y recoge las dudas que aparecen al cambiar hábitos.',
      external_id: 'aqz-KE-bpKQ',
      duration_seconds: 600,
    },
    {
      slug: 'documentar-el-proceso-del-estudio',
      title: 'Documentar el proceso del estudio',
      description:
        'Escribe una guía breve para que una persona nueva pueda seguir el flujo de trabajo.',
      external_id: 'YE7VzlLtp-4',
      duration_seconds: 660,
    },
    {
      slug: 'proyecto-final-tu-plan-de-mejora-digital',
      title: 'Proyecto final: tu plan de mejora digital',
      description:
        'Reúne el diagnóstico, el piloto y los resultados en un plan para los próximos treinta días.',
      external_id: 'R6MlUcmOul8',
      duration_seconds: 900,
    },
  ]),
];

const AUTOMATIZA_LESSONS = toVideoLessons([
  {
    slug: 'inventario-de-tus-escritos-repetidos',
    title: 'Inventario de tus escritos repetidos',
    description:
      'Antes de automatizar nada, hay que saber qué se repite. Sale una lista corta y sorprendente.',
    external_id: 'aqz-KE-bpKQ',
    duration_seconds: 600,
  },
  {
    slug: 'de-un-escrito-a-una-plantilla',
    title: 'De un escrito a una plantilla',
    description:
      'Qué partes de un escrito son fijas, cuáles dependen del caso y cuáles no deberían existir.',
    external_id: 'YE7VzlLtp-4',
    duration_seconds: 780,
  },
  {
    slug: 'variables-que-se-llenan-solas',
    title: 'Variables que se llenan solas',
    description:
      'Datos del expediente, del cliente y del juzgado que entran una vez y salen en todos los documentos.',
    external_id: 'R6MlUcmOul8',
    duration_seconds: 720,
  },
  {
    slug: 'clausulas-reutilizables-sin-copiar-y-pegar',
    title: 'Cláusulas reutilizables sin copiar y pegar',
    description:
      'Una biblioteca de cláusulas con dueño y fecha de revisión, para dejar de heredar errores viejos.',
    external_id: 'aqz-KE-bpKQ',
    duration_seconds: 660,
  },
  {
    slug: 'revisa-lo-automatizado-antes-de-presentarlo',
    title: 'Revisa lo automatizado antes de presentarlo',
    description:
      'La lista de comprobación que evita presentar un escrito con el nombre del cliente anterior.',
    external_id: 'YE7VzlLtp-4',
    duration_seconds: 720,
  },
]);

const IA_APLICADA_LESSONS = toVideoLessons([
  {
    slug: 'como-redactar-un-buen-pedido-a-un-modelo',
    title: 'Cómo redactar un buen pedido a un modelo',
    description:
      'Contexto, formato y límites: las tres cosas que cambian por completo la respuesta que recibes.',
    external_id: 'YE7VzlLtp-4',
    duration_seconds: 720,
  },
  {
    slug: 'resumir-expedientes-largos-sin-perder-lo-importante',
    title: 'Resumir expedientes largos sin perder lo importante',
    description:
      'Cómo pedir un resumen que conserve fechas, plazos y montos, y cómo comprobar que no inventó nada.',
    external_id: 'R6MlUcmOul8',
    duration_seconds: 780,
  },
  {
    slug: 'comparar-dos-versiones-de-un-contrato',
    title: 'Comparar dos versiones de un contrato',
    description:
      'Diferencias reales frente a diferencias de redacción, y qué conviene revisar siempre a mano.',
    external_id: 'aqz-KE-bpKQ',
    duration_seconds: 660,
  },
  {
    slug: 'donde-los-modelos-se-equivocan',
    title: 'Dónde los modelos se equivocan',
    description:
      'Jurisprudencia inventada, plazos mal contados y seguridad falsa: los tres errores que más caro cuestan.',
    external_id: 'YE7VzlLtp-4',
    duration_seconds: 840,
  },
  {
    slug: 'confidencialidad-al-usar-modelos-de-lenguaje',
    title: 'Confidencialidad al usar modelos de lenguaje',
    description:
      'Qué se puede pegar en un chat, qué no, y qué preguntarle al proveedor antes de subir un expediente.',
    external_id: 'R6MlUcmOul8',
    duration_seconds: 600,
  },
  {
    slug: 'revisar-un-escrito-con-ayuda-de-un-modelo',
    title: 'Revisar un escrito con ayuda de un modelo',
    description:
      'Un flujo de revisión en dos pasadas: primero forma y estructura, después argumentación.',
    external_id: 'aqz-KE-bpKQ',
    duration_seconds: 720,
  },
  {
    slug: 'arma-tu-propio-cuaderno-de-pedidos',
    title: 'Arma tu propio cuaderno de pedidos',
    description:
      'Guarda lo que te funcionó, con el caso donde lo usaste, y deja de escribir lo mismo cada vez.',
    external_id: 'YE7VzlLtp-4',
    duration_seconds: 720,
  },
]);

const ORDENA_TU_ESTUDIO_LESSONS = toVideoLessons([
  {
    slug: 'el-caso-de-principio-a-fin',
    title: 'El caso de principio a fin',
    description:
      'Seguimos un expediente real desde la consulta inicial hasta el archivo, con todo lo que pasa en medio.',
    external_id: 'R6MlUcmOul8',
    duration_seconds: 600,
  },
  {
    slug: 'expedientes-y-linea-de-tiempo',
    title: 'Expedientes y línea de tiempo',
    description:
      'Cómo se arma la historia del caso sola cuando cada actuación se registra donde corresponde.',
    external_id: 'aqz-KE-bpKQ',
    duration_seconds: 660,
  },
  {
    slug: 'calendario-y-plazos-que-no-se-pasan',
    title: 'Calendario y plazos que no se pasan',
    description:
      'Plazos calculados desde la notificación, avisos con antelación y responsables con nombre.',
    external_id: 'YE7VzlLtp-4',
    duration_seconds: 600,
  },
  {
    slug: 'finanzas-del-estudio-sin-hojas-sueltas',
    title: 'Finanzas del estudio sin hojas sueltas',
    description:
      'Honorarios, gastos y cobranzas atados al caso que los generó, para saber qué caso deja qué.',
    external_id: 'R6MlUcmOul8',
    duration_seconds: 660,
  },
]);

const CONTRATOS_COMO_SISTEMA_LESSONS = toVideoLessons([
  {
    slug: 'un-contrato-es-una-estructura-no-un-texto',
    title: 'Un contrato es una estructura, no un texto',
    description:
      'Partes, objeto, obligaciones y salidas: si la estructura está clara, la redacción se vuelve mecánica.',
    external_id: 'aqz-KE-bpKQ',
    duration_seconds: 720,
  },
  {
    slug: 'biblioteca-de-clausulas-con-dueno',
    title: 'Biblioteca de cláusulas con dueño',
    description: 'Cada cláusula con su responsable, su fecha de revisión y el riesgo que cubre.',
    external_id: 'YE7VzlLtp-4',
    duration_seconds: 780,
  },
  {
    slug: 'versionar-sin-perder-el-hilo',
    title: 'Versionar sin perder el hilo',
    description:
      'Qué cambió, quién lo pidió y por qué: el historial que salva una negociación larga.',
    external_id: 'R6MlUcmOul8',
    duration_seconds: 720,
  },
  {
    slug: 'revisiones-que-se-pueden-repartir',
    title: 'Revisiones que se pueden repartir',
    description:
      'Cómo partir la revisión de un contrato entre dos personas sin pisarse ni duplicar trabajo.',
    external_id: 'aqz-KE-bpKQ',
    duration_seconds: 780,
  },
  {
    slug: 'del-contrato-firmado-al-seguimiento',
    title: 'Del contrato firmado al seguimiento',
    description:
      'Vencimientos, renovaciones y obligaciones periódicas que alguien tiene que recordar.',
    external_id: 'YE7VzlLtp-4',
    duration_seconds: 720,
  },
]);

const EXPEDIENTES_SIN_EXCEL_LESSONS = toVideoLessons([
  {
    slug: 'por-que-la-hoja-de-calculo-se-queda-corta',
    title: 'Por qué la hoja de cálculo se queda corta',
    description:
      'Funciona hasta que sois dos, hay veinte casos y nadie sabe cuál es la fila buena.',
    external_id: 'YE7VzlLtp-4',
    duration_seconds: 660,
  },
  {
    slug: 'que-columnas-se-convierten-en-que-campos',
    title: 'Qué columnas se convierten en qué campos',
    description: 'La traducción de tu hoja actual al modelo de expedientes, columna por columna.',
    external_id: 'R6MlUcmOul8',
    duration_seconds: 720,
  },
  {
    slug: 'migrar-tus-casos-activos-en-una-tarde',
    title: 'Migrar tus casos activos en una tarde',
    description:
      'Primero los que tienen plazo corriendo, después el resto. Con la hoja abierta al lado.',
    external_id: 'aqz-KE-bpKQ',
    duration_seconds: 720,
  },
  {
    slug: 'la-linea-de-tiempo-que-se-arma-sola',
    title: 'La línea de tiempo que se arma sola',
    description:
      'Cada actuación registrada donde toca, y el historial del caso aparece sin que nadie lo escriba.',
    external_id: 'YE7VzlLtp-4',
    duration_seconds: 720,
  },
]);

export const buildSeedCourses = (): readonly SeedCourse[] => [
  {
    slug: 'fundamentos-de-legal-tech',
    title: 'Fundamentos de legal tech',
    short_description:
      'Qué es legal tech, qué problemas resuelve en un estudio pequeño y por dónde empezar sin gastar.',
    long_description:
      'Treinta lecciones en video para entender de qué hablan cuando hablan de legal tech, sin vender nada. Verás qué se automatiza de verdad en un estudio pequeño, cuánto cuesta empezar (poco) y qué riesgos reales existen con los datos de tus clientes. Al terminar sabrás decidir qué herramienta te sirve y cuál es humo.',
    topic: course_topic.FIRST_STEPS,
    level: course_level.INTRODUCTORY,
    status: course_status.PUBLISHED,
    catalog_order: 1,
    published_at: new Date('2026-06-01T12:00:00.000Z'),
    lessons: FUNDAMENTOS_LESSONS,
  },
  {
    slug: 'automatiza-tus-escritos',
    title: 'Automatiza tus escritos',
    short_description:
      'Plantillas, cláusulas reutilizables y variables: convierte tus escritos repetidos en un sistema.',
    long_description:
      'Cinco lecciones para dejar de reescribir lo mismo. Empezamos por el inventario de lo que se repite en tu estudio, seguimos por las plantillas con variables y terminamos con la revisión que evita presentar un escrito con los datos del caso anterior.',
    topic: course_topic.LEGAL_ENGINEERING,
    level: course_level.INTERMEDIATE,
    status: course_status.PUBLISHED,
    catalog_order: 2,
    published_at: new Date('2026-06-08T12:00:00.000Z'),
    lessons: AUTOMATIZA_LESSONS,
  },
  {
    slug: 'ia-aplicada-a-la-practica-legal',
    title: 'IA aplicada a la práctica legal',
    short_description:
      'Cómo usar modelos de lenguaje para resumir, comparar y revisar, y dónde no conviene confiar en ellos.',
    long_description:
      'Siete lecciones con criterio: qué le puedes pedir a un modelo de lenguaje, cómo comprobar lo que responde y qué información de tus clientes no debe entrar nunca en un chat. Con ejemplos de resúmenes, comparaciones y revisiones reales.',
    topic: course_topic.APPLIED_AI,
    level: course_level.INTRODUCTORY,
    status: course_status.PUBLISHED,
    catalog_order: 3,
    published_at: new Date('2026-06-15T12:00:00.000Z'),
    lessons: IA_APLICADA_LESSONS,
  },
  {
    slug: 'ordena-tu-estudio-en-arxatec',
    title: 'Ordena tu estudio en Arxatec',
    short_description:
      'Recorrido por expedientes, calendario y finanzas con un caso real de principio a fin.',
    long_description:
      'Cuatro lecciones que siguen un mismo expediente desde la consulta inicial hasta el archivo. Verás dónde se registra cada actuación, cómo se calculan los plazos y qué caso deja dinero y cuál no.',
    topic: course_topic.ARXATEC_PRODUCT,
    level: course_level.INTRODUCTORY,
    status: course_status.PUBLISHED,
    catalog_order: 4,
    published_at: new Date('2026-06-22T12:00:00.000Z'),
    lessons: ORDENA_TU_ESTUDIO_LESSONS,
  },
  {
    slug: 'contratos-como-sistema',
    title: 'Contratos como sistema',
    short_description:
      'Diseña contratos que se puedan revisar, versionar y reutilizar sin rehacerlos cada vez.',
    long_description:
      'Cinco lecciones para tratar un contrato como una estructura y no como un texto: cláusulas con dueño y fecha de revisión, versiones con historial y un seguimiento que avisa de vencimientos y renovaciones.',
    topic: course_topic.LEGAL_ENGINEERING,
    level: course_level.INTERMEDIATE,
    status: course_status.PUBLISHED,
    catalog_order: 5,
    published_at: new Date('2026-06-29T12:00:00.000Z'),
    lessons: CONTRATOS_COMO_SISTEMA_LESSONS,
  },
  {
    slug: 'expedientes-sin-excel',
    title: 'Expedientes sin Excel',
    short_description: 'Pasa tus casos de hojas de cálculo a una línea de tiempo que se arma sola.',
    long_description:
      'Cuatro lecciones de migración: qué columnas de tu hoja se convierten en qué campos, por dónde empezar para no parar de atender y cómo queda el historial del caso cuando cada actuación se registra donde corresponde.',
    topic: course_topic.ARXATEC_PRODUCT,
    level: course_level.INTRODUCTORY,
    status: course_status.PUBLISHED,
    catalog_order: 6,
    published_at: new Date('2026-07-06T12:00:00.000Z'),
    lessons: EXPEDIENTES_SIN_EXCEL_LESSONS,
  },
];
