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
  policies: {[key:string]:{[key:string]:{[key:string]:<TS,TR>(subject:Constructor<TS> | AnyObject, resource: Constructor<TR> | AnyObject, environment:any) => PolicyResultsObject}}};
  conditions: {[key:string]:{[key:string]:{[key:string]:<TS,TR>(subject:InstanceType<Constructor<TS>>, resource:InstanceType<Constructor<TR>>, environment:any) => boolean|Error}}};
  createError: any;
  constructor() {
    this.policies = {};
    this.conditions = {};
  }

  createPolicy<TS, TR>({subject, action, resource, environment, policy}:CreatePolicyOptions<TS, TR>) {
    // make sure is array or string
    if (!( (Array.isArray(action) || (typeof action === 'string') ))) {
      throw new TypeError(`Expected action to be string or array of strings, got ${typeof action}`)
    }

    if(typeof policy !== 'function') {
      throw new TypeError(`Expected policy to be function, got ${typeof policy}`);
    }

    if (typeof action === 'string') {
      this._normalizeTree(this.policies, [subject, action, resource])
      if(!this._isResourceIndexed(subject, action, resource)) {
        throw new Error(`a policy already exists for ${subject.name} -> ${action} -> ${resource.name}`);
      }
      this._addPolicy({subject, action, resource, environment, policy});
    } else {
      for (let i = 0; i < action.length; i++) {
        this._normalizeTree(this.policies, [subject, action, resource])
        if(!this._isResourceIndexed(subject, action, resource)) {
          throw new Error(`a policy already exists for ${subject.name} -> ${action} -> ${resource.name}`);
        }
        this._addPolicy({subject, action:action[i], resource, environment, policy});
      }
    }
  }

  private _isResourceIndexed<TS, TR>(subject:CreatePolicyOptions<TS,TR>['subject'], action:CreatePolicyOptions<TS,TR>['action'], resource:CreatePolicyOptions<TS,TR>['resource']) {
    if (!Array.isArray(action) && typeof action === 'string') {
      return this.policies[subject.name][action].hasOwnProperty(resource.name);
    } else {
      throw new Error(`expected action to be string but got ${typeof(action)}`);
    }
  }

  private _addPolicy<TS,TR>({subject, action, resource, environment, policy}:CreatePolicyOptions<TS,TR>) {
    if (typeof action === 'string') {
      this.policies[subject.name][action][resource.name] = policy;
    } else {
      throw new Error(`expected action to be string but got ${typeof(action)}`);
    }
  }

  createCondition<TS, TR>({subject, resource, environment, condition}:any) {
    if(!validSubject(subject)) {
      throw new TypeError(`Expected subject to be constructor or plain object, got ${typeof subject}`);
    };
    if(!validResource(resource)) {
      throw new TypeError(`Expected resource to be constructor or plain object, got ${typeof resource}`);
    }

    for (const key in condition) {
      if (condition.hasOwnProperty(key)) {
        const statement = condition[key];
        this._addCondition(subject, resource, environment, key, statement[key]);
      }
    }
  }

  checkPolicy<TSubjectClassOrObject, TResourceClassOrObject>({subject, action, resource, environment}:AuthorizeOptions<TSubjectClassOrObject,TResourceClassOrObject>) :PolicyResultsObject{
    try {
      return this.policies[subject.constructor.name][action][resource.constructor.name](subject, resource, environment);
    } catch (error) {
      let errors = [];
      // TODO: make error into a
      errors.push(new ReferenceError(`Subject:${subject.constructor.name} Action:${action} Resource:${resource.constructor.name} is not a policy`))
      return {result:false, errors}
    }
  }

  printPolicies() {
    console.dir(this.policies);
  }

  auth(subject:any) {
    return (action:any) => {
      return (resource:any) => {
        return this.checkPolicy({
          subject,
          action,
          resource
        })
      }
    }
  }

  private _addCondition<TS, TR>(subject:Constructor<TS>, resource:Constructor<TR>, environment:any, key:string, func:any) {
    this._normalizeTree(this.conditions,[ subject, resource]);
    this.conditions[subject.name][resource.name][key] = func;
  }

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
  };
}



















// types
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
   * Additional data used to authenticate the policy.
   */
  environment?: any;

  /**
   * 
   * @param subject Instance of Subject requesting Resource
   * @param resource Instance of Resource being requested
   * @param environment Additional data used by conditions to judge policy verdict
   */
  policy<TSubject, TResource>(subject:InstanceType<Constructor<TSubject>> | AnyObject, resource:InstanceType<Constructor<TResource>> | AnyObject, environment:any) :PolicyResultsObject;
}

type AnyObject = {[any:string]: any};

interface PolicyResultsObject {
  result: boolean;
  errors: {}[] | null;
}

interface AuthorizeOptions<TSubjectClassOrObject, TResourceClassOrObject> {
  subject: InstanceType<Constructor<TSubjectClassOrObject>>;
  resource:InstanceType<Constructor<TResourceClassOrObject>>;
  environment?:any;
  action:string;
}

type Constructor<TClass> = new(...args:any[]) => TClass;