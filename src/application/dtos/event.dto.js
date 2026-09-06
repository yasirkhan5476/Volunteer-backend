'use strict';

const { z } = require('zod');

const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(5).max(200),
    description: z.string().max(2000).optional(),
    organizationId: z.string().uuid(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusMeters: z.number().positive().max(5000).default(200),
    address: z.string().max(500).optional(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    maxVolunteers: z.number().int().positive().optional(),
  }),
});

const updateEventSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(5).max(200).optional(),
    description: z.string().max(2000).optional(),
    radiusMeters: z.number().positive().max(5000).optional(),
    address: z.string().max(500).optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    maxVolunteers: z.number().int().positive().optional(),
    isActive: z.boolean().optional(),
  }),
});

const listEventsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    organizationId: z.string().uuid().optional(),
    isActive: z.coerce.boolean().optional(),
  }),
});

module.exports = { createEventSchema, updateEventSchema, listEventsSchema };
