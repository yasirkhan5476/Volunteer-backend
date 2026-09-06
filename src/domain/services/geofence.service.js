'use strict';

const { isPointWithinRadius } = require('geolib');

/**
 * Domain service: Geofence radius check using geolib.
 *
 * Determines if a given coordinate is within the geofence
 * of an event (center + radius).
 */

/**
 * Check whether a volunteer's location is within an event's geofence.
 *
 * @param {{ latitude: number, longitude: number }} volunteerCoords - Volunteer's GPS position
 * @param {{ latitude: number, longitude: number, radiusMeters: number }} eventGeofence - Event geofence
 * @returns {boolean} true if within radius
 */
function isWithinGeofence(volunteerCoords, eventGeofence) {
  return isPointWithinRadius(
    { latitude: volunteerCoords.latitude, longitude: volunteerCoords.longitude },
    { latitude: eventGeofence.latitude, longitude: eventGeofence.longitude },
    eventGeofence.radiusMeters
  );
}

/**
 * Calculate the distance in meters between two coordinates.
 *
 * @param {{ latitude: number, longitude: number }} from
 * @param {{ latitude: number, longitude: number }} to
 * @returns {number} distance in meters
 */
function getDistanceMeters(from, to) {
  const { getDistance } = require('geolib');
  return getDistance(from, to);
}

module.exports = { isWithinGeofence, getDistanceMeters };
