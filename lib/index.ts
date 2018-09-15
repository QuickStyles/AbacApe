// needs research and tested further.
function isValidConstructor<T>(object:Constructor<T> | AnyObject) {
  // must be a function
  if (typeof object.constructor !== 'function') {
    return false;
  }

  // do not allow primitive constructor functions
  if (['Object', 'Array', 'Number', 'String', 'Symbol', 'Date', 'Function', 'Boolean', undefined, null, ''].includes(object.name)) {
    return false;
  }
  return true;
}

function shiftNodeFromArray<T>(nodes:NodePath) {
  nodes.shift();
  return nodes;
};

function isPlainObject(obj:AnyObject) {
  return obj === Object(obj) && !Array.isArray(obj) && typeof obj !== 'function';
};

function getNameFrom(node:Node):string {
  if (typeof node !== 'string') {
    return node.name;
  } else {
    return node;
  }
};

function createPolicyFunctionFactory<TS,TR>(policy_function:PolicyFunction<TS,TR>, condition_hash:SubjectResourceConditionsHash<TS,TR>) :GeneratedPolicyFunction<TS,TR>{
  return function(subject:TS, resource:TR, environemnt:any) {
    const sre = <SRE<TS,TR>>[subject, resource, environemnt];
    const available_conditions = generateAvailableConditionsForPolicy(condition_hash, ...sre);
    return policy_function(available_conditions);
  }
};

function generateAvailableConditionsForPolicy<TS,TR>(conditions_hash:SubjectResourceConditionsHash<TS,TR>, ...sre:SRE<TS,TR>) :PolicyConditionsHash<TS,TR>{
  let policy_conditions = <PolicyConditionsHash<TS,TR>>{};
  policy_conditions.errors = [];
  Object.keys(conditions_hash).map((key) => {
    policy_conditions[key] = function() {
      if (conditions_hash[key].fn(...sre)) {
        return true;
      } else {
        policy_conditions.errors.push(new Error(conditions_hash[key].err_msg));
        return false;
      }
    }
  });
  
  return policy_conditions;
};

/**
 * Used to validate SubjectResourceConditionsHash.
 * Will throw error if:
 * 1) condition object property err_msg is not string
 * 2) condition object property fn is not function
 * 3) condition object has properties other than err_msg, and fn.
 * @param conditions_hash 
 */
function validateSubjectResourceConditionsHash<TS,TR>(conditions_hash:SubjectResourceConditionsHash<TS,TR>) {
  const keys_array = Object.keys(conditions_hash);
  keys_array.forEach((key) => {
    const conditions_object:ConditionObject<TS,TR> = conditions_hash[key];
    // exit if err_msg is not string;
    if (typeof conditions_object.err_msg !== 'string') {
      throw new Error(`expected err_msg in condition ${key} to be type string instead got ${typeof conditions_object.err_msg}`);
    };
    // exit if fn is not function;
    if (typeof conditions_object.fn !== 'function') {
      throw new Error(`expected fn in condition ${key} to be type function instead got ${typeof conditions_object.err_msg}`);
    };
    // exit if there are extra properties
    if (Object.keys(conditions_object).length > 2) {
      let condtion_object_keys = Object.keys(conditions_object);
      const extra_keys = condtion_object_keys.filter((value) => {
        return (value !== 'fn') && (value !== 'err_msg');
      })
      throw new Error(`expected only fn and err_msg properties but got extra properties: ${extra_keys}`)
    }
  });
};

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
  init<TS>(subject:Subject<TS>) {
    if (!isValidConstructor(subject)) {
      throw new Error(`expected subject to be constructor instead got: ${subject}`);
    }
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
      createConditionsFor: <TR>(resource:Resource<TR>, environemnt:AnyObject, conditions:SubjectResourceConditionsHash<TS,TR>) => {
        if (!isValidConstructor(resource)) {
          throw new Error(`expected resource to be constructor instead got: ${resource}`);
        }
        validateSubjectResourceConditionsHash(conditions);
        this.createCondition({
          subject:subject,
          resource:resource,
          environment: environemnt,
          condition:conditions
        });
      },
      /**
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
      createPolicyFor: <TR>(resource: Resource<TR>, environemnt:AnyObject) => {
        if (!isValidConstructor(resource)) {
          throw new Error(`expected resource to be constructor instead got: ${resource}`);
        }
        const conditions_hash = this.conditions[subject.name][resource.name]; // object of functions that take in subject, resource, environment
        return {
          action: (action: string | string[], policy_function: PolicyFunction<TS,TR>) => {
            // createPolicy for each action if given multiple actions
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
  
  /**
   * Returns all available actions for subject
   * @param subject 
   * 
   * @example 
   * 
   * const abac = new AbacApe();
   * class Primate {};
   * class Banana {};
   * //...setup conditions and policies
   * 
   * const p = new Primate();
   * const b = new Banana();
   * 
   * const actions = abac.can(p);
   * console.log(actions)
   * // prints
   * // {
   * //   eat:function,
   * //   hide:function,
   * //   fight:function
   * // }
   * @example
   */
  can<TS>(subject:IT<Subject<TS>>) {
    const available_actions = this._getNode(this.policies, [subject.constructor.name]);
    if (available_actions) {
      return this._mapAvailableActionsForSubject(subject, available_actions);
    } else {
      throw new Error(`subject: ${subject.name} has no policies`)
    }
  }

  /**
   * creates a hash using subject's actions as keys
   * @param subject 
   * @param available_actions 
   * 
   * @returns a hash containing all subject's actions as wrapper functions for checkPolicy
   */
  private _mapAvailableActionsForSubject<TS>(subject:IT<Subject<TS>>, available_actions:AnyObject) {
    return Object.assign({}, ((available_actions)=>{
      let available_actions_map:any = {};
      for (const action in available_actions) {
        available_actions_map[action] = <TR>(resource:IT<Resource<TR>>, environemnt:AnyObject) => {
          return this.checkPolicy(subject, action, resource, environemnt);
        }
      }
      return available_actions_map;
    })(available_actions))
  }

  checkPolicy<TS,TR> (...sare:SARE<TS,TR>) {
    const [subject, action, resource, environemnt] = sare;
    const policy = this._getPolicy(subject, action, resource);
    return policy(subject, resource, environemnt);
  }

  private _createPolicy<TS,TR>(subject:Subject<TS>, action:string, resource:Resource<TR>, environemnt:AnyObject, policy_function:GeneratedPolicyFunction<TS,TR>) {
    this._normalizeTree(this.policies, [subject, action]);
    if (!this._checkForNode(this.policies, [subject, action, resource])) {
      let subject_action = this._getNode(this.policies, [subject, action]);
      if (subject_action) {
        subject_action[resource.name] = function(...sre:SRE<TS,TR>) {
          if (policy_function(...sre)) {
            return true;
          } else {
            return false;
          }
        }
      }
    } else {
      throw new Error(`policy already exists for subject: ${subject.name} -> action: ${action} -> resource: ${resource.name}`);
    }
  }
  
  createCondition<TS, TR>({subject, resource, environment, condition}:CreateCondtionOptions<TS,TR>) {
    if(!isValidConstructor(subject)) {
      throw new TypeError(`Expected subject to be constructor or plain object, got ${typeof subject}`);
    };
    if(!isValidConstructor(resource)) {
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
  
  private _addCondition<TS, TR>(subject:Constructor<TS> | AnyObject, resource:Constructor<TR> | AnyObject, environment:any, condition_name:string, condition_object:ConditionObject<TS,TR>) :void {
    this._normalizeTree(this.conditions,[subject, resource]);
    this.conditions[subject.name][resource.name][condition_name] = condition_object;
  }
  
  /**
   * Will create nodes path if it doesn't already exist
   * 
   * @param tree
   * @param nodes 
   */
  private _normalizeTree(tree:AnyObject, nodes:NodePath) :void {
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
  private _checkForNode(tree:AnyObject, nodes:NodePath):boolean {
    if (this._getNode(tree, nodes)) {
      return true;
    } else {
      return false;
    }
  }
  
  private _getNode(tree:AnyObject, nodes:NodePath) :AnyObject|undefined {
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
  
  _getPolicy<TS,TR>(subject:Constructor<TS> | AnyObject, action:string, resource:Constructor<TR> | AnyObject) :GeneratedPolicyFunction<TS,TR>{
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
  
};

// types

type ConditionsTree = {
  //Subject
  [key:string]: {
    //Resource
    [key:string]: {
      //Condition Name
      [key:string]: ConditionObject<any,any>
    }
  }
};

interface PoliciesTree {
  //Subject
  [key:string]: {
    //Action
    [key:string]: {
      //Resource
      [key:string]: GeneratedPolicyFunction<any,any>
    }
  }
};

type GeneratedPolicyFunction<TS,TR> = (...sre:SRE<TS,TR>) => boolean | Error[];

interface CreateCondtionOptions<TSubject, TResource> {
  subject: Subject<TSubject>
  resource: Resource<TResource>
  environment: any;
  condition: SubjectResourceConditionsHash<TSubject,TResource>
};

export interface SubjectResourceConditionsHash<TS,TR> {
  [key:string] : ConditionObject<TS,TR>
};

export type ConditionObject<TS,TR> = {
  err_msg: string,
  fn: ConditionFunction<TS,TR>
};

type ConditionFunction<TS,TR> = (subject:IT<TS>, resource:IT<TR>, environemnt:AnyObject) => boolean;

type AnyObject = {[any:string]: any};

type Constructor<TClass> = new(...args:any[]) => TClass;

type IT<T> = InstanceType<Constructor<T>>;

type Subject<T> = Constructor<T> | AnyObject;

type Resource<T> = Constructor<T> | AnyObject;

type SRE<SubjectType, ResourceType> = [IT<SubjectType>, IT<ResourceType>, AnyObject];

type PolicyFunction<TS,TR> = (conditons:PolicyConditionsHash<TS,TR>) => boolean;

type PolicyConditionsHash<TS,TR> = {[K in keyof SubjectResourceConditionsHash<TS,TR>]: ConditionFunction<TS,TR>} & {
  errors: Error[];
}

type NodePath = (Constructor<any> | string | AnyObject)[];

type Node = (Constructor<any> | string | AnyObject);

type SARE<TS,TR> = [IT<TS>, string, IT<TR>, AnyObject];