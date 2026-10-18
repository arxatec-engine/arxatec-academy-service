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
