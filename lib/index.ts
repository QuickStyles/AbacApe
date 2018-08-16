enum Defaults {
  NULL_SUBJECT = 'NULL_SUBJECT'
}

function validSubject<TS>(subject:Constructor<TS>|AnyObject) {
  return typeof subject === 'object' || typeof subject === 'function';
};
function validResource<TR>(resource:Constructor<TR>|AnyObject) {
  return typeof resource === 'object' || typeof resource === 'function';
};
function shiftNodeFromArray(nodes:(Constructor<{[any:string]:any}> | string | AnyObject)[]) {
  nodes.shift();
  return nodes;
}
function isPlainObject(obj:object) {
  return obj === Object(obj) && !Array.isArray(obj) && typeof obj !== 'function';
}
export default class AbacApe {
  policies: {[key:string]:{[key:string]:{[key:string]: string[]}}};
  conditions: {[key:string]:{[key:string]:{[key:string]:ConditionFunction<any,any>}}};
  createError: any;
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
    this._normalizeTree(this.policies, [subject, action, resource])
    this.policies[subject.name][action][resource.name] = conditions;
  }

  createCondition<TS, TR>({subject, resource, environment, condition}:CreateCondtionOptions<TS,TR>) {
    if(!validSubject(subject)) {
      throw new TypeError(`Expected subject to be constructor or plain object, got ${typeof subject}`);
    };
    if(!validResource(resource)) {
      throw new TypeError(`Expected resource to be constructor or plain object, got ${typeof resource}`);
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

  private _addCondition<TS, TR>(subject:Constructor<TS> | AnyObject, resource:Constructor<TR> | AnyObject, environment:any, key:string, func:ConditionFunction<TS,TR>) {
    this._normalizeTree(this.conditions,[subject, resource]);
    this.conditions[subject.name][resource.name][key] = func;
  }

  /**
   * Will create nodes path if it doesn't already exist
   * 
   * @param tree
   * @param nodes 
   */
  private _normalizeTree(tree:AnyObject, nodes:(Constructor<{[any:string]:any}> | string | AnyObject)[]) {
    for (let i = 0; i < nodes.length; i++) {
      let node_name;
      let node = nodes[i];
      if (typeof node !== 'string') {
        node_name = node.name
      } else {
        node_name = node;
      }
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
  private _checkForNode(tree:AnyObject, nodes:(Constructor<{[any:string]:any}> | string | AnyObject)[]) {
    for (let i = 0; i < nodes.length; i++) {
      let node_name;
      let node = nodes[i];
      if (typeof node !== 'string') {
        node_name = node.name
      } else {
        node_name = node;
      }
      if (tree.hasOwnProperty(node_name)) {
        if (nodes.length > 0)  {
          this._checkForNode(tree[node_name], shiftNodeFromArray(nodes));
        }
        else return true;
      } else {
        return false;
      }
    }
  }

  // checkPolicy<TSubjectClassOrObject, TResourceClassOrObject>({subject, action, resource, environment}:AuthorizeOptions<TSubjectClassOrObject,TResourceClassOrObject>) :PolicyResultsObject{
  //   try {
  //     return this.policies[subject.constructor.name][action][resource.constructor.name](subject, resource, environment);
  //   } catch (error) {
  //     let errors = [];
  //     errors.push(new ReferenceError(`Subject:${subject.constructor.name} Action:${action} Resource:${resource.constructor.name} is not a policy`))
  //     return {result:false, errors}
  //   }
  // }

  checkPolicy<TSubject, TResource>(subject:IT<TSubject> | IT<AnyObject>, 
  resource: IT<TResource> | IT<AnyObject>, 
  action:string, environment:any) {
    let condition_results = [];  
    const policy_array = this._getPolicy(subject, action, resource);
    const conditions_object = this._getConditions(subject, resource);
    for (let i = 0; i < policy_array.length; i++) {
      const policy_condition = policy_array[i];
      condition_results.push(conditions_object[policy_condition](subject, action, environment));
    }
    const verdict = condition_results.map(({result, error}) => {
      if (error) {
        return error;
      }
    })
  }

  _getPolicy<TS,TR>(subject:Constructor<TS> | AnyObject, action:string, resource:Constructor<TR> | AnyObject) {
    return this.policies[subject.name][action][resource.name];
  }

  _getConditions<TS,TR>(subject: Constructor<TS> | AnyObject, resource: Constructor<TR> | AnyObject) {
    return this.conditions[subject.name][resource.name];
  }
  printPolicies() {
    console.dir(this.policies);
  }

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
  conditions: string[];
}

type AnyObject = {[any:string]: any};

interface PolicyResultsObject {
  result: boolean;
  errors: {}[] | null;
}

interface ConditionResultsObject {
  error: null | any[];
  result:boolean;
}

interface AuthorizeOptions<TSubjectClassOrObject, TResourceClassOrObject> {
  subject: InstanceType<Constructor<TSubjectClassOrObject>>;
  resource:InstanceType<Constructor<TResourceClassOrObject>>;
  environment?:any;
  action:string;
}

type Constructor<TClass> = new(...args:any[]) => TClass;

type IT<T> = InstanceType<Constructor<T>>;