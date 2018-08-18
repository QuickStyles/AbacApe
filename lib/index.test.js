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
    const CONDITION_NAME_ONE = 'sameId';
    const CONDITION_NAME_TWO = 'animalIsTypeDog';
    let abac;
    let conditions = [CONDITION_NAME_ONE, CONDITION_NAME_TWO]
    beforeEach(() => {
      abac = new AbacApe();
      abac.createCondition({
        subject:Human,
        resource:Animal,
        condition:{
          sameId:(subject, resource, environment) => {
            return subject.id === resource.id ? true : new Error('Human_id_does_not_match_resource_id');
          },
          animalIsTypeDog:(subject, resource, environment) => {
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
    });
    describe('given nonexistent conditions',() => {
      test('will throw condition does not exist error', () => {
        const NONEXISTENT_CONDITION_ONE = 'nonexistent_condition';
        expect(
          function() {
            abac.createPolicy({
              subject:Human,
              action:'fight',
              resource:Alien,
              condition:[NONEXISTENT_CONDITION_ONE]
            });
          }
        ).toThrow();
      });
    });
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
    test('will index resource in conditions[Human]', () => {
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
        expect(
          function() {
            abac.createCondition({
            subject: Human,
            resource: Animal,
            environment: {},
            condition: {
              CONDITION_ONE_NAME: (subject, resource, environment) => {
                return subject.first_name === 'bob';
              }
            }})
          }
        ).toThrow();
      });
    });
  })
});

describe('AbacApe Helper Functions', () => {
  let abac;
  beforeEach(() => {
    abac = new AbacApe();
  });
  describe('_normalizeTree', () => {
    const STRING = 'string';
    const VALID_OBJECT = {name:'hi'};
    test('will index array of mixed types including constructors, strings, and objects', () =>{
      abac._normalizeTree(abac.conditions, [STRING, VALID_OBJECT, Human, Animal]);
      abac._normalizeTree(abac.policies, [STRING, VALID_OBJECT, Human, Animal]);
      expect(abac.conditions).toHaveProperty(`${STRING}.${VALID_OBJECT.name}.Human.Animal`);
      expect(abac.policies).toHaveProperty(`${STRING}.${VALID_OBJECT.name}.Human.Animal`);
    })
  });
  describe('_checkForNode', () => {
    const TREE = {first:{second:{}}};
    const VALID_FIRST_NODE = 'first';
    const VALID_SECOND_NODE = 'second';
    const VALID_FIRST_NODE_CONSTRUCTOR = class first {};
    const INVALID_SECOND_NODE = 'invalid';
    const INVALID_SECOND_NODE_CONSTRUCTOR = class InvalidSecondNode {};
    test('will return true if node exists', () => {
      expect(abac._checkForNode(TREE, [VALID_FIRST_NODE_CONSTRUCTOR, VALID_SECOND_NODE])).toBe(true);
      expect(abac._checkForNode(TREE, [VALID_FIRST_NODE, VALID_SECOND_NODE])).toBe(true);
    });
    test('will return false if node does not exist', () => {
      expect(abac._checkForNode(TREE, [VALID_FIRST_NODE, INVALID_SECOND_NODE])).toBe(false);
      expect(abac._checkForNode(TREE, [VALID_FIRST_NODE, INVALID_SECOND_NODE_CONSTRUCTOR])).toBe(false);
    })
  })
});

describe('AbacApe at runtime', () => {
  let abac;
  const CONDITION_NAME_ONE = 'hasSameId';
  const CONDITION_NAME_TWO = 'humanOwnsAnimal';
  const CONDITION_NAME_THREE = 'animalIsNotEndangeredSpecies';
  const CONDITION_ERROR_ONE = new Error('animal_is_an_endangered_species');
  const CONDITION_ERROR_TWO = new Error('id_do_not_match');
  beforeEach(() => {
    abac = new AbacApe();
    abac.createCondition({
      subject:Human,
      resource:Animal,
      environment: {},
      condition: {
        hasSameId: function(subject, resource, environment) {
          if (subject.id === resource.id) {
            return {result: true, error:null};
          } else {
            return {result: false, error: CONDITION_ERROR_TWO};
          }
        },
        humanOwnsAnimal: function(subject, resource, environment) {
          if (subject.pets.includes(resource)) {
            return {result: true, error:null};
          } else {
            return {result: false, error: new Error('human_does_not_own_animal')};
          }
        },
        animalIsNotEndangeredSpecies: function(subject, resource, environment) {
          if (!['tiger', 'blue whale', 'sea otter', 'snow leopard'].includes(resource.type)) {
            return {result:true, error:null};
          } else {
            return {result: false, error: CONDITION_ERROR_ONE}
          }
        }
      }
    });
    abac.createPolicy({
      subject:Human,
      action:['feed', 'pet'],
      resource:Animal,
      conditions:[CONDITION_NAME_TWO]
    });
    abac.createPolicy({
      subject:Human,
      action: 'adopt',
      resource: Animal,
      conditions:[CONDITION_NAME_THREE]
    });
    abac.createPolicy({
      subject:Human,
      action: 'steal',
      resource: Animal,
      conditions: [CONDITION_NAME_ONE, CONDITION_NAME_THREE]
    });
  })
  describe('checkPolicy', () => {
    let human_instance;
    let animal_instance;
    beforeAll(() => {
      human_instance = new Human(1, 'bobby', 'lee', 23);
      animal_instance = new Animal(1, 'winston', 'dog', 'male');
      human_instance.pets.push(animal_instance);
    });
    describe('given passing subject/action/resource/environment', () => {
      test('will return true', () => {
        expect(abac.checkPolicy(human_instance, animal_instance, 'feed', {})).toBe(true);
        expect(abac.checkPolicy(human_instance, animal_instance, 'pet', {})).toBe(true);
      })
    });
    describe('given failing subject/action/resource/environemnt', () => {
      beforeAll(() => {
        // change instances so policies will not pass
        human_instance = new Human(2, 'kanye', 'west', 30);
        animal_instance = new Animal(1, 'south', 'tiger', 'female');
      });
      test('will return errors array', () => {
        expect(abac.checkPolicy(human_instance, animal_instance, 'adopt', {})).toMatchObject([CONDITION_ERROR_ONE]);
      });
      test('will return all errors if there are multiple', () => {
        expect(abac.checkPolicy(human_instance, animal_instance, 'steal', {})).toMatchObject([CONDITION_ERROR_TWO, CONDITION_ERROR_ONE]);
      });
      test('will return errors even if some conditions pass', () => {
        // change id so it will pass CONDITION_ERROR_ONE
        human_instance.id = 1;
        expect(abac.checkPolicy(human_instance, animal_instance, 'steal', {})).toMatchObject([CONDITION_ERROR_ONE]);
      })
    });
    describe(`given a nonexistent policy`, () => {
      test(`will return a policy_does_not_exist error`, () => {
        expect(
          function() {
            abac.checkPolicy(human_instance, animal_instance, 'non_existant_action', {})
          }
        ).toThrowError(/policy.*does.*not.*exist/);
        // TODO: needs better regex add subject action resource
      })
    });
  });
})