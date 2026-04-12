import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  nickname: z.string().optional(),
  position: z.enum(['drive', 'reves', 'indistinto']),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export const profileSchema = z.object({
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  nickname: z.string().optional(),
  position: z.enum(['drive', 'reves', 'indistinto']),
});

export const eventSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  location: z.string().min(3, 'El lugar debe tener al menos 3 caracteres'),
  date: z.string().min(1, 'La fecha es obligatoria'),
  time: z.string().min(1, 'La hora es obligatoria'),
  maxCapacity: z.coerce.number().min(2, 'El cupo mínimo es 2').max(100, 'El cupo máximo es 100'),
  price: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  description: z.string().optional(),
  status: z.enum(['draft', 'published', 'closed', 'finished', 'cancelled']),
  tournamentType: z.enum(['liga', 'libre']),
});
