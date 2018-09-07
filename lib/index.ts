function validSubject<TS>(subject:Constructor<TS>|AnyObject) {
  return typeof subject === 'object' || typeof subject === 'function';
};

function validResource<TR>(resource:Constructor<TR>|AnyObject) {
  return typeof resource === 'object' || typeof resource === 'function';
};

function shiftNodeFromArray(nodes:(Constructor<{[any:string]:any}> | string | AnyObject)[]) {
  nodes.shift();
  return nodes;
};

function isPlainObject(obj:object) {
  return obj === Object(obj) && !Array.isArray(obj) && typeof obj !== 'function';
};

function getNameFrom(node:Constructor<AnyObject> | string | AnyObject):string {
  if (typeof node !== 'string') {
    return node.name;
  } else {
    return node;
  }
}

interface PolicyConditionsHash {
  // less than ideal workaround:
  // this dictionary has key 'errors' equal to an array of errors.
  // unable to specify this key without typescript complaining
  [key:string]: ((...sre:SRE<any,any>) => boolean) | string[];
  // errors: Error[];
}

function createPolicyFunctionFactory(policy_function:(conditions:PolicyConditionsHash) => true | Error[], condition_map:SubjectResourceConditionsHash) {
  return function(subject:Subject<any>, resource:Resource<any>, environemnt:any) {
    const sre = [subject, resource, environemnt];
    const available_conditions = generateAvailableConditionsForPolicy(condition_map, ...sre);
    return policy_function(available_conditions);
  }
}

function generateAvailableConditionsForPolicy(conditions_hash:any, ...sre:any[]) {
  // TODO: add type
  let condition_functions:any = {
    errors: []
  };
  condition_functions.errors = [];
  Object.keys(conditions_hash).map((key) => {
    condition_functions[key] = function() {
      if (conditions_hash[key].fn(...sre)) {
        return true;
      } else {
        condition_functions.errors.push(conditions_hash[key].err_msg);
        return false;
      }
    }
  });
  
  return condition_functions;
}
interface PoliciesTree {
  [key:string]: {
    [key:string]: {
      [key:string]: (...sre:SRE<any,any>) => true | Error[];
    }
  }
}

type Subject<T> = AnyObject | Constructor<T>;
type Resource<T> = AnyObject | Constructor<T>;
type SRE<SubjectType, ResourceType> = [Subject<SubjectType>, Resource<ResourceType>, AnyObject];
export default class AbacApe {
  policies: PoliciesTree;
  conditions: ConditionsTree;
  constructor() {
    this.policies = {};
    this.conditions = {};
  }

  /**
   * 
   * @param subject
   * @returns Contains createConditionsFor method and createPolicyFor method
   */
  init<TS>(subject:Constructor<TS> | AnyObject) {
    return {
      /**
       * @param resource
       * @param environemnt
       * @param conditions
       * 
       * @example
       * const HumanAbac = init(Human)
       * HumanAbac.createConditionsFor(Animal, Environment, {
       *  isOwner: {
       *    fn: (subject, resource, environment) {
       *      return subject.pets.includes(resource) // must return boolean value
       *    }
       *    err_msg: `${subject.name} does not own ${resource.name}` // must return string value
       *  }
       * })
       * @example
       */
      createConditionsFor: <TR>(resource:Constructor<TR>, environemnt:any, conditions:SubjectResourceConditionsHash) => {
        this.createCondition({
          subject:subject,
          resource:resource,
          environment: environemnt,
          condition:conditions
        });
      },
      /**
       * @param action
       * @param resource
       * @param environemnt
       * 
       * @example
       * 
       * const HumanAbac = init(Human)
       * const HumanAnimalPolicyCreator = HumanAbac.createPolicyFor(Animal)
       * 
       * HumanAnimalPolicyCreator.action('pet', (conditions) => {
       *   return conditions.isOwner() && conditions.animalIsAlive()
       * })
       * @example
       * 
       * @example
       * 
       * const HumanAbac = init(Human)
       * const HumanAnimalPolicyCreator = HumanAbac.createPolicyFor(Animal)
       * 
       * HumanAnimalPolicyCreator.action('pet', (conditions) => {
       *   if(conditions.isOwner() && conditions.animalIsAlive()) {
       *     return true
       *   } else {
       *     return conditions.errors
       *   }
       * })
       * @example
       */
      createPolicyFor: <TR>(resource: Constructor<TR>, environemnt:any) => {
        const conditions_hash = this.conditions[subject.name][resource.name]; // object of functions that take in subject, resource, environment
        return {
          action: (action: string | string[], policy_function: (conditions:any) => true|Error[]) => {
            if (typeof action === 'string') {
              this._createPolicy(subject, action, resource, environemnt, createPolicyFunctionFactory(policy_function, conditions_hash));
            } else {
              for (let i = 0; i < action.length; i++) {
                this._createPolicy(subject, action[i], resource, environemnt, createPolicyFunctionFactory(policy_function, conditions_hash));
              }
            }
          }
        }
      }
    }
  }

  private _createPolicy(subject:any, action:string, resource:any, environemnt:any, policy_function:any) {
    this._normalizeTree(this.policies, [subject, action]);
    if (!this._checkForNode(this.policies, [subject, action, resource])) {
      let subject_action = this._getNode(this.policies, [subject, action]);
      if (subject_action) {
        // subject_action[resource.name] = policy_function;
        subject_action[resource.name] = function(subject:any, action:any, resource:any) {
          if (policy_function(...[subject, action, resource])) {
            return true;
          } else {
            
          }
        }
      }
    } else {
      throw new Error(`policy already exists for subject: ${subject.name} -> action: ${action} -> resource: ${resource.name}`);
    }
  }

  private _equate(sre:SRE<any,any>, ...conditions: ConditionFunction<any, any>[]) {
    let errors = [];
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i](...sre);
      if (condition !== true) {
        errors.push(condition);
      }
    }
    if (errors.length > 0) {
      return errors
    } else {
      return true;
    }
  }

  private _checkForConditions(tree:AbacApe['conditions'], nodes:(Constructor<AnyObject> | string | AnyObject)[], conditions_array:(keyof AbacApe['conditions'][any][any])[]) {
    const condition_map = this._getNode(tree, nodes);
    let all_conditions_are_present = true;
    // switch flag to false if condition map does not have condition or if condition map does not exist;
    for (let i = 0; i < conditions_array.length; i++) {
      const condition = conditions_array[i];
      if (condition_map) {
        if (!condition_map.hasOwnProperty(condition)) {
          all_conditions_are_present = false;
        }
      } else {
        all_conditions_are_present = false;
      }
    }
    return all_conditions_are_present;
  };

  createCondition<TS, TR>({subject, resource, environment, condition}:CreateCondtionOptions<TS,TR>) {
    if(!validSubject(subject)) {
      throw new TypeError(`Expected subject to be constructor or plain object, got ${typeof subject}`);
    };
    if(!validResource(resource)) {
      throw new TypeError(`Expected resource to be constructor or plain object, got ${typeof resource}`);
    }

    /**
     * Throw error if condition object already exists.
     * Note: if condition already exists it will be frozen.
     */
    if (this._checkForNode(this.conditions, [subject.name, resource.name])) {
      throw Error(`conditions already exists for subject:${subject.name} | resource:${resource.name}`);
    }

    for (const key in condition) {
      if (condition.hasOwnProperty(key)) {
        const statement = condition[key];
        this._addCondition(subject, resource, environment, key, statement);
      }
    }
    /**
     * createConditions will only create conditions for the [Subject][Resource] once.
     */
    Object.freeze(this.conditions[subject.name][resource.name]);
  }

  private _addCondition<TS, TR>(subject:Constructor<TS> | AnyObject, resource:Constructor<TR> | AnyObject, environment:any, condition_name:string, condition_object:ConditionObject) :void {
    this._normalizeTree(this.conditions,[subject, resource]);
    console.log(condition_object)
    this.conditions[subject.name][resource.name][condition_name] = condition_object;
  }

  /**
   * Will create nodes path if it doesn't already exist
   * 
   * @param tree
   * @param nodes 
   */
  private _normalizeTree(tree:AnyObject, nodes:(Constructor<AnyObject> | string | AnyObject)[]) :void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const node_name = getNameFrom(node);
      if (tree.hasOwnProperty(node_name)) {
        this._normalizeTree(tree[node_name], shiftNodeFromArray(nodes))
      } else {
        tree[node_name] = {};
        this._normalizeTree(tree[node_name], shiftNodeFromArray(nodes))
      }
    }
  }

  /**
   * If tree contains nodes path return true
   * 
   * @param tree 
   * @param nodes 
   */
  private _checkForNode(tree:AnyObject, nodes:(Constructor<AnyObject> | string | AnyObject)[]):boolean {
    if (this._getNode(tree, nodes)) {
      return true;
    } else {
      return false;
    }
  }

  private _getNode(tree:AnyObject, nodes:(Constructor<AnyObject>| string | AnyObject)[]) :AnyObject|undefined {
    for (let i = 0; i < nodes.length; i++) {
      let node_name;
      const node = nodes[i];
      node_name = getNameFrom(node);
      if (tree.hasOwnProperty(node_name)) {
        if (nodes.length - 1 > 0) {
          return this._getNode(tree[node_name], shiftNodeFromArray(nodes));
        } else {
          return tree[node_name];
        }
      }
    }
  }

  _getPolicy<TS,TR>(subject:Constructor<TS> | AnyObject, action:string, resource:Constructor<TR> | AnyObject) {
    try {
      return this.policies[subject.constructor.name][action][resource.constructor.name];
    } catch (error) {
      throw new Error(`policy ${subject.constructor.name} -> ${action} -> ${resource.constructor.name} does not exist`);
    }
  }

  _getConditions<TS,TR>(subject: Constructor<TS> | AnyObject, resource: Constructor<TR> | AnyObject) {
    try {
      return this.conditions[subject.constructor.name][resource.constructor.name];
    } catch (error) {
      throw new Error(`condtions for subject:${subject.constructor.name} -> resource:${resource.constructor.name} does not exist`);
    }
  }
  printPolicies() {
    console.dir(this.policies);
  }

}

// types

interface CreateCondtionOptions<TSubject, TResource> {
  subject: Constructor<TSubject> | AnyObject;
  resource: Constructor<TResource> | AnyObject;
  environment: any;
  condition: SubjectResourceConditionsHash
}

type ConditionFunction<TS,TR> = (subject: InstanceType<Constructor<TS>>, resource: InstanceType<Constructor<TR>>, environment:any) => ConditionResultsObject

interface CreatePolicyOptions<TSubject, TResource> {
  /**
   * Used to index the constructor of the subject.
   * The subject parameter in the policy function must be an instance of this Object/Constructor
   */
  subject: Constructor<TSubject> | AnyObject;
  /**
   * Name of action being performed.
   */
  action: string | string[];
  /**
   * Used to index the constructor of the resource.
   * The resource parameter in the policy function must be an instance of this Object/Constructor
   */
  resource: Constructor<TResource> | AnyObject;
  /**
   * Additional data used to judge the policy.
   */
  environment?: any;

  /**
   * Array of condition names used to judge policy.
   */
  // conditions: (keyof AbacApe['conditions'][any][any])[];
  condition: () => true | Error[];
}

type AnyObject = {[any:string]: any};

// type ConditionResultsObject = true | IT<Error>;
type ConditionResultsObject = any;

type Constructor<TClass> = new(...args:any[]) => TClass;

type IT<T> = InstanceType<Constructor<T>>;

type ConditionsTree = {
  //Subject
  [key:string]: {
    //Resource
    [key:string]: {
      //Condition Name
      [key:string]: ConditionObject
    }
  }
}

type PolicyMap = {
  //Subject
  [key:string]: {
    //Action
    [key:string]: {
      //Resource
      [key:string]:  (keyof AbacApe['conditions'][any][any])[];
    }
  }
}

type SubjectResourceConditionsHash = {
  [key:string]: ConditionObject
}
type ConditionObject = {
  err_msg: string,
  fn: ConditionFunction<any,any>
}

type AddPolicyOptions<TS,TR> = {
  subject: Constructor<TS> | AnyObject
  action: string | string[]
  resource: Constructor<TR> | AnyObject
  environment: any
  policy_fn: (...sre:SRE<any,any>) => true | Error[]
}

class Human {
  id:number;
  name: string;
  constructor() {
  this.id = 1;
  this.name = 'human';
  }
  }
  
  class Animal {
  id:number;
  name: string;
  constructor() {
  this.id = 1;
  this.name = 'animal'
  }
  }
  
  const abac = new AbacApe();
  const human_authorization = abac.init(Human);
  human_authorization.createConditionsFor(Animal, {}, {
  sameId: {
  fn: function(s,r,e) {
  return s.id === r.id;
  },
  err_msg: 'different ids'
  },
  notSameId: {
  fn: function(s,r,e) {
  return s.id !== r.id;
  },
  err_msg: 'id should not be same'
  },
  true: {
  fn: function(s,r,e) {
  return true
  },
  err_msg: 'its always true why would this get hit'
  },
  false: {
  fn: function(s,r,e) {
  return false
  },
  err_msg: 'this is always false'
  }
  });
  
  /**
  * test case policy. this works if all conditions functions just return a boolean value. But, this is not the case.
  * condition functions return either true or an error object because we want to provide the exact reason why a policy has failed.
  * it is not possible to use logical operators with functions that return anything other than exact boolean values so the
  * policy defined below will not work properly unless it's written in a very specific way, this won't fly.
  * In order to allow the use of ligical operators and provide the ability to all errors when and if they occur
  * we can use a try catch wrapper function and make sure all condition functions THROW errors if they happen.
  * this way our wrapper will catch any and all errors thrown and return appropriately
  */
  human_authorization.createPolicyFor(Animal, null).action('view',(C:any) => {
  return C.sameId();
  })
  
  // abac.printPolicies();
  
  const h = new Human();
  const a = new Animal();
  let a_id_not_same = new Animal();
  a_id_not_same.id = 1000;
  console.time('total_time')
  for (let i = 0; i < 20000; i++) {
    console.time(`current_check# ${i}`);
    abac.policies.Human.view.Animal(h, a, {});
    console.timeEnd(`current_check# ${i}`)
  }
  console.timeEnd('total_time')
  const test = abac.policies.Human.view.Animal(h, a, {});
  const test_should_fail = abac.policies.Human.view.Animal(h, a_id_not_same, {});

  console.log('log result:', test);
  console.log('this one should fail', test_should_fail)