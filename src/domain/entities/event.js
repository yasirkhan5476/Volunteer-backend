'use strict';

/**
 * Event Entity — represents a volunteer event with geofence data.
 */
class EventEntity {
  constructor({
    id,
    title,
    description,
    organizationId,
    createdById,
    latitude,
    longitude,
    radiusMeters,
    address,
    startTime,
    endTime,
    maxVolunteers,
    isActive,
    createdAt,
  }) {
    this.id = id;
    this.title = title;
    this.description = description || null;
    this.organizationId = organizationId;
    this.createdById = createdById;
    this.latitude = latitude;
    this.longitude = longitude;
    this.radiusMeters = radiusMeters;
    this.address = address || null;
    this.startTime = new Date(startTime);
    this.endTime = new Date(endTime);
    this.maxVolunteers = maxVolunteers || null;
    this.isActive = isActive;
    this.createdAt = createdAt;
  }

  isOngoing() {
    const now = new Date();
    return now >= this.startTime && now <= this.endTime;
  }

  hasEnded() {
    return new Date() > this.endTime;
  }

  isUpcoming() {
    return new Date() < this.startTime;
  }

  /** @returns {{ latitude: number, longitude: number, radiusMeters: number }} */
  getGeofence() {
    return {
      latitude: this.latitude,
      longitude: this.longitude,
      radiusMeters: this.radiusMeters,
    };
  }
}

module.exports = { EventEntity };
