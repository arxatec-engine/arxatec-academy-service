import { user_city, user_role } from '@/generated/enums';
import type { SeedCredentials } from '@/seed/seed_env';

export interface SeedUser {
  full_name: string;
  email: string;
  password: string;
  role: user_role;
  city: user_city;
  organization: string | null;
  is_independent: boolean;
}

const DEMO_STUDENTS = [
  {
    full_name: 'Diego Salazar Medina',
    email: 'diego@seed.arxatec.test',
    city: user_city.LIMA,
    organization: 'Estudio Salazar',
  },
  {
    full_name: 'Lucía Fernández Soto',
    email: 'lucia@seed.arxatec.test',
    city: user_city.AREQUIPA,
    organization: null,
  },
  {
    full_name: 'Carlos Mendoza Ruiz',
    email: 'carlos@seed.arxatec.test',
    city: user_city.TRUJILLO,
    organization: 'Mendoza y Asociados',
  },
  {
    full_name: 'Valeria Paredes León',
    email: 'valeria@seed.arxatec.test',
    city: user_city.LIMA,
    organization: null,
  },
  {
    full_name: 'Andrés Torres Vega',
    email: 'andres@seed.arxatec.test',
    city: user_city.AREQUIPA,
    organization: 'Estudio Torres',
  },
  {
    full_name: 'Camila Vargas Castro',
    email: 'camila@seed.arxatec.test',
    city: user_city.TRUJILLO,
    organization: null,
  },
  {
    full_name: 'Jorge Ríos Cabrera',
    email: 'jorge@seed.arxatec.test',
    city: user_city.LIMA,
    organization: 'Ríos Consultores',
  },
  {
    full_name: 'Daniela Huamán Flores',
    email: 'daniela@seed.arxatec.test',
    city: user_city.AREQUIPA,
    organization: null,
  },
  {
    full_name: 'Renato Silva Campos',
    email: 'renato@seed.arxatec.test',
    city: user_city.TRUJILLO,
    organization: 'Silva Legal',
  },
  {
    full_name: 'Paola Chávez Romero',
    email: 'paola@seed.arxatec.test',
    city: user_city.LIMA,
    organization: null,
  },
  {
    full_name: 'Sofía Castillo Rojas',
    email: 'sofia@seed.arxatec.test',
    city: user_city.LIMA,
    organization: 'Castillo Legal',
  },
  {
    full_name: 'Mateo Gutiérrez Acosta',
    email: 'mateo@seed.arxatec.test',
    city: user_city.AREQUIPA,
    organization: null,
  },
  {
    full_name: 'Fernanda Álvarez Díaz',
    email: 'fernanda@seed.arxatec.test',
    city: user_city.TRUJILLO,
    organization: 'Álvarez y Asociados',
  },
  {
    full_name: 'Sebastián Ramos Aguilar',
    email: 'sebastian@seed.arxatec.test',
    city: user_city.LIMA,
    organization: null,
  },
  {
    full_name: 'Adriana Cárdenas Suárez',
    email: 'adriana@seed.arxatec.test',
    city: user_city.AREQUIPA,
    organization: 'Cárdenas Legal',
  },
  {
    full_name: 'Luis Navarro Ponce',
    email: 'luis@seed.arxatec.test',
    city: user_city.TRUJILLO,
    organization: null,
  },
  {
    full_name: 'Gabriela Flores Miranda',
    email: 'gabriela@seed.arxatec.test',
    city: user_city.LIMA,
    organization: 'Miranda Consultores',
  },
  {
    full_name: 'Joaquín Cabrera Rivas',
    email: 'joaquin@seed.arxatec.test',
    city: user_city.AREQUIPA,
    organization: null,
  },
  {
    full_name: 'Natalia Vásquez Delgado',
    email: 'natalia@seed.arxatec.test',
    city: user_city.TRUJILLO,
    organization: 'Estudio Delgado',
  },
  {
    full_name: 'Alonso Pacheco Salinas',
    email: 'alonso@seed.arxatec.test',
    city: user_city.LIMA,
    organization: null,
  },
  {
    full_name: 'Mariana León Velásquez',
    email: 'mariana@seed.arxatec.test',
    city: user_city.AREQUIPA,
    organization: 'León Abogados',
  },
  {
    full_name: 'Rodrigo Espinoza Cruz',
    email: 'rodrigo@seed.arxatec.test',
    city: user_city.TRUJILLO,
    organization: null,
  },
  {
    full_name: 'Jimena Campos Valdez',
    email: 'jimena@seed.arxatec.test',
    city: user_city.LIMA,
    organization: 'Campos y Asociados',
  },
  {
    full_name: 'Álvaro Medina Fuentes',
    email: 'alvaro@seed.arxatec.test',
    city: user_city.AREQUIPA,
    organization: null,
  },
  {
    full_name: 'Luciana Acosta Pérez',
    email: 'luciana@seed.arxatec.test',
    city: user_city.TRUJILLO,
    organization: 'Acosta Legal',
  },
  {
    full_name: 'Manuel Rojas Benavides',
    email: 'manuel@seed.arxatec.test',
    city: user_city.LIMA,
    organization: null,
  },
  {
    full_name: 'Isabella Ortiz Herrera',
    email: 'isabella@seed.arxatec.test',
    city: user_city.AREQUIPA,
    organization: 'Estudio Ortiz',
  },
  {
    full_name: 'Nicolás Ponce Arias',
    email: 'nicolas@seed.arxatec.test',
    city: user_city.TRUJILLO,
    organization: null,
  },
  {
    full_name: 'Alejandra Suárez Peña',
    email: 'alejandra@seed.arxatec.test',
    city: user_city.LIMA,
    organization: 'Peña Consultores',
  },
  {
    full_name: 'Bruno Delgado Núñez',
    email: 'bruno@seed.arxatec.test',
    city: user_city.AREQUIPA,
    organization: null,
  },
  {
    full_name: 'Claudia Rivas Palomino',
    email: 'claudia@seed.arxatec.test',
    city: user_city.TRUJILLO,
    organization: 'Rivas Abogados',
  },
  {
    full_name: 'Eduardo Salinas Castro',
    email: 'eduardo@seed.arxatec.test',
    city: user_city.LIMA,
    organization: null,
  },
  {
    full_name: 'Rocío Velásquez Zamora',
    email: 'rocio@seed.arxatec.test',
    city: user_city.AREQUIPA,
    organization: 'Estudio Zamora',
  },
  {
    full_name: 'Patricio Fuentes Carrillo',
    email: 'patricio@seed.arxatec.test',
    city: user_city.TRUJILLO,
    organization: null,
  },
] as const;

export const buildSeedUsers = (credentials: SeedCredentials): readonly SeedUser[] => [
  {
    full_name: 'Admin Arxatec',
    email: credentials.SEED_ADMIN_EMAIL,
    password: credentials.SEED_ADMIN_PASSWORD,
    role: user_role.ADMIN,
    city: user_city.LIMA,
    organization: 'Arxatec',
    is_independent: false,
  },
  {
    full_name: 'María Quispe Rojas',
    email: credentials.SEED_STUDENT_EMAIL,
    password: credentials.SEED_STUDENT_PASSWORD,
    role: user_role.STUDENT,
    city: user_city.LIMA,
    organization: null,
    is_independent: true,
  },
  ...DEMO_STUDENTS.map((student) => ({
    ...student,
    password: credentials.SEED_STUDENT_PASSWORD,
    role: user_role.STUDENT,
    is_independent: student.organization === null,
  })),
];
