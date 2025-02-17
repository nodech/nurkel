/* eslint no-unused-vars: "off" */
'use strict';

/**
 * Tests ported from the https://github.com/handshake-org/urkel
 */

const assert = require('bsert');
const fs = require('fs');
const crypto = require('crypto');
const {testdir, rmTreeDir, isTreeDir, randomKey} = require('./util/common');
const nurkel = require('..');
const {statusCodes, BLAKE2b} = nurkel;

const HASH_SIZE = 32;

const FOO1 = BLAKE2b.digest(Buffer.from('foo1'));
const FOO2 = BLAKE2b.digest(Buffer.from('foo2'));
const FOO3 = BLAKE2b.digest(Buffer.from('foo3'));
const FOO4 = BLAKE2b.digest(Buffer.from('foo4'));
const FOO5 = BLAKE2b.digest(Buffer.from('foo5'));
const FOO6 = BLAKE2b.digest(Buffer.from('foo6'));
const FOO7 = BLAKE2b.digest(Buffer.from('foo7'));

const BAR1 = Buffer.from('bar1');
const BAR2 = Buffer.from('bar2');
const BAR3 = Buffer.from('bar3');
const BAR4 = Buffer.from('bar4');

function random(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

const treeCreateOptions = {
  'nurkel': {},
  // use legacy tree
  'urkel': {
    urkel: true
  },
  // legacy tree as in memory tree
  'memory': {
    memory: true
  }
};

for (const [name, treeTestOptions] of Object.entries(treeCreateOptions)) {
describe(`Urkel (${name})`, function() {
  this.timeout(20000);

  const Tree = name === 'nurkel' ? nurkel.Tree : nurkel.UrkelTree;

  let prefix, prefix2;

  beforeEach(async () => {
    prefix = testdir('tree');
    prefix2 = testdir('tree2');
  });

  afterEach(async () => {
    if (isTreeDir(prefix))
      rmTreeDir(prefix);

    if (isTreeDir(prefix2))
      rmTreeDir(prefix2);
  });

  it('should test tree', async () => {
    const tree = nurkel.create({ prefix, ...treeTestOptions });
    await tree.open();

    let batch = tree.batch();
    await batch.open();

    // Insert some values.
    await batch.insert(FOO1, BAR1);
    await batch.insert(FOO2, BAR2);
    await batch.insert(FOO3, BAR3);

    // Commit and get first non-empty root.
    const first = await batch.commit();
    assert.strictEqual(first.length, HASH_SIZE);

    // Get a committed value.
    assert.bufferEqual(await tree.get(FOO2), BAR2);

    // Insert a new value.
    await batch.insert(FOO4, BAR4);

    // Get second root with new committed value.
    // Ensure it is different from the first!
    {
      const root = await batch.commit();
      assert.strictEqual(root.length, HASH_SIZE);
      assert.notBufferEqual(root, first);
    }

    // Make sure our committed value is there.
    assert.bufferEqual(await tree.get(FOO4), BAR4);

    // Make sure we can snapshot the old root.
    const ss = tree.snapshot(first);
    await ss.open();
    assert.strictEqual(await ss.get(FOO4), null);
    assert.bufferEqual(ss.rootHash(), first);

    // Remove the last value.
    await batch.remove(FOO4);

    // Commit removal and ensure our root hash
    // has reverted to what it was before (first).
    assert.bufferEqual(await batch.commit(), first);

    // Make sure removed value is gone.
    assert.strictEqual(await tree.get(FOO4), null);

    // Make sure older values are still there.
    assert.bufferEqual(await tree.get(FOO2), BAR2);

    // Create a proof and verify.
    {
      const ss = tree.snapshot(first);
      await ss.open();
      const proof = await ss.prove(FOO2);
      const [code, data] = await Tree.verify(first, FOO2, proof);
      assert.strictEqual(code, statusCodes.URKEL_OK);
      assert.bufferEqual(data, BAR2);

      const [codeSync, dataSync] = Tree.verifySync(first, FOO2, proof);
      assert.strictEqual(codeSync, statusCodes.URKEL_OK);
      assert.bufferEqual(dataSync, BAR2);
    }

    // Create a non-existent proof and verify.
    {
      const ss = tree.snapshot(first);
      await ss.open();
      const proof = await ss.prove(FOO5);
      const [code, data] = await Tree.verify(first, FOO5, proof);
      assert.strictEqual(code, statusCodes.URKEL_OK);
      assert.strictEqual(data, null);

      const [codeSync, dataSync] = Tree.verifySync(first, FOO5, proof);
      assert.strictEqual(codeSync, statusCodes.URKEL_OK);
      assert.strictEqual(dataSync, null);
    }

    // Create a non-existent proof and verify.
    {
      const ss = tree.snapshot(first);
      await ss.open();
      const proof = await ss.prove(FOO4);
      const [code, data] = await Tree.verify(first, FOO4, proof);
      assert.strictEqual(code, statusCodes.URKEL_OK);
      assert.strictEqual(data, null);

      const [codeSync, dataSync] = Tree.verifySync(first, FOO4, proof);
      assert.strictEqual(codeSync, statusCodes.URKEL_OK);
      assert.strictEqual(dataSync, null);
    }

    // Create a proof and verify.
    {
      const ss = tree.snapshot();
      await ss.open();
      const proof = await ss.prove(FOO2);
      const [code, data] = await Tree.verify(tree.rootHash(), FOO2, proof);
      assert.strictEqual(code, 0);
      assert.bufferEqual(data, BAR2);

      const [codeSync, dataSync] = Tree.verifySync(tree.rootHash(), FOO2, proof);
      assert.strictEqual(codeSync, 0);
      assert.bufferEqual(dataSync, BAR2);
    }

    // Create a non-existent proof and verify.
    {
      const ss = tree.snapshot();
      await ss.open();
      const proof = await tree.prove(FOO5);
      const [code, data] = await Tree.verify(tree.rootHash(), FOO5, proof);
      assert.strictEqual(code, 0);
      assert.strictEqual(data, null);

      const [codeSync, dataSync] = Tree.verifySync(tree.rootHash(), FOO5, proof);
      assert.strictEqual(codeSync, 0);
      assert.strictEqual(dataSync, null);
    }

    // Create a proof and verify.
    {
      const ss = tree.snapshot();
      await ss.open();
      const proof = await tree.prove(FOO4);
      const [code, data] = await Tree.verify(tree.rootHash(), FOO4, proof);
      assert.strictEqual(code, 0);
      assert.strictEqual(data, null);

      const [codeSync, dataSync] = Tree.verifySync(tree.rootHash(), FOO4, proof);
      assert.strictEqual(codeSync, 0);
      assert.strictEqual(dataSync, null);
    }

    // Iterate over values.
    {
      const ss = tree.snapshot();
      const items = new Map();
      await ss.open();

      for await (const [key, value] of ss)
        items.set(key.toString('hex'), value);

      assert.strictEqual(items.size, 3);
      assert.deepStrictEqual(items, new Map([
        [FOO1.toString('hex'), BAR1],
        [FOO2.toString('hex'), BAR2],
        [FOO3.toString('hex'), BAR3]
      ]));
      await ss.close();
    }

    // Test persistence.
    {
      const root = await batch.commit();

      await tree.close();
      await tree.open();
      batch = tree.batch();
      await batch.open();

      const ss = tree.snapshot(root);
      await ss.open();

      // Make sure older values are still there.
      assert.bufferEqual(await ss.get(FOO2), BAR2);
    }

    // Test persistence of best state.
    {
      const root = await batch.commit();

      await tree.close();
      await tree.open();

      assert.bufferEqual(tree.rootHash(), root);

      // Make sure older values are still there.
      assert.bufferEqual(await tree.get(FOO2), BAR2);
    }

    await tree.close();
  });

  it('should test max value size', async () => {
    const MAX_VALUE = 0x3ff;
    const tree = nurkel.create({ prefix, ...treeTestOptions });

    await tree.open();

    // Max Value
    {
      const max = Buffer.alloc(MAX_VALUE, 0x01);
      const batch = tree.batch();
      await batch.open();

      await batch.insert(FOO6, max);

      const root = await batch.commit();
      assert.strictEqual(root.length, HASH_SIZE);

      const check = await tree.get(FOO6);

      assert.bufferEqual(check, max);
    }

    // Max value + 1
    {
      let err;
      try {
        const maxPlus = Buffer.alloc(MAX_VALUE + 1);
        const batch = tree.batch();
        await batch.open();

        await batch.insert(FOO7, maxPlus);
        const root = await batch.commit();
      } catch (e) {
        err = e;
      }

      assert(err, 'Expected error on max + 1 value.');

      const value = await tree.get(FOO7);
      assert.strictEqual(value, null, 'Expected FOO7 not to exist.');

      await tree.close();
    }
  });

  it('should pummel tree', async () => {
    this.timeout(60000);

    const tree = nurkel.create({ prefix, ...treeTestOptions });

    const items = [];
    const set = new Set();

    await tree.open();

    let batch = tree.batch();
    await batch.open();

    while (set.size < 10000) {
      const key = randomKey();
      const value = crypto.randomBytes(random(1, 100));
      const key1 = key.toString('binary');

      if (set.has(key1))
        continue;

      key[key.length - 1] ^= 1;

      const key2 = key.toString('binary');

      key[key.length - 1] ^= 1;

      if (set.has(key2))
        continue;

      set.add(key1);

      items.push([key, value]);
    }

    set.clear();

    let midRoot = null;
    let lastRoot = null;

    {
      for (const [i, [key, value]] of items.entries()) {
        await batch.insert(key, value);
        if (i === (items.length >>> 1) - 1)
          midRoot = batch.rootHash();
      }

      const root = await batch.commit();
      lastRoot = root;

      for (const [key, value] of items) {
        assert.bufferEqual(await tree.get(key), value);

        key[key.length - 1] ^= 1;
        assert.strictEqual(await tree.get(key), null);
        key[key.length - 1] ^= 1;
      }

      await tree.close();
      await tree.open();
      batch = tree.batch();
      await batch.open();

      assert.bufferEqual(tree.rootHash(), root);
    }

    for (const [key, value] of items) {
      assert.bufferEqual(await tree.get(key), value);

      key[key.length - 1] ^= 1;
      assert.strictEqual(await tree.get(key), null);
      key[key.length - 1] ^= 1;
    }

    items.reverse();

    for (const [i, [key]] of items.entries()) {
      if (i < (items.length >>> 1))
        await batch.remove(key);
    }

    {
      const root = await batch.commit();

      await tree.close();
      await tree.open();
      batch = tree.batch();
      await batch.open();

      assert.bufferEqual(tree.rootHash(), root);
      assert.bufferEqual(tree.rootHash(), midRoot);
    }

    for (const [i, [key, value]] of items.entries()) {
      const val = await tree.get(key);

      if (i < (items.length >>> 1))
        assert.strictEqual(val, null);
      else
        assert.bufferEqual(val, value);
    }

    {
      const root = await batch.commit();

      await tree.close();
      await tree.open();
      batch = tree.batch();
      await batch.open();

      assert.bufferEqual(tree.rootHash(), root);
    }

    {
      const expect = [];

      for (const [i, item] of items.entries()) {
        if (i < (items.length >>> 1))
          continue;

        expect.push(item);
      }

      expect.sort((a, b) => {
        const [x] = a;
        const [y] = b;
        return x.compare(y);
      });

      let i = 0;

      const ss = tree.snapshot();
      await ss.open();
      for await (const [key, value] of ss) {
        const [k, v] = expect[i];

        assert.bufferEqual(key, k);
        assert.bufferEqual(value, v);

        i += 1;
      }
      await ss.close();

      assert.strictEqual(i, items.length >>> 1);
    }

    for (let i = 0; i < items.length; i += 11) {
      const [key, value] = items[i];

      const root = tree.rootHash();
      const proof = await tree.prove(key);
      const [code, data] = await Tree.verify(root, key, proof);
      const [codeSync, dataSync] = Tree.verifySync(root, key, proof);

      assert.strictEqual(code, 0);
      assert.strictEqual(codeSync, 0);

      if (i < (items.length >>> 1)) {
        assert.strictEqual(data, null);
        assert.strictEqual(dataSync, null);
      } else {
        assert.bufferEqual(data, value);
        assert.bufferEqual(dataSync, value);
      }
    }

    {
      const stat1 = await tree.stat();
      await tree.compact();
      const stat2 = await tree.stat();
      assert(stat1.size > stat2.size);
    }

    const rand = items.slice(0, items.length >>> 1);

    rand.sort((a, b) => Math.random() >= 0.5 ? 1 : -1);

    batch = tree.batch();
    await batch.open();

    for (const [i, [key, value]] of rand.entries())
      await batch.insert(key, value);

    {
      assert.bufferEqual(batch.rootHash(), lastRoot);

      const root = await batch.commit();

      await tree.close();
      await tree.open();

      assert.bufferEqual(tree.rootHash(), root);
      assert.bufferEqual(tree.rootHash(), lastRoot);
    }

    await tree.close();
  });

  it('should test history independence', async () => {
    const opts1 = { prefix, ...treeTestOptions };
    const opts2 = {
      prefix: prefix2,
      ...treeTestOptions
    };

    const items = [];
    const removed = [];
    const remaining = [];

    while (items.length < 10000) {
      const key = crypto.randomBytes(HASH_SIZE);
      const value = crypto.randomBytes(random(1, 100));
      items.push([key, value]);
    }

    const tree1 = nurkel.create(opts1);
    await tree1.open();

    const tree2 = nurkel.create(opts2);
    await tree2.open();

    let root = null;
    let fullRoot1 = null;
    let fullRoot2 = null;
    let midRoot1 = null;
    let midRoot2 = null;

    {
      const batch = tree1.batch();
      await batch.open();

      for (const [key, value] of items)
        await batch.insert(key, value);

      root = await batch.commit();
    }

    {
      const batch = tree1.batch();
      await batch.open();

      for (const [key, value] of items) {
        if (Math.random() < 0.5) {
          remaining.push([key, value]);
          continue;
        }

        await batch.remove(key);

        removed.push([key, value]);
      }

      midRoot1 = await batch.commit();
    }

    {
      const batch = tree1.batch();
      await batch.open();

      for (const [key, value] of removed)
        await batch.insert(key, value);

      fullRoot1 = await batch.commit();
    }

    {
      const batch = tree2.batch();
      await batch.open();

      for (const [key, value] of remaining)
        await batch.insert(key, value);

      midRoot2 = await batch.commit();
    }

    {
      const batch = tree2.batch();
      await batch.open();

      for (const [key, value] of removed)
        await batch.insert(key, value);

      fullRoot2 = await batch.commit();
    }

    assert.bufferEqual(fullRoot1, root);
    assert.bufferEqual(fullRoot2, root);
    assert.bufferEqual(fullRoot1, fullRoot2);
    assert.bufferEqual(midRoot1, midRoot2);

    await tree1.close();
    await tree2.close();
  });
});
}
