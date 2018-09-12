# AbacApe

**(ALPHA)(NOT PRODUCTION READY)**
Attribute Based Access Control Module for NodeJS

## Core Features
  * Simple, Chainable, API.
  * Fully Tested
  * TypeScript Support
  
## Installing

```
npm -i abacape
```

## Usage

```js
import AbacApe from 'abacape';

class Primate {}
class Food {}
const environment = {};

const AA = new AbacApe();
const PrimateAA = AA.init(Primate);
PrimateAA.createConditionsFor(Food, environment, {
  isBanana: {
    fn:(primate, food, environment) => {
      return food.name === 'Banana';
    },
    err_msg: 'food is not Banana';
  }
});
const PrimateFoodAA = PrimateAA.createPolicyFor(Food, environment);
PrimateFoodAA.action('eat', (conditions) => {
  if(conditions.isBanana()) {
    return true;
  } else {
    return conditions.errors;
  }
});

const lemur = new Primate();
const banana = new Food();
banana.name = 'Banana';

AA.can(lemur).eat(banana); // returns true

const apple = new Food();
apple.name = 'Apple';

AA.can(lemur).eat(apple); // returns [new Error('food is not Banana')]
```
## Authors

* **Brandon YW Lam** - *Initial Work* -[QuickStyles](https://github.com/QuickStyles)

## License

Distributed under the MIT license. See ``LICENSE`` for more information.

## Contributing...
Details coming soon.

##
