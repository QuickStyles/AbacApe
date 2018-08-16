import AbacApe from '../dist/index';
const ACTION = 'cuddle';

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

class Alien {
  constructor(id, name, color, origin) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.origin = origin;
  }
}

describe('initializing AbacApe', () => {
  describe('createPolicy', () => {
    const CONDITION_NAME_ONE = 'sameID';
    const CONDITION_NAME_TWO = 'animalIsTypeDog';
    let abac;
    let conditions = [CONDITION_NAME_ONE, CONDITION_NAME_TWO]
    beforeEach(() => {
      abac = new AbacApe();
      abac.createCondition({
        subject:Human,
        resource:Animal,
        condition:{
          sameId:(subject, resouce, environment) => {
            return subject.id === resouce.id ? true : new Error('Human_id_does_not_match_resource_id');
          },
          animalIsTypeDog:(subject, resouce, environment) => {
            return resource.type === 'dog';
          }
        }
      })
      abac.createPolicy({
        subject: Human,
        action: ACTION,
        resource: Animal,
        conditions: conditions
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
    test('policies[Subject][Action][Resource] will be array of condition names', () => {
      expect(abac.policies['Human'][`${ACTION}`]['Animal']).toContain(CONDITION_NAME_ONE);
      expect(abac.policies['Human'][`${ACTION}`]['Animal']).toContain(CONDITION_NAME_TWO);
    })
  });

  describe('createConditions', () => {
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
        condition: {
          sameId: (subject, resource, environment) => {
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
      abac.createCondition({
        subject: Alien,
        resource: Animal,
        environment: {},
        condition: {
          animalIsDog: (subject, resource, environment) => {
            return resource.type === 'dog';
          },
          animalIsMale: (subject, resource, environment) => {
            return resource.gender === 'male';
          }
        }
      });
      expect(abac.conditions).toHaveProperty(`Alien.Animal.${CONDITION_TWO_NAME}`);
      expect(abac.conditions).toHaveProperty(`Alien.Animal.${CONDITION_THREE_NAME}`);
    });
    describe('adding existing condition', () => {
      test('will throw error', () => {
        expect(abac.createCondition({
          subject: Human,
          resource: Animal,
          environment: {},
          condition: {
            CONDITION_ONE_NAME: (subject, resource, environment) => {
              return subject.first_name === 'bob';
            }
          }
        })).toThrow();
      });
    });
  })
});

describe('AbacApe._normalizeTree', () => {
  let abac;
  const STRING = 'string';
  const VALID_OBJECT = {name:'hi'};
  beforeEach(() => {
    abac = new AbacApe();
  });
  test('will index array of mixed types including constructors, strings, and objects', () =>{
    abac._normalizeTree(abac.conditions, [STRING, VALID_OBJECT, Human, Animal]);
    abac._normalizeTree(abac.policies, [STRING, VALID_OBJECT, Human, Animal]);
    expect(abac.conditions).toHaveProperty(`${STRING}.${VALID_OBJECT.name}.Human.Animal`);
    expect(abac.policies).toHaveProperty(`${STRING}.${VALID_OBJECT.name}.Human.Animal`);
  })
});