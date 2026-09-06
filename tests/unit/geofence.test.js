'use strict';

const { isWithinGeofence, getDistanceMeters } = require('../../src/domain/services/geofence.service');

describe('GeofenceService', () => {
  const eventGeofence = {
    latitude: 31.5204,
    longitude: 74.3587,
    radiusMeters: 200,
  };

  test('returns true when volunteer is within radius', () => {
    // ~50m away
    const coords = { latitude: 31.5206, longitude: 74.3589 };
    expect(isWithinGeofence(coords, eventGeofence)).toBe(true);
  });

  test('returns false when volunteer is outside radius', () => {
    // ~5km away
    const coords = { latitude: 31.5650, longitude: 74.3587 };
    expect(isWithinGeofence(coords, eventGeofence)).toBe(false);
  });

  test('returns true when volunteer is exactly at event center', () => {
    const coords = { latitude: 31.5204, longitude: 74.3587 };
    expect(isWithinGeofence(coords, eventGeofence)).toBe(true);
  });

  test('getDistanceMeters returns approximate distance', () => {
    const from = { latitude: 31.5204, longitude: 74.3587 };
    const to = { latitude: 31.5214, longitude: 74.3587 };
    const distance = getDistanceMeters(from, to);
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(150);
  });
});
