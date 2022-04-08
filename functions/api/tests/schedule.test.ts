/* tslint:disable:no-unused-expression */

import { handler } from '../src/scheduler';
import { expect } from 'chai';

describe('lambda handler', () => {
  it('GET success - empty params', async () => {
    const result: any = await handler();
    expect(result.statusCode).to.equal(200);
  });
});
