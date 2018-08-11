import AbacApe from '../dist/index';

describe('initializing AbacApe', () => {
  class Human {
    constructor(id, first_name, last_name, age) {
      this.id = id;
      this.first_name = first_name;
      this.last_name = last_name;
      this.age = age;
      this.pets = [];
    }
  }

  class Animal {
    constructor(id, name, type, gender) {
      this.id = id;
      this.name = name;
      this.type = type;
      this.gender = gender;
    }
  }
  describe('createPolicy', () => {
    let abac;
    beforeEach(() => {
      const ABAC = new AbacApe();
      ABAC.createPolicy({
        subject: Human,
        action: 'cuddle',
        resource: Animal,
        policy: function(subject, resource, environment) {
          if(subject.pets.includes(resource)) {
            return {result: true, errors:[]}
          } else {
            return {result: false, errors:[new Error('Subject does not own resource')]}
          }
        }
      })
      abac = ABAC;
    })
    test('will index subject in policies', () => {
      expect(abac.policies.hasOwnProperty('Human')).toBeTruthy();
    });
    test('will index action in policies[Subject]', () => {
      expect(abac.policies['Human'].hasOwnProperty('cuddle')).toBeTruthy();
    });
    test('will index resource in policies[Subject][Action]', () => {
      expect(abac.policies['Human']['cuddle'].hasOwnProperty('Animal')).toBeTruthy();
    });
    test('will index policy function in policies[Subject][Action][Resource]', () => {
      expect(abac.policies['Human']['cuddle']['Animal']).toBeDefined();
    })
  })
})