enum Defaults {
  NULL_SUBJECT = 'NULL_SUBJECT'
}
export default class AbacApe {
  policies: {[key:string]:{[key:string]:{[key:string]:CreatePolicyOptions<any,any>['policy']}}};
  createError: any;
  constructor() {
    this.policies = {};
  }

  createPolicy<TS, TR>({subject, action, resource, environment, policy}:CreatePolicyOptions<TS, TR>) {
    if (!( (Array.isArray(action) || (typeof action === 'string') ))) {
      throw new TypeError(`Expected action to be string or array of strings, got ${typeof action}`)
    }
    if(typeof policy !== 'function') {
      throw new TypeError(`Expected policy to be function, got ${typeof policy}`);
    }
    if(typeof subject === 'undefined') {
      throw new TypeError(`Expected subject to bo object or null, got ${typeof subject}`);
    }

    if (typeof action === 'string') {
      this._checkPolicyTree(subject, action, resource);
      this._addPolicy({subject, action, resource, environment, policy});
    } else {
      for (let i = 0; i < action.length; i++) {
        this._checkPolicyTree(subject, action[i], resource);
        this._addPolicy({subject, action:action[i], resource, environment, policy});
      }
    }
  }

  _checkPolicyTree<TS, TR>(subject:CreatePolicyOptions<TS, TR>['subject'], action:CreatePolicyOptions<TS,TR>['action'], resource:CreatePolicyOptions<TS,TR>['resource']) {
    if(!this._isSubjectIndexed(subject)) {
      this._indexSubject(subject);
    }

    if(!this._isActionIndexed(subject, action)) {
      this._indexAction(subject, action);
    }

    if(this._isResourceIndexed(subject, action, resource)) {
      throw new Error(`a policy already exists for ${subject.name} -> ${action} -> ${resource.name}`);
    }
  }

  private _isSubjectIndexed<TS, TR>(subject:CreatePolicyOptions<TS, TR>['subject']) {
    return this.policies.hasOwnProperty(subject.name);
  }

  private _indexSubject<TS, TR>(subject:CreatePolicyOptions<TS,TR>['subject']) {
    this.policies[subject.name] = {};
  }

  private _isActionIndexed<TS,TR>(subject:CreatePolicyOptions<TS,TR>['subject'], action:CreatePolicyOptions<TS,TR>['action']) {
    if (!Array.isArray(action) && typeof action === 'string') {
      return this.policies[subject.name].hasOwnProperty(action);
    } else {
      throw new Error(`expected action to be string but got ${typeof(action)}`);
    }
  }

  private _indexAction<TS, TR>(subject:CreatePolicyOptions<TS,TR>['subject'], action:CreatePolicyOptions<TS,TR>['action']) {
    if (!Array.isArray(action) && typeof action === 'string') {
      return this.policies[subject.name][action] = {};
    } else {
      throw new Error(`expected action to be string but got ${typeof(action)}`);
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

  checkPolicy<TSubjectClassOrObject,TResourceClassOrObject>({subject, action, resource, environment}:AuthorizeOptions<TSubjectClassOrObject,TResourceClassOrObject>) :PolicyResultsObject{
    if (subject) {
      try {
        return this.policies[resource.constructor.name][subject.constructor.name][action](subject,resource,environment);
      } catch (error) {
        let errors = [];
        // TODO: make error into a
        errors.push(new ReferenceError(`Subject:${subject.constructor.name} Action:${action} Resource:${resource.constructor.name} is not a policy`))
        return {result:false, errors}
      }
    } else {
      try {
        return this.policies[resource.constructor.name][Defaults.NULL_SUBJECT][action](subject, resource, environment);
      } catch (error) {
        let errors = [];
        // should push error into errors array.
        errors.push(new ReferenceError(`Subject:null Action:${action} Resource:${resource.constructor.name} is not a policy`))
        return {result: false, errors};
      }
    }
  }

  printPolicies() {
    console.dir(this.policies);
  }
}

interface CreatePolicyOptions<TSubjectClassOrObject, TResourceClassOrObject = null> {
  /**
   * Used to index the constructor of the subject.
   * The subject parameter in the policy function must be an instance of this Object/Constructor
   */
  subject: Constructor<TSubjectClassOrObject> | AnyObject;
  /**
   * Name of action being performed.
   */
  action: string | string[];
  /**
   * Used to index the constructor of the resource.
   * The resource parameter in the policy function must be an instance of this Object/Constructor
   */
  resource: Constructor<TResourceClassOrObject> | AnyObject;
  /**
   * Additional data used to authenticate the policy.
   */
  environment?: any;
  /**
   * @description Creates a Policy. A Policy should be made up of one or more conditions and should always
   * return 
   * @example
   * 
   * policy(subject, resource, environment) {
   *  let result = {
   *    result: false,
   *    errors: []
   *  };
   *  condition(result);
   *  return result;
   * }
   * @example
   * 
   * @param subject Instance of Object requesting resource.
   * @param resource Instnace of Object being requested.
   * @param environment Environment and additional data used to authorize access to the reqested resource.
   * @see createPolicy
   */
  policy(subject:InstanceType<Constructor<TSubjectClassOrObject>> | AnyObject, resource: InstanceType<Constructor<TResourceClassOrObject>> | AnyObject, environment:any):PolicyResultsObject;
}

type AnyObject = {[any:string]: any};

interface PolicyResultsObject {
  result: boolean;
  errors: {}[] | null;
}

interface AuthorizeOptions<TSubjectClassOrObject, TResourceClassOrObject> {
  subject: InstanceType<Constructor<TSubjectClassOrObject>> | null;
  resource:InstanceType<Constructor<TResourceClassOrObject>>;
  environment?:any;
  action:string;
}

type Constructor<TClass> = new(...args:any[]) => TClass;