import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { registerNativeCloseGuard } from '../../src/platform/native-close.ts';
const request = target => target.dispatchEvent(new Event('folio-native-close-request'));

test('native close cancellation and a failed save never authorize window destruction', async () => {
  const target=new EventTarget(),errors=[];let finish=0,attempt=0;
  const dispose=registerNativeCloseGuard(target,async()=>{if(attempt++===0)return false;throw new Error('Recovery quota exceeded')},async()=>{finish++},e=>errors.push(e.message));
  request(target);await setImmediate();assert.equal(finish,0);
  request(target);await setImmediate();assert.equal(finish,0);assert.deepEqual(errors,['Recovery quota exceeded']);
  dispose();
});

test('repeated OS close requests do not open competing save dialogs', async () => {
  const target=new EventTarget();let resolve,prepare=0,finish=0;
  const pending=new Promise(r=>{resolve=r});
  const dispose=registerNativeCloseGuard(target,async()=>{prepare++;return await pending},async()=>{finish++},e=>{throw e});
  request(target);request(target);assert.equal(prepare,1);assert.equal(finish,0);
  resolve(true);await setImmediate();assert.equal(finish,1);
  dispose();request(target);await setImmediate();assert.equal(finish,1);
});

test('a disposed close handler cannot destroy a window after delayed preparation', async () => {
  const target=new EventTarget();let resolve,finish=0;
  const pending=new Promise(r=>{resolve=r});
  const dispose=registerNativeCloseGuard(target,()=>pending,async()=>{finish++},e=>{throw e});
  request(target);dispose();resolve(true);await setImmediate();assert.equal(finish,0);
});

test('native command failure is reported and leaves a later close attempt possible', async () => {
  const target=new EventTarget(),errors=[];let attempts=0;
  const dispose=registerNativeCloseGuard(target,async()=>true,async()=>{if(attempts++===0)throw new Error('Close command unavailable')},e=>errors.push(e.message));
  request(target);await setImmediate();request(target);await setImmediate();
  assert.equal(attempts,2);assert.deepEqual(errors,['Close command unavailable']);dispose();
});
