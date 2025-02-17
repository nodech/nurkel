'use strict';

const assert = require('bsert');
const fs = require('fs');
const {testdir, isTreeDir, rmTreeDir, randomKey, sleep} = require('./util/common');
const {Tree} = require('..');

describe('Urkel Transaction (GC)', function () {
  if (!global.gc)
    this.skip();

  let prefix, tree;

  beforeEach(async () => {
    prefix = testdir('tx-gc');
    fs.mkdirSync(prefix);

    tree = new Tree({prefix});
  });

  afterEach(async () => {
    if (isTreeDir(prefix))
      rmTreeDir(prefix);
    global.gc();
  });

  it('should init transaction and cleanup', async () => {
    await tree.open();
    {
      tree.transaction();
    }
    global.gc();
    await tree.close();
  });

  it('should open and close transaction', async () => {
    await tree.open();

    const transaction = tree.transaction();
    await transaction.open();
    await transaction.close();

    await tree.close();
  });

  it('should init transaction, open and cleanup', async () => {
    await tree.open();

    // Make sure it goes out of scope
    await (async () => {
      const transaction = tree.transaction();
      await transaction.open();
    })();

    global.gc();
    await (async () => {
      const transaction = tree.transaction();
      // Don't wait
      transaction.open();
    })();

    global.gc();

    await tree.close();
  });

  it('should close transaction when tree closes', async () => {
    await tree.open();
    const transaction = tree.transaction();

    await transaction.open();
    await tree.close();

    let err;

    try {
      await transaction.close();
    } catch (e) {
      err = e;
    }

    assert(err, 'Close should throw.');
    assert.strictEqual(err.message, 'Tree is closed.');
  });

  it('should close all transactions', async () => {
    await tree.open();

    const txns = [];

    for (let i = 0; i < 10; i++) {
      txns.push(tree.transaction());

      // Open and wait 5.
      if (i < 5) {
        await txns[i].open();
      }

      // wait close 2.
      if (i < 2) {
        await txns[i].close();
      }

      // don't wait close 2.
      if (i >= 2 && i <= 3) {
        txns[i].close();
      }

      // don't wait open >5
      if (i >= 5)
        txns[i].open();
    }

    await tree.close();

    for (let i = 0; i < 10; i++) {
      const tx = txns[i];
      let err;

      try {
        await tx.close();
      } catch (e) {
        err = e;
      }

      assert(err, 'tx close should throw an error.');

      if (i <= 3)
        assert.strictEqual(err.message, 'Transaction is not open.');
      else
        assert.strictEqual(err.message, 'Tree is closed.');
    }
  });

  it('should close tx and tree after out-of-scope', async () => {
    await tree.open();

    await (async () => {
      for (let i = 0; i < 10; i++) {
        const txn = await tree.txn();
        await txn.open();
      }

      for (let i = 0; i < 10; i++) {
        const txn = await tree.txn();
        await txn.open();
        txn.close();
      }
    })();

    global.gc();
    await sleep(1000);
    await tree.close();
  });

  /*
   * NOTE: External buffers are not freed on GC run right away
   * they still take time.
   */
  it('should test memory leak for proof', async () => {
    await tree.open();

    const txn1 = tree.txn();
    await txn1.open();
    const keys = [];
    global.gc();
    let lastUsage = process.memoryUsage();
    let usage = null;

    global.gc();
    await (async () => {
      for (let i = 0; i < 100; i++) {
        const key = randomKey();
        const val = randomKey();

        txn1.insertSync(key, val);
        keys.push(key);
      }
    })();

    global.gc();
    usage = process.memoryUsage();
    assert(lastUsage.external < usage.external);
    assert(lastUsage.arrayBuffers < usage.arrayBuffers);
    lastUsage = usage;
    await (async () => {
      const proofs = [];
      for (const [i, key] of keys.entries()) {
        const proof = txn1.proveSync(key);
        proofs.push(proof);
        delete keys[i];
      }

      usage = process.memoryUsage();
      // Proofs are now external not array buffer.
      assert(lastUsage.external < usage.external);
      lastUsage = usage;
    })();

    // External buffers don't get freed on first run ?
    global.gc();
    global.gc();

    usage = process.memoryUsage();
    assert(lastUsage.arrayBuffers > usage.arrayBuffers);
    assert(lastUsage.external > usage.external);

    await tree.close();
  });
});
