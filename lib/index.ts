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

function equate(sre:SRE<any,any>, condition:ConditionFunction<any,any>, cb:any) {
  const result = condition(...sre);
  if (result === true) {
    console.log(condition)
    console.log(result)
    return true;
  } else {
    console.log('false', result)
    if(cb) {
      cb(result);
    }
    return false;
  }
};

interface PoliciesMap {
  [key:string]: {
    [key:string]: {
      [key:string]: (...sre:SRE<any,any>) => true | Error[];
    }
  }
}

type Subject<T> = AnyObject | Constructor<T>;
type Resource<T> = AnyObject | Constructor<T>;
type Action = string;
type SRE<SubjectType, ResourceType> = [Subject<SubjectType>, Resource<ResourceType>, AnyObject];
export default class AbacApe {
  policies: PoliciesMap;
  conditions: ConditionMap;
  constructor() {
    this.policies = {};
    this.conditions = {};
  }

  init<TS>(subject:Constructor<TS> | AnyObject) {
    return {
      createConditionsFor: <TR>(resource:Constructor<TR>, environemnt:any, conditions:ConditionObject) => {
        this.createCondition({
          subject:subject,
          resource:resource,
          environment: environemnt,
          condition:conditions
        });
      },
      createPolicyFor: <TR>(action: string | string[], resource: Constructor<TR>, environemnt:any) => {
        const conditions_map = this.conditions[subject.name][resource.name]; // object of functions that take in subject, resource, environment
        return {
          function: (fn: (conditions:any, sre:any) => true|Error[]) => {
            if (typeof action === 'string') {
              this._createPolicy(subject, action, resource, environemnt, function() {
                const policy_function = arguments[0];
                const conditions = arguments[1];
                return function(subject:any, resource:any, environemnt:any) {
                  const sre = [subject, resource, environemnt];
                  // we add sre to a closure within equate so we don't need to pass it in every policy & condition call
                  return policy_function(conditions, sre);
                }
              }.apply(null, [fn, conditions_map]));
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

  private _addCondition<TS, TR>(subject:Constructor<TS> | AnyObject, resource:Constructor<TR> | AnyObject, environment:any, condition_name:string, condition_function:ConditionFunction<TS,TR>) :void {
    this._normalizeTree(this.conditions,[subject, resource]);
    this.conditions[subject.name][resource.name][condition_name] = condition_function;
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
  condition: {[any:string]: ConditionFunction<TSubject, TResource>}
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

type ConditionMap = {
  //Subject
  [key:string]: {
    //Resource
    [key:string]: {
      //Condition Name
      [key:string]: ConditionFunction<any, any>
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

type ConditionObject = {
  [key:string]: ConditionFunction<any,any>
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
  sameId: function(subject, resource, environemnt) {
    if (subject.id === resource.id) {
      return true;
    } else {
      return false;
    }
  },
  notSameId: function(s,r,e) {
    if(s.id !== r.id) {
      return true;
    } else {
      return false;
    }
  },
  reqeust_number_2: function(subject, resource, environemnt) {
    if (environemnt.request_number === 2) {
      return true;
    } else {
      return false;
    }
  },
  yes: function(subject, resource, environemnt) {
    if(false) {
      return true;
    } else {
      return false;
    }
  },
  alwaysTrue: function(s,r,e) {
    return true;
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
human_authorization.createPolicyFor('view', Animal, null).function((C:any, sre:any) => {
  try {
    return C.notSameId(...sre) || C.alwaysTrue(...sre);
  } catch (error) {
    return error;
  }
})

abac.printPolicies();

const h = new Human();
const a = new Animal();

const test = abac.policies.Human.view.Animal(h, a, {});
console.log(test);