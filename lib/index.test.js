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
    let policy_function = function(subject, resource, environment) {
      if(subject.pets.includes(resource)) {
        return {result: true, errors:[]}
      } else {
        return {result: false, errors:[new Error('Subject does not own resource')]}
      }
    };
    beforeEach(() => {
      abac = new AbacApe();
      abac.createPolicy({
        subject: Human,
        action: ACTION,
        resource: Animal,
        policy: policy_function
      });
    });
    test('will index subject in policies', () => {
      expect(abac.policies).toHaveProperty('Human');
    });
    test('will index action in policies[Subject]', () => {
      expect(abac.policies).toHaveProperty(`Human.${ACTION}`);
    });
    test('will index resource in policies[Subject][Action]', () => {
      expect(abac.policies).toHaveProperty(`Human.${ACTION}.Animal`);
    });
    test('policies[Subject][Action][Resource] will be policy function', () => {
      expect(abac.policies).toHaveProperty(`Human.${ACTION}.Animal`, policy_function);
    })
  });

  describe('addConditions', () => {
    let abac;
    const CONDITION_ONE_NAME = 'sameId';
    const CONDITION_TWO_NAME = 'animalIsDog';
    const CONDITION_THREE_NAME = 'animalIsMale';
    beforeEach(() => {
      abac = new AbacApe();
      abac.createCondition({
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
      expect(abac.conditions).toHaveProperty('Human');
    });
    test('will index resouce in conditions[Human]', () => {
      expect(abac.conditions).toHaveProperty('Human.Animal');
    });
    test('will index conditions in conditions[Human][Animal]', () => {
      expect(abac.conditions).toHaveProperty(`Human.Animal.${CONDITION_ONE_NAME}`)
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
      expect(abac.conditions).toHaveProperty(`Human.Animal.${CONDITION_TWO_NAME}`);
      expect(abac.conditions).toHaveProperty(`Human.Animal.${CONDITION_THREE_NAME}`);
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