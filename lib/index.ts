enum Defaults {
  NULL_SUBJECT = 'NULL_SUBJECT'
}
class AbacApe {
  resources: {[key:string]:{[key:string]:{[key:string]:CreatePolicyOptions<any,any>['policy']}}};
  createError: any;
  constructor() {
    this.resources = {};
  }

  createPolicy<TRC, TSC>({subject, action, resource, environment, policy}:CreatePolicyOptions<TRC, TSC>) {
    if (!( (Array.isArray(action) || (typeof action === 'string') ))) {
      throw new TypeError(`Expected action to be string or array of strings, got ${typeof action}`)
    }
    if(typeof policy !== 'function') {
      throw new TypeError(`Expected policy to be function, got ${typeof policy}`);
    }
    if(typeof subject === 'undefined') {
      throw new TypeError(`Expected subject to bo object or null, got ${typeof subject}`);
    }
    
    if(!this._checkResource<TRC>(resource)) {
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

  private _checkResource<TRC>(resource:Constructor<TRC>) {
    console.log(resource)
    return this.resources.hasOwnProperty(resource.name);
  }

  private _registerResource<TRC>(resource:{new():TRC}) {
    this.resources[resource.name] = {};
  }

  private _subjectIsIndexed<TRC, TSC>(resource:{new():TRC}, subject:{new():TSC}|null) {
    if (subject) {
      return this.resources[resource.name].hasOwnProperty(subject.name);
    }
  }

  private _indexSubject<TRC, TSC>(resource:{new():TRC}, subject:{new():TSC}|null) {
    if (subject) {
      this.resources[resource.name][subject.name] = {};
    } else {
      this.resources[resource.name][Defaults.NULL_SUBJECT] = {}; 
    }
  }

  private _addPolicyToResource<TRC, TSC>(subject:{new():TSC} | null, action:string, resource:{new():TRC}, environment:any, policy:CreatePolicyOptions<TRC,TSC>['policy']) {
    console.log(action);
    if (subject) {
      this.resources[resource.name][subject.name][action] = policy;
    } else {
      this.resources[resource.name][Defaults.NULL_SUBJECT][action] = policy;
    }
  }

  checkPolicy<TSC,TRC>({subject, action, resource, environment}:AuthorizeOptions<TSC,TRC>) :PolicyResultsObject{
    if (subject) {
      return this.resources[resource.constructor.name][subject.constructor.name][action](subject,resource,environment);
    } else {
      return this.resources[resource.constructor.name][Defaults.NULL_SUBJECT][action](subject, resource, environment);
    }
  }
}

interface CreatePolicyOptions<TRC, TSC = null> {
  subject: null | Constructor<TSC>;
  action: string | string[];
  resource: Constructor<TRC>;
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
   * @param subject Object requesting resource. Will be the same subject option passed into createPolicy.
   * @param resource Resource being requested. Will be the same resource option passed into createPolicy.
   * @param environment Environment and additional data used to authorize access to the reqested resource. Will be the same environment option passed into createPolicy.
   * @see createPolicy
   */
  policy(subject:TSC, resource:TRC, environment:any):PolicyResultsObject;
}

interface PolicyResultsObject {
  result: boolean;
  errors: {}[] | null;
}

interface AuthorizeOptions<TSC, TRC> {
  subject: InstanceType<{new():TSC}> | null;
  resource:InstanceType<{new():TRC}>;
  environment:any;
  action:string;
}

type Constructor<TClass> = new(...args:any[]) => TClass;