#include "main.h"
#include <node_api.h>
#define NAPI_CALL(env, call)                                      \
  do {                                                            \
    napi_status status = (call);                                  \
    if (status != napi_ok) {                                      \
      const napi_extended_error_info* error_info = NULL;          \
      napi_get_last_error_info((env), &error_info);               \
      const char* err_message = error_info->error_message;        \
      bool is_pending;                                            \
      napi_is_exception_pending((env), &is_pending);              \
      if (!is_pending) {                                          \
        const char* message = (err_message == NULL)               \
            ? "empty error message"                               \
            : err_message;                                        \
        napi_throw_error((env), NULL, message);                   \
        return NULL;                                              \
      }                                                           \
    }                                                             \
  } while(0)
#define node_fn(name, inner) { \
  napi_value exported_function; \
  NAPI_CALL(env, napi_create_function(env, \
                                      name, \
                                      NAPI_AUTO_LENGTH, \
                                      inner, \
                                      NULL, \
                                      &exported_function)); \
    NAPI_CALL(env, napi_set_named_property(env, \
                                          result, \
                                          name, \
                                          exported_function)); \
}
NAPI_MODULE_INIT() {
  napi_value result;
  NAPI_CALL(env, napi_create_object(env, &result));
  node_fn("generateThumbnail", [](auto env, auto info) -> napi_value {
    size_t argc = 1;
    napi_value argv[argc];
    napi_value thisArg;
    void * data;
    NAPI_CALL(env, napi_get_cb_info(env,
                              info,
                              &argc,
                              argv,
                              &thisArg,
                              &data));

    napi_value result;
    char path[4096];
    NAPI_CALL(env, napi_get_value_string_utf8(env, argv[0], path, sizeof(path), NULL));
    const char* out = generate_thumbnail(path);
    NAPI_CALL(env, napi_create_string_utf8(env, out, NAPI_AUTO_LENGTH, &result));
    return result;
  });

  return result;
}
