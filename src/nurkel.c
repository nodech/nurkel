/**
 * nurkel.c - native bindings to liburkel.
 * Copyright (c) 2022, Nodari Chkuaselidze (MIT License)
 * https://github.com/nodech/nurkel
 */

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>

#include <urkel.h>
#include <node_api.h>

#include "common.h"
#include "util.h"
#include "tree.h"
#include "transaction.h"

/*
 * Module
 */

#ifndef NAPI_MODULE_INIT
#define NAPI_MODULE_INIT()                                       \
static napi_value nurkel_init(napi_env env, napi_value exports); \
NAPI_MODULE(NODE_GYP_MODULE_NAME, nurkel_init)                   \
static napi_value nurkel_init(napi_env env, napi_value exports)
#endif

NAPI_MODULE_INIT() {
  size_t i;

  static const struct {
    const char *name;
    napi_callback callback;
  } funcs[] = {
#define F(name) { #name, nurkel_ ## name }
    F(init),
    F(open),
    F(close),
    F(root_hash_sync),
    F(root_hash),
    F(destroy_sync),
    F(destroy),
    F(hash_sync),
    F(hash),
    F(inject_sync),
    F(inject),
    F(get_sync),
    F(get),
    F(has_sync),
    F(has),
    F(insert_sync),
    F(insert),
    F(remove_sync),
    F(remove),
    F(prove_sync),
    F(prove),
    F(verify_sync),
    F(verify),
    F(compact_sync),
    F(compact),
    F(stat_sync),
    F(stat),

    /* TX Methods */
    F(tx_init),
    F(tx_open),
    F(tx_close),
    F(tx_root_hash_sync),
    F(tx_root_hash),
    F(tx_get_sync),
    F(tx_get),
    F(tx_has_sync),
    F(tx_has),
    F(tx_insert_sync),
    F(tx_insert),
    F(tx_remove_sync),
    F(tx_remove),
    F(tx_prove_sync),
    F(tx_prove),
    F(tx_commit_sync),
    F(tx_commit),
    F(tx_clear_sync),
    F(tx_clear),
    F(tx_inject_sync),
    F(tx_inject)
#undef F
  };

  for (i = 0; i < sizeof(funcs) / sizeof(funcs[0]); i++) {
    const char *name = funcs[i].name;
    napi_callback callback = funcs[i].callback;
    napi_value fn;

    NAPI_OK(napi_create_function(env,
                               name,
                               NAPI_AUTO_LENGTH,
                               callback,
                               NULL,
                               &fn));

    NAPI_OK(napi_set_named_property(env, exports, name, fn));
  }

  return 0;
}
