'use strict';

const { z } = require('zod');

const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/** POST /attendance/check-in */
const checkInSchema = z.object({
  body: coordinateSchema.extend({
    eventId: z.string().uuid(),
  }),
});

/** POST /attendance/check-out */
const checkOutSchema = z.object({
  body: coordinateSchema.extend({
    attendanceId: z.string().uuid(),
  }),
});

module.exports = { checkInSchema, checkOutSchema };
