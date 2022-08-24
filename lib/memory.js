/**
 * memory.js - urkel wrapper in nurkel fashion.
 * Copyright (c) 2022, Nodari Chkuaselidze (MIT License)
 * https://github.com/nodech/nurkel
 */
'use strict';

const {Tree, Proof} = require('urkel');

const {
  asyncIterator,
  errors,
  proofCodes,
  proofCodesByVal
} = require('./common');

const {randomPath} = require('./util');
const BLAKE2b = require('./blake2b');

const {
  ERR_PLACEHOLDER,
  ERR_NOT_SUPPORTED,
  ERR_NOT_IMPL
} = errors;

/**
 * Wrapper for the urkel Tree.
 */

class WrappedTree {
  constructor(options = {}) {
    options.hash = BLAKE2b;
    options.bits = BLAKE2b.bits;
    this._tree = new Tree(options);
  }

  get supportsSync() {
    return false;
  }

  get bits() {
    return this._tree.bits;
  }

  get hashSize() {
    return this._tree.hash.size;
  }

  get keySize() {
    return this.bits >>> 3;
  }

  get hash() {
    return this._tree.hash;
  }

  /**
   * Check hash.
   * @param {Buffer} hash
   * @returns {Boolean}
   */

  isHash(hash) {
    return this._tree.isHash(hash);
  }

  /**
   * Check key.
   * @param {Buffer} key
   * @returns {Boolean}
   */

  isKey(key) {
    return this._tree.isKey(key);
  }

  /**
   * Check value.
   * @param {Buffer} value
   * @returns {Boolean}
   */

  isValue(value) {
    return this._tree.isValue(value);
  }

  /**
   * Open tree.
   * @param {Hash} [rootHash=null]
   * @returns {Promise}
   */

  async open(rootHash) {
    await this._tree.open(rootHash);
  }

  /**
   * Close tree.
   * @returns {Promise}
   */

  async close() {
    await this._tree.close();
  }

  /**
   * Removed from the nurkel, so even memory wont
   * support it.
   */

  getRoot() {
    throw new Error(ERR_PLACEHOLDER);
  }

  /**
   * Get root hash.
   * @returns {Buffer}
   */

  rootHash() {
    return this._tree.rootHash();
  }

  /**
   * Get root hash sync.
   * @returns {Buffer}
   */

  treeRootHashSync() {
    return this._tree.rootHash();
  }

  /**
   * Get root hash but wrap in the promise.
   * @returns {Promise<Buffer>}
   */

  async treeRootHash() {
    return this._tree.rootHash();
  }

  /**
   * Get value by the key.
   * @param {Buffer} key
   * @returns {Promise<Buffer>}
   */

  async get(key) {
    const snap = this._tree.snapshot();
    const value = await snap.get(key);

    return value;
  }

  /**
   * Get value by the key.
   */

  getSync() {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  /**
   * Does tree have the key.
   * @param {Buffer} key
   * @returns {Promise<Boolean>}
   */

  async has(key) {
    const snap = this._tree.snapshot();
    const value = await snap.get(key);

    return value != null;
  }

  /**
   * Does tree have the key.
   */

  hasSync(key) {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  /**
   * Inject new root into the tree.
   * @param {Hash} hash
   * @returns {Promise}
   */

  async inject(hash) {
    return this._tree.inject(hash);
  }

  /**
   * Inject new root into the tree.
   */

  injectSync(hash) {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  /**
   * Generate proof for the key.
   * @param {Buffer} key
   * @returns {Promise<Buffer>}
   */

  async prove(key) {
    const proof = await this._tree.prove(key);
    return proof.encode(this.hash, this.bits);
  }

  /**
   * Generate proof for the key.
   */

  proveSync(key) {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  /**
   * Get the tree stat.
   * @returns {Promise<Object>}
   */

  stat() {
    return this._tree.store.stat();
  }

  /**
   * Get the tree stat.
   * @returns {Object}
   */

  statSync() {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  /**
   * Compact database.
   * @param {String} [tmpPrefix]
   * @param {Buffer} [root=null]
   * @returns {Promise}
   */

  async compact(tmpPrefix, root) {
    if (root)
      await this.inject(root);

    await this._tree.compact(tmpPrefix);
  }

  /**
   * Compact database.
   * @param {String} [tmpPrefix]
   * @param {Buffer} [root=null]
   * @returns {Promise}
   */

  compactSync(tmpPrefix, root) {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  /**
   * Get new transaction instance
   * @returns {Transaction}
   */

  transaction() {
    return new WrappedTransaction(this);
  }

  /**
   * Get snapshot
   * @param {Hash} rootHash
   * @returns {Snapshot}
   */

  snapshot(rootHash) {
    return new WrappedSnapshot(this, rootHash);
  }

  /**
   * Get new transaction instance
   * @returns {Transaction}
   */

  batch() {
    return this.transaction();
  }

  /**
   * Get new transaction instance
   * @returns {Transaction}
   */

  txn() {
    return this.transaction();
  }

  iterator(read = true) {
    throw new Error(ERR_NOT_IMPL);
  }

  [asyncIterator]() {
    return this.entries();
  }

  keys() {
    const iter = this.iterator(false);
    return iter.keys();
  }

  values() {
    const iter = this.iterator(true);
    return iter.values();
  }

  entries() {
    const iter = this.iterator(true);
    return iter.entries();
  }

  /**
   * Destroy the database.
   * @param {String} path
   * @returns {Promise}
   */

  static async destroy(path) {
    const tree = new Tree({ prefix: path });
    await tree.store.destroy();
    return;
  }

  /**
   * Destroy the database.
   * @param {String} path
   * @returns {void}
   */

  static destroySync(path) {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  /**
   * Hash the key.
   * @param {Buffer} data
   * @returns {Promise<Buffer>}
   */

  static async hash(data) {
    return BLAKE2b.digest(data);
  }

  /**
   * Hash the key.
   * @param {Buffer} data
   * @returns {Buffer}
   */

  static hashSync(data) {
    return BLAKE2b.digest(data);
  }

  /**
   * Verify proof.
   * @param {Buffer} root
   * @param {Buffer} key
   * @param {Buffer} proof
   * @returns {Promise<[Number, Buffer?]>}
   */

  static async verify(root, key, proof) {
    const proofobj = Proof.decode(proof, BLAKE2b, BLAKE2b.bits);
    const [code, value] = proofobj.verify(root, key, BLAKE2b, BLAKE2b.bits);
    return [code, value];
  }

  /**
   * Verify proof.
   * @param {Buffer} root
   * @param {Buffer} key
   * @param {Buffer} proof
   * @returns {[Number, Buffer?]} - exists
   */

  static verifySync(root, key, proof) {
    const proofobj = Proof.decode(proof, BLAKE2b, BLAKE2b.bits);
    const [code, value] = proofobj.verify(root, key, BLAKE2b, BLAKE2b.bits);
    return [code, value];
  }

  /**
   * Compact the tree.
   * @param {String} path
   * @param {String} [tmpPrefix]
   * @param {Buffer?} [root=null]
   * @returns {Promise}
   */

  static async compact(path, tmpPrefix, root) {
    if (!tmpPrefix)
      tmpPrefix = randomPath(path);

    const tree = new WrappedTree({ prefix: path });
    await tree.open();
    await tree.compact(tmpPrefix, root);
    await tree.close();
  }

  /**
   * Compact the tree.
   * @param {String} path
   * @param {String} [tmpPrefix]
   * @param {Buffer} [root=null]
   * @returns {void}
   */

  static compactSync(path, tmpPrefix, root) {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  /**
   * Get tree stats.
   * @param {String} prefix
   * @returns {Promise<Object>}
   */

  static async stat(prefix) {
    const tree = new WrappedTree({ prefix });
    await tree.open();
    const res = await tree.stat();
    await tree.close();
    return res;
  }

  /**
   * Get tree stats.
   * @param {String} prefix
   * @returns {Object}
   */

  static statSync(prefix) {
    throw new Error(ERR_NOT_SUPPORTED);
  }
}

class WrappedSnapshot {
  /**
   * @param {WrappedTree} wtree
   * @param {Hash} [rootHash=null]
   */

  constructor(wtree, rootHash) {
    this.tree = wtree;
    this._tx = null;

    this.init(rootHash);
  }

  get hash() {
    return this._tx.rootHash();
  }

  /**
   * Initialize snapshot
   */

  init(rootHash) {
    this._tx = this.tree._tree.snapshot(rootHash);
  }

  /**
   * Open transaction
   * @returns {Promise}
   */

  async open() {
    ;
  }

  /**
   * Close the snapshot
   * @returns {Promise}
   */

  async close() {
    ;
  }

  /**
   * Get snapshot has.
   * @returns {Buffer}
   */

  rootHash() {
    return this.hash;
  }

  /**
   * Root Node wont be returned, here for API compatibility.
   * @throws {Error}
   */

  async getRoot() {
    throw new Error(ERR_PLACEHOLDER);
  }

  /**
   * Inject new root to the snapshot.
   * @param {Hash} rootHash
   * @returns {Promise}
   */

  async inject(rootHash) {
    return this._tx.inject(rootHash);
  }

  /**
   * Inject new root to the snapshot.
   * @param {Hash} hash
   * @returns {Promise}
   */

  injectSync(hash) {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  /**
   * Returns value for the key.
   * @param {Buffer} key
   * @returns {Promise<Buffer>} - value
   */

  async get(key) {
    return this._tx.get(key);
  }

  /**
   * Returns value for the key.
   * @param {Buffer} key
   * @returns {Buffer}
   */

  getSync(key) {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  /**
   * Does transaction have key (tree included)
   * @param {Buffer} key
   * @returns {Promise<Buffer>}
   */

  async has(key) {
    const val = await this.get(key);
    return val != null;
  }

  /**
   * Does transaction have key (tree included)
   * @param {Buffer} key
   * @returns {Buffer}
   */

  hasSync(key) {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  /**
   * Get proof for the key.
   * @param {Buffer} key
   * @returns {Promise<Buffer>}
   */

  async prove(key) {
    const proof = await this._tx.prove(key);
    return proof.encode(this.tree.hash, this.tree.bits);
  }

  /**
   * Get proof for the key.
   * @param {Buffer} key
   * @returns {Buffer}
   */

  proveSync(key) {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  iterator(read = true) {
    throw new Error(ERR_NOT_IMPL);
  }

  [asyncIterator]() {
    return this.entries();
  }

  keys() {
    const iter = this.iterator(false);
    return iter.keys();
  }

  values() {
    const iter = this.iterator(true);
    return iter.values();
  }

  entries() {
    const iter = this.iterator(true);
    return iter.entries();
  }
}

class WrappedTransaction extends WrappedSnapshot {
  /**
   * @param {WrappedTree} wtree
   */

  constructor(wtree) {
    super(wtree, wtree.rootHash());
  }

  init() {
    this._tx = this.tree._tree.txn();
  }

  /**
   * Calculate root hash of the transaction.
   * TODO: Benchmark this on the big transactions.
   * @returns {Buffer}
   */

  rootHash() {
    return this._tx.rootHash();
  }

  /**
   * Get root hash from the liburkel tx.
   * @returns {Buffer}
   */

  txRootHashSync() {
    return this._tx.rootHash();
  }

  /**
   * Get root hash from the liburkel tx.
   * @returns {Promise<Buffer>}
   */

  async txRootHash() {
    return this._tx.rootHash();
  }

  async getRoot() {
    throw new Error(ERR_NOT_IMPL);
  }

  /**
   * Insert key/val in the tx.
   * @param {Buffer} key
   * @param {Buffer} value
   * @returns {Promise}
   */

  async insert(key, value) {
    return this._tx.insert(key, value);
  }

  /**
   * Insert key/val in the tx.
   * @param {Buffer} key
   * @param {Buffer} value
   * @returns {void}
   */

  insertSync(key, value) {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  /**
   * Remove entry from the tx.
   * @param {Buffer} key
   * @returns {Promise}
   */

  async remove(key) {
    return this._tx.remove(key);
  }

  /**
   * Remove entry from the tx.
   * @param {Buffer} key
   * @returns {void}
   */

  removeSync(key) {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  /**
   * Commit transaction.
   * @returns {Promise<Hash>}
   */

  async commit() {
    return this._tx.commit();
  }

  /**
   * Commit transaction.
   */

  commitSync() {
    throw new Error(ERR_NOT_SUPPORTED);
  }

  async clear() {
    return this._tx.clear();
  }

  clearSync() {
    return this._tx.clear();
  }
}

WrappedTree.supportsSync = false;
exports.Tree = WrappedTree;
exports.proofCodes = proofCodes;
exports.proofCodesByVal = proofCodesByVal;