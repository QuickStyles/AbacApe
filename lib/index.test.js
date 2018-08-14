import AbacApe from '../dist/index';
const ACTION = 'cuddle';
describe('initializing AbacApe', () => {
  afterAll(() => {
    console.log('if tests are failing try running tsc. tests import from the compiled files')
  })
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
      abac = new AbacApe();
      abac.createPolicy({
        subject: Human,
        action: ACTION,
        resource: Animal,
        policy: function(subject, resource, environment) {
          if(subject.pets.includes(resource)) {
            return {result: true, errors:[]}
          } else {
            return {result: false, errors:[new Error('Subject does not own resource')]}
          }
        }
      });
    });
    test('will index subject in policies', () => {
      expect(abac.policies.hasOwnProperty('Human')).toBeTruthy();
    });
    test('will index action in policies[Subject]', () => {
      expect(abac.policies['Human'].hasOwnProperty(ACTION)).toBeTruthy();
    });
    test('will index resource in policies[Subject][Action]', () => {
      expect(abac.policies['Human'][ACTION].hasOwnProperty('Animal')).toBeTruthy();
    });
    test('will index policy function in policies[Subject][Action][Resource]', () => {
      expect(abac.policies['Human'][ACTION]['Animal']).toBeDefined();
    })
  });

  describe('addConditions', () => {
    let abac;
    const CONDITION_ONE_NAME = 'sameId';
    const CONDITION_TWO_NAME = 'animalIsDog';
    const CONDITION_THREE_NAME = 'animalIsMale';
    beforeEach(() => {
      abac = new AbacApe();
      abac.addCondition({
        subject: Human,
        resource: Animal,
        environment: {},
        conditions: {
          CONDITION_ONE_NAME: (subject, resource, environment) => {
            return subject.id === resource.id;
          }
        }
      });
    });
    test('will index subject in conditions', () => {
      expect(abac.conditions.hasOwnProperty('Human')).toBeTruthy();
    });
    test('will index resouce in conditions[Human]', () => {
      expect(abac.conditions['Human'].hasOwnProperty('Animal')).toBeTruthy();
    });
    test('will index conditions in conditions[Human][Animal]', () => {
      expect(abac.conditions['Human']['Animal'].hasOwnProperty(CONDITION_ONE_NAME)).toBeTruthy();
    });
    test('will be able to add multiple conditions', () => {
      abac.addCondition({
        subject: Human,
        resource: Animal,
        environment: {},
        conditions: {
          CONDITION_TWO_NAME: (subject, resource, environment) => {
            return resource.type === 'dog';
          },
          CONDITION_THREE_NAME: (subject, resource, environment) => {
            return resource.gender === 'male';
          }
        }
      });
      expect(abac.conditions['Human']['Animal'].hasOwnProperty(CONDITION_TWO_NAME)).toBeTruthy();
      expect(abac.conditions['Human']['Animal'].hasOwnProperty(CONDITION_THREE_NAME)).toBeTruthy();
    });
    describe('adding existing condition', () => {
      test('will throw error', () => {
        expect(abac.addCondition({
          subject: Human,
          resource: Animal,
          environment: {},
          conditions: {
            CONDITION_ONE_NAME: (subject, resource, environment) => {
              return subject.first_name === 'bob';
            }
          }
        })).toThrow();
      });
    });
  })
})