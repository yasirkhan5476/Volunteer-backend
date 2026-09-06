'use strict';

/**
 * User Entity — pure JS object representing the User domain model.
 * No framework dependencies.
 */
class UserEntity {
  constructor({ id, email, firstName, lastName, phone, role, isVerified, isActive, createdAt }) {
    this.id = id;
    this.email = email;
    this.firstName = firstName;
    this.lastName = lastName;
    this.phone = phone || null;
    this.role = role;
    this.isVerified = isVerified;
    this.isActive = isActive;
    this.createdAt = createdAt;
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  isAdmin() {
    return this.role === 'ADMIN' || this.role === 'SUPER_ADMIN';
  }

  isOrganizer() {
    return this.role === 'ORGANIZER' || this.role === 'ADMIN' || this.role === 'SUPER_ADMIN';
  }

  isVolunteer() {
    return this.role === 'VOLUNTEER';
  }

  /**
   * Returns a safe public representation (no password hash).
   */
  toPublic() {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.fullName,
      phone: this.phone,
      role: this.role,
      isVerified: this.isVerified,
      createdAt: this.createdAt,
    };
  }
}

module.exports = { UserEntity };
