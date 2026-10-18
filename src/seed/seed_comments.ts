import { createHash } from 'node:crypto';

import { user_role } from '@/generated/enums';

export interface SeedCommentAuthor {
  id: string;
  role: user_role;
}

export interface SeedCommentLesson {
  id: string;
  title: string;
  position: number;
}

export interface SeedComment {
  id: string;
  lesson_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: Date;
}

interface Discussion {
  question: string;
  replies: readonly string[];
}

// Each exchange starts with the team, followed by the author and other students.
const DISCUSSIONS: readonly Discussion[] = [
  {
    question: '¿Por dónde empezarían si el equipo nunca ha usado un sistema compartido?',
    replies: [
      'Empiecen por un proceso pequeño con un expediente ficticio. Acuerden quién lo actualiza y revisen juntos el resultado antes de sumar más casos.',
      'Voy a probarlo con una sola persona esta semana y traeré el resultado a este hilo.',
      'Nos sirvió hacer la primera prueba juntos en una videollamada y anotar cada duda.',
      'También conviene definir qué resultado esperan ver al terminar la semana.',
      'Dejamos una guía de una página junto al ejemplo y el segundo intento fue mucho más rápido.',
      'Probé el ejercicio y la principal dificultad fue ponernos de acuerdo en los nombres de los campos.',
      'Acordamos cinco campos obligatorios y dejamos los demás para una segunda revisión.',
      'Nosotros hicimos lo mismo; reducir la primera versión ayudó a que todos participaran.',
    ],
  },
  {
    question:
      'Trabajo de forma independiente. ¿Cómo adaptarían el ejercicio para una sola persona?',
    replies: [
      'Usa el mismo flujo, pero limita la primera versión a lo que necesitas consultar cada día. La revisión semanal puede ser contigo mismo y una lista breve.',
      'Entonces comenzaré por mis tareas de esta semana y revisaré qué información me faltó.',
      'También trabajo solo y me ayudó reservar quince minutos al cerrar el viernes.',
      'Dejé una nota con el siguiente paso de cada caso y ahora retomo el trabajo más rápido.',
      'Llevo dos semanas con esa rutina y ya pude simplificar dos pasos que no aportaban nada.',
    ],
  },
  {
    question: '¿Es mejor probar con información inventada o copiar un caso anterior?',
    replies: [
      'Para practicar, crea un caso ficticio con nombres, fechas y documentos inventados. Así puedes compartir las dudas del ejercicio sin exponer información de clientes.',
      'Prepararé un ejemplo ficticio y compartiré solo la estructura del ejercicio.',
      'Inventamos un cliente y tres documentos; fue suficiente para recorrer todos los pasos.',
      'Añadimos un documento duplicado al ejemplo para comprobar cómo lo detectaríamos.',
      'Ese detalle nos ayudó a descubrir un problema que no aparecía con el caso más sencillo.',
    ],
  },
  {
    question: '¿Cómo medirían si el cambio realmente ahorra tiempo?',
    replies: [
      'Elige una tarea repetida, registra cuánto tarda antes del piloto y repite la medición después. Anota también errores y pasos adicionales para comparar el mismo trabajo.',
      'Mediré la búsqueda de un documento con el mismo ejemplo antes y después de organizarlo.',
      'Nosotros anotamos el tiempo de cinco intentos para no depender de un solo resultado.',
      'También registramos cuántas veces tuvimos que pedir ayuda a otro integrante.',
      'La segunda semana bajaron las consultas internas, aunque el primer día fue más lento.',
    ],
  },
  {
    question: '¿Qué harían cuando dos personas quieren trabajar de maneras distintas?',
    replies: [
      'Prueben ambas propuestas con el mismo ejemplo y acuerden dos o tres criterios para compararlas. Documenten la decisión y una fecha para revisarla.',
      'Llevaré las dos propuestas a una prueba corta para que podamos comparar resultados.',
      'Nos ayudó repartir los roles y después intercambiarlos para ver las dificultades del otro.',
      'Elegimos un único flujo para el piloto y guardamos las sugerencias para la revisión.',
      'Después de probarlo, terminamos combinando los pasos que mejor funcionaron de cada opción.',
    ],
  },
  {
    question: '¿Conviene migrar toda la información de golpe o hacerlo por etapas?',
    replies: [
      'Empieza con un grupo pequeño y define cómo comprobarás que está completo. Mantén una lista de pendientes y amplía la prueba cuando el primer grupo esté revisado.',
      'Separaré tres ejemplos y comprobaré el resultado antes de continuar con el resto.',
      'Mover todo a la vez nos generó trabajo duplicado; con grupos pequeños fue más sencillo.',
      'La lista de pendientes nos permitió saber qué se había revisado y qué faltaba validar.',
      'Incluimos una columna con la persona que verificó cada elemento para evitar confusiones.',
    ],
  },
  {
    question: '¿Cómo dejarían documentado el ejercicio para alguien que entra al equipo después?',
    replies: [
      'Prepara una guía breve con el objetivo, un ejemplo ficticio y el resultado esperado. Pide a otra persona que la siga y anota dónde necesita ayuda.',
      'Haré una primera guía y le pediré a un compañero que intente seguirla sin mis explicaciones.',
      'Una captura por paso nos funcionó mejor que un documento largo.',
      'Añadimos una sección pequeña con los errores más habituales y cómo resolverlos.',
      'La primera prueba reveló dos instrucciones que para nosotros eran obvias y para alguien nuevo no.',
    ],
  },
  {
    question: '¿Se puede hacer la primera práctica con herramientas gratuitas?',
    replies: [
      'Sí. Para entender el flujo puedes usar una hoja, una carpeta de prueba y datos ficticios. Primero comprueba el proceso y después evalúa qué herramienta necesitas.',
      'Perfecto, haré la práctica con una hoja y compararé el resultado con el ejemplo de la clase.',
      'Eso hicimos en el estudio y nos ayudó a identificar qué necesitábamos antes de buscar opciones.',
      'El mayor cambio fue acordar una forma de trabajar, más que añadir una aplicación.',
      'Guardamos los criterios de la prueba para usarlos cuando evaluemos otras herramientas.',
    ],
  },
  {
    question: '¿Cada cuánto revisarían el proceso después de ponerlo en marcha?',
    replies: [
      'Durante el piloto, una revisión breve semanal permite detectar obstáculos pronto. Después pueden ajustar la frecuencia según el volumen de trabajo y las dudas que aparezcan.',
      'Reservaré un espacio semanal durante el primer mes y llevaré una lista de dudas.',
      'Nos ayuda revisar un ejemplo concreto en cada reunión en lugar de hablar solo de impresiones.',
      'Dejamos una única mejora pendiente por semana para poder comprobar si funcionó.',
      'Ese límite nos ayudó a terminar los cambios antes de empezar otros nuevos.',
    ],
  },
  {
    question: 'Terminé la práctica. ¿Qué revisarían antes de darla por lista?',
    replies: [
      'Recorre el ejemplo desde el inicio, comprueba que otra persona lo puede entender y verifica el resultado contra el objetivo que definiste para la prueba.',
      'Volveré a hacerlo desde cero para comprobar si olvidé algún paso en la guía.',
      'Pedimos a alguien que no participó en la preparación que probara el recorrido completo.',
      'Encontró una instrucción ambigua y la corregimos antes de compartirlo con el resto.',
      'Añadimos esa revisión a la lista y la siguiente prueba ya salió sin ayuda.',
    ],
  },
];

const SCENARIOS = [
  'un estudio de dos abogados en Lima',
  'mi práctica independiente',
  'un equipo de cuatro personas en Arequipa',
  'un estudio que atiende varias especialidades',
  'un equipo que trabaja desde distintas ciudades',
  'una oficina pequeña en Trujillo',
  'un equipo con una persona recién incorporada',
  'un estudio que está ordenando sus primeros expedientes digitales',
] as const;

const commentId = (lesson_id: string, thread: number, reply: number): string =>
  `seed_${createHash('sha256').update(`${lesson_id}:${thread}:${reply}`).digest('hex').slice(0, 40)}`;

export const buildSeedComments = (
  lesson: SeedCommentLesson,
  authors: readonly SeedCommentAuthor[],
  published_at: Date,
): readonly SeedComment[] => {
  const team = authors.find((author) => author.role === user_role.ADMIN);
  const students = authors.filter((author) => author.role === user_role.STUDENT);

  if (team === undefined || students.length < 2) {
    throw new Error('La semilla de comentarios necesita un administrador y al menos dos alumnos.');
  }

  const comments: SeedComment[] = [];
  const threadCount = lesson.position === 1 ? 24 : 6 + (lesson.position % 5);
  const start = published_at.getTime() + lesson.position * 24 * 60 * 60 * 1000;

  for (let thread = 0; thread < threadCount; thread += 1) {
    const discussion = DISCUSSIONS[(thread + lesson.position - 1) % DISCUSSIONS.length];
    const author = students[(thread + lesson.position - 1) % students.length];
    const scenario = SCENARIOS[(thread + lesson.position - 1) % SCENARIOS.length];
    const created_at = new Date(start + thread * 60 * 60 * 1000);
    const rootId = commentId(lesson.id, thread, 0);

    comments.push({
      id: rootId,
      lesson_id: lesson.id,
      user_id: author.id,
      parent_id: null,
      body: `Sobre «${lesson.title}»: ${discussion.question}\n\nEstoy haciendo la práctica en ${scenario}.`,
      created_at,
    });

    const replyCount =
      thread === 0 ? discussion.replies.length : thread % 6 === 5 ? 0 : 2 + (thread % 4);

    for (const [index, body] of discussion.replies.slice(0, replyCount).entries()) {
      const participant =
        index === 0
          ? team
          : index === 1
            ? author
            : students[(thread + lesson.position + index) % students.length];

      comments.push({
        id: commentId(lesson.id, thread, index + 1),
        lesson_id: lesson.id,
        user_id: participant.id,
        parent_id: rootId,
        body,
        created_at: new Date(created_at.getTime() + (index + 1) * 7 * 60 * 1000),
      });
    }
  }

  return comments;
};
