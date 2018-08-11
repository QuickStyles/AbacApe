enum Defaults {
  NULL_SUBJECT = 'NULL_SUBJECT'
}
export default class AbacApe {
  policies: {[key:string]:{[key:string]:{[key:string]:CreatePolicyOptions<any,any>['policy']}}};
  createError: any;
  constructor() {
    this.policies = {};
  }

  createPolicy<TSubjectClassOrObject, TResourceClassOrObject>({subject, action, resource, environment, policy}:CreatePolicyOptions<TSubjectClassOrObject, TResourceClassOrObject>) {
    if (!( (Array.isArray(action) || (typeof action === 'string') ))) {
      throw new TypeError(`Expected action to be string or array of strings, got ${typeof action}`)
    }
    if(typeof policy !== 'function') {
      throw new TypeError(`Expected policy to be function, got ${typeof policy}`);
    }
    if(typeof subject === 'undefined') {
      throw new TypeError(`Expected subject to bo object or null, got ${typeof subject}`);
    }
    
    if(!this._checkResource(resource)) {
      this._registerResource(resource);
    }

    if(!this._subjectIsIndexed(resource, subject)) {
      this._indexSubject(resource, subject);
    }

    if (typeof action === 'string') {
      this._addPolicyToResource(subject, action, resource, environment, policy);
    } else {
      for (let i = 0; i < action.length; i++) {
        this._addPolicyToResource(subject, action[i], resource, environment, policy);
      }
    }
  }

  private _checkResource<TResourceClassOrObject>(resource:Constructor<TResourceClassOrObject> | AnyObject) {
    return this.policies.hasOwnProperty(resource.name);
  }

  private _registerResource<TResourceClassOrObject>(resource:Constructor<TResourceClassOrObject> | AnyObject) {
    this.policies[resource.name] = {};
  }

  private _subjectIsIndexed<TSubjectClassOrObject, TResourceClassOrObject>(subject:Constructor<TSubjectClassOrObject> | AnyObject | null, resource:Constructor<TResourceClassOrObject>| AnyObject) {
    if (subject) {
      return this.policies[resource.name].hasOwnProperty(subject.name);
    }
  }

  private _indexSubject<TSubjectClassOrObject, TResourceClassOrObject>(subject:Constructor<TSubjectClassOrObject> | AnyObject | null, resource: Constructor<TResourceClassOrObject> | AnyObject) {
    if (subject) {
      this.policies[resource.name][subject.name] = {};
    } else {
      this.policies[resource.name][Defaults.NULL_SUBJECT] = {}; 
    }
  }

  private _addPolicyToResource<TSubjectClassOrObject, TResourceClassOrObject>(subject:Constructor<TSubjectClassOrObject> | AnyObject | null, action:string, resource: Constructor<TResourceClassOrObject> | AnyObject, environment:any, policy:CreatePolicyOptions<TResourceClassOrObject,TSubjectClassOrObject>['policy']) {
    if (subject) {
      this.policies[resource.name][subject.name][action] = policy;
    } else {
      this.policies[resource.name][Defaults.NULL_SUBJECT][action] = policy;
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