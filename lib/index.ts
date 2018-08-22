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
  [key:string]: {
    [key:string]: {
      [key:string]:  (keyof AbacApe['conditions'][any][any])[];
    }
  }
}
export default class AbacApe {
  private policies: PolicyMap;
  conditions: ConditionMap;
  constructor() {
    this.policies = {};
    this.conditions = {};
  }

  createPolicy<TS, TR>({subject, action, resource, environment, conditions}:CreatePolicyOptions<TS,TR>) {
    if (typeof action === 'string') {
      this._addPolicy({subject, action, resource, environment, conditions});
    } else {
      for (let i = 0; i < action.length; i++) {
        this._addPolicy({subject, action:action[i], resource, environment, conditions});
      }
    }
  }

  private _addPolicy<TS,TR>({subject, action, resource, environment, conditions}:CreatePolicyOptions<TS,TR>) {
    // createPolicy method will make sure action is string, but this check is put in place to narrow types for typescript because we are resuing CreatePolicyOptions<TS,TR> interface.
    if (typeof action !== 'string') {
      throw new Error(`expected action to be string, got ${typeof action}`);
    }
    if (this._checkForNode(this.policies, [subject, action, resource])) {
      throw new Error(`a policy already exists for ${subject.name} -> ${action} -> ${resource.name}. policy: ${this.policies[subject.name][action][resource.name]}`);
    }
    if (!this._checkForConditions(this.conditions, [subject, resource], conditions)) {
      throw new Error('conditions does not exist');
    }
    this._normalizeTree(this.policies, [subject, action, resource])
    this.policies[subject.name][action][resource.name] = conditions;
  }

  private _checkForConditions(tree:AbacApe['conditions'], nodes:(Constructor<AnyObject> | string | AnyObject)[], conditions_array:(keyof AbacApe['conditions'][any][any])[]) {
    const condition_map = this._getNode(tree, nodes);
    let all_conditions_are_present = true;
    // switch flag to false if condition map does not have condition
    for (let i = 0; i < conditions_array.length; i++) {
      const condition = conditions_array[i];
      if (condition_map && !condition_map.hasOwnProperty(condition)) {
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

  private _addCondition<TS, TR>(subject:Constructor<TS> | AnyObject, resource:Constructor<TR> | AnyObject, environment:any, condition_name:string, func:ConditionFunction<TS,TR>) :void {
    this._normalizeTree(this.conditions,[subject, resource]);
    this.conditions[subject.name][resource.name][condition_name] = func;
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

  checkPolicy<TSubject, TResource>(subject:IT<TSubject> | IT<AnyObject>, 
  resource: IT<TResource> | IT<AnyObject>, 
  action:string, environment:any) {
    let condition_results = [];  
    const policy_array = this._getPolicy(subject, action, resource);
    const conditions_object = this._getConditions(subject, resource);
    for (let i = 0; i < policy_array.length; i++) {
      const policy_condition = policy_array[i];
      condition_results.push(conditions_object[policy_condition](subject, resource, environment));
    }
    const errors = [];
    for (let i = 0; i < condition_results.length; i++) {
      const result = condition_results[i];
      if (result.error) {
        errors.push(result.error);
      }
    }
    if (errors.length > 0) {
      return errors
    } else {
      return true;
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

  /**
   * curried checkPolicy
   * 
   */
  auth(subject:any) {
    return (action:any) => {
      return (resource:any) => {
        return (environment: any) => {
          return this.checkPolicy(subject, action, resource, environment);
        }
      }
    }
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
  conditions: (keyof AbacApe['conditions'][any][any])[];
}

type AnyObject = {[any:string]: any};

interface ConditionResultsObject {
  error: null | any[];
  result:boolean;
}

type Constructor<TClass> = new(...args:any[]) => TClass;

type IT<T> = InstanceType<Constructor<T>>;