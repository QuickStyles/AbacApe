import AbacApe, { ConditionObject, SubjectResourceConditionsHash } from '../dist/index';
class Primate {
  id: number;
  first_name: string;
  age: number;
  species: string;
  favorite_food: string;
  hungry_level: number;
  on_diet: boolean;
  constructor(id:number, first_name:string, age:number, species:string) {
    this.id = id;
    this.first_name = first_name;
    this.age = age;
    this.species = species;
    this.favorite_food = 'banana';
    this.hungry_level = 500;
    this.on_diet = false;
  }

}

class Food {
  name: string;
  calories: number;
  color: string;
  constructor(name:string, calories:number, color:string) {
    this.name = name;
    this.calories = calories;
    this.color = color;
  }
}

class Human {
  id: number;
  first_name:string;
  last_name:string;
  gender:string;
  is_picky_eater: boolean;
  favorite_food: string;
  is_on_diet: boolean;
  constructor(id:number, first_name:string, last_name:string, gender:string) {
    this.id = id;
    this.first_name = first_name;
    this.last_name = last_name;
    this.gender = gender;
    this.is_picky_eater = false;
    this.favorite_food = 'cheesecake';
    this.is_on_diet = false;
  }
}

function Alien(id, color, home_planet) {
  this.id = id;
  this.color = color;
  this.home_planet = home_planet;
  return this;
}

const Animal = function(id, species) {
  this.id = id;
  this.species = species;
  return this;
}

const environment = {};

const conditions_hash = function() :SubjectResourceConditionsHash<Primate,Food>{
  return {
    isPrimateFavoriteFood: {
      fn:(primate, food, environment) => {
        return primate.favorite_food === food.name;
      },
      err_msg: 'is not favorite food!'
    },
    foodLooksEdible: {
      fn:(primate, food, environment) => {
        return !['black, green'].includes(food.color);
      },
      err_msg: 'food does not look edible!'
    },
    isPrimateHungry: {
      fn:(primate, food, environment) => {
        return primate.hungry_level < 1000;
      },
      err_msg: 'primate is not hungry!'
    },
    isPrimateOnDiet: {
      fn:(primate, food, environment) => {
        return primate.on_diet;
      },
      err_msg: 'primate is on diet!'
    },
    foodHasTooManyCalories: {
      fn:(primate, food, environment) => {
        return food.calories > 800;
      },
      err_msg: 'food has too many calories!'
    },
    isDinnerTime:{
      fn:(primate, food, environment) => {
        return environment.time === 17;
      },
      err_msg: 'it is not dinner time!'
    }
  }
}

describe('initializing AbacApe', () => {
  let AA:AbacApe;
  beforeEach(() =>{
    AA = new AbacApe();
  });
  describe('init', () => {
    describe('given valid constructor', () => {
      test('returns object with createConditionsFor and createPolicyFor methods', () => {
        const PrimateAA = AA.init(Primate);
        const AlienAA = AA.init(Alien);
        const AnimalAA = AA.init(Animal);

        expect(PrimateAA).toHaveProperty('createConditionsFor');
        expect(typeof PrimateAA.createConditionsFor).toBe('function');
        expect(PrimateAA).toHaveProperty('createPolicyFor');
        expect(typeof PrimateAA.createPolicyFor).toBe('function');

        expect(AlienAA).toHaveProperty('createConditionsFor');
        expect(typeof AlienAA.createConditionsFor).toBe('function');
        expect(AlienAA).toHaveProperty('createPolicyFor');
        expect(typeof AlienAA.createPolicyFor).toBe('function');

        expect(AnimalAA).toHaveProperty('createConditionsFor');
        expect(typeof AnimalAA.createConditionsFor).toBe('function');
        expect(AnimalAA).toHaveProperty('createPolicyFor');
        expect(typeof AnimalAA.createPolicyFor).toBe('function');

      })
    });
    describe('given invalid objects',() => {
      test('throws error', () => {
        const invalid_objects = [[], <any>'', <any>1, undefined, null, () => {}];
        const invalid_objects2 = [Object, String, Array, Number, Symbol, Date, Boolean, Function];
        invalid_objects.forEach(o => {
          expect(() => AA.init(o)).toThrow();
        });
        invalid_objects2.forEach(o => {
          expect(()=> AA.init(o)).toThrow();
        })
      })
    })
  });
  describe('createConditionsFor', () => {
    describe('given valid parameters', () => {
      test('indexes conditions object on AbacApe[conditions][Subject][Resource]', () => {
        const PrimateAA = AA.init(Primate);
        const valid_conditions_hash = conditions_hash();
        PrimateAA.createConditionsFor(Food, environment, valid_conditions_hash);
        expect(AA.conditions['Primate']['Food']).toMatchObject(valid_conditions_hash);
      })
    });
    
    describe('given invalid parameters', () => {
      test('invalid resource will throw error', () =>{
        const PrimateAA = AA.init(Primate);
        const invalid_resource = [[], <any>'', <any>1, undefined, null, () => {}];
        const invalid_resource2 = [Object, String, Array, Number, Symbol, Date, Boolean, Function];
        invalid_resource.forEach(resource => {
          expect(() => PrimateAA.createConditionsFor(resource, environment, conditions_hash())).toThrow();
        });
        invalid_resource2.forEach(resource => {
          expect(()=> PrimateAA.createConditionsFor(resource, environment, conditions_hash())).toThrow();
        })
      });

      describe('given invalid conditions_object', () => {
        test('invalid err_msg will throw error', () => {
          const PrimateAA = AA.init(Primate);
          const invalid_err_msg = [1, {}, [], undefined, null, NaN];
          invalid_err_msg.forEach(err_msg => {
            const invalid_conditions_hash:SubjectResourceConditionsHash<Primate, Food> = conditions_hash();
            invalid_conditions_hash.isPrimateFavoriteFood.err_msg = <any>err_msg;
            expect(() => {PrimateAA.createConditionsFor(Food, environment, invalid_conditions_hash)}).toThrow();
          });
        });
        test('invalid fn will throw error', () => {
          const PrimateAA = AA.init(Primate);
          const invalid_fn = [1, {}, [], '', undefined, null, NaN];
          invalid_fn.forEach(fn => {
            const invalid_conditions_hash:SubjectResourceConditionsHash<Primate, Food> = conditions_hash();
            invalid_conditions_hash.isPrimateFavoriteFood.fn = <any>fn;
            expect(() => {PrimateAA.createConditionsFor(Food, environment, invalid_conditions_hash)}).toThrow();
          })
        });
        test('extra properties will throw error', () => {
          const PrimateAA = AA.init(Primate);
          const invalid_conditions_hash:any = conditions_hash();
          invalid_conditions_hash.isPrimateFavoriteFood.extra_property = 'i_should_not_exist';
          expect(() => {PrimateAA.createConditionsFor(Food, environment, invalid_conditions_hash)}).toThrow();
        });
      })
    })
  });
});